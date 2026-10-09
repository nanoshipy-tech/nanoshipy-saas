const orderImportRepository = require('../repositories/orderImport.repository');
const orderRepository = require('../repositories/order.repository');
const { PickupAddress, Order, OrderItem, OrderStatusHistory, sequelize } = require('../models');
const { parseImportFile } = require('../utils/csvParser.util');
const fileUploadService = require('./fileUpload.service');
const auditService = require('./audit.service');
const { createOrderSchema } = require('../validators/order.validator');
const Joi = require('joi');
const { NotFoundError } = require('../utils/errors');

class OrderImportService {
  async listImports(tenantId, page, limit) {
    return orderImportRepository.findAllByTenant(tenantId, page, limit);
  }

  async getImportById(tenantId, id) {
    const record = await orderImportRepository.findById(tenantId, id);
    if (!record) {
      throw new NotFoundError('Import batch not found');
    }
    return record;
  }

  /**
   * Process a bulk import of orders (synchronous fallback for < 1000 rows)
   * @param {string} tenantId 
   * @param {object} file - Multer file object
   * @param {string} userId 
   */
  async importOrders(tenantId, file, userId) {
    const originalName = file.originalname;
    
    // 1. Create OrderImport record in DB
    const importRecord = await orderImportRepository.create({
      tenant_id: tenantId,
      uploaded_by: userId,
      file_name: originalName,
      total_rows: 0,
      success_count: 0,
      failed_count: 0,
      status: 'processing',
    });

    // We do the processing in-request since it is synchronous for now.
    // In production this will be queued, but the polling API contract is exactly the same!
    try {
      const rawRows = parseImportFile(file.buffer, file.mimetype, originalName);
      if (!rawRows || rawRows.length === 0) {
        throw new Error('The uploaded file is empty or headers are missing');
      }

      const MAX_IMPORT_ROWS = 500;
      if (rawRows.length > MAX_IMPORT_ROWS) {
        const limitError = new Error(`CSV file contains ${rawRows.length} rows, which exceeds the maximum limit of ${MAX_IMPORT_ROWS} rows per upload. Please split your file into smaller batches.`);
        limitError.code = 'IMPORT_FILE_FORMAT_ERROR';
        throw limitError;
      }

      await this.processImportRows(tenantId, importRecord.id, rawRows, userId);
    } catch (err) {
      await orderImportRepository.update(importRecord.id, {
        status: 'failed',
      });
      throw err;
    }

    return orderImportRepository.findById(tenantId, importRecord.id);
  }

  /**
   * Parse and validate imported rows, insert in transactions, upload error report
   */
  async processImportRows(tenantId, importId, rawRows, userId) {
    const errorRows = [];
    const validOrders = [];
    
    // Group rows by order_reference
    const groupedOrders = {};
    
    // Retrieve all active pickup addresses for this tenant to check validity
    const activeAddresses = await PickupAddress.findAll({
      where: { tenant_id: tenantId, is_active: true },
      attributes: ['id', 'label', 'shipway_location_id', 'pincode', 'is_default']
    });
    const defaultAddress = activeAddresses.find(a => a.is_default) || activeAddresses[0];
    const validAddressIds = new Set(activeAddresses.map(a => a.id));

    // Map shipway_location_id and label to address UUID
    const locationIdMap = new Map();
    activeAddresses.forEach(a => {
      if (a.shipway_location_id) {
        locationIdMap.set(String(a.shipway_location_id).trim(), a.id);
      }
      if (a.label) {
        locationIdMap.set(String(a.label).trim().toLowerCase(), a.id);
      }
    });

    // Also cache duplicate references checks against DB
    const referencesToCheck = [...new Set(rawRows.map(r => r.order_reference).filter(Boolean))];
    const existingOrders = await Order.findAll({
      where: { tenant_id: tenantId, order_reference: referencesToCheck },
      attributes: ['order_reference']
    });
    const existingReferences = new Set(existingOrders.map(o => o.order_reference));

    // Grouping
    rawRows.forEach((row, index) => {
      const rowNum = index + 2; // 1-indexed header + 1
      const ref = row.order_reference ? row.order_reference.trim() : '';

      if (!ref) {
        errorRows.push({
          row_number: rowNum,
          order_reference: '',
          error_reason: 'Missing order_reference'
        });
        return;
      }

      if (!groupedOrders[ref]) {
        groupedOrders[ref] = {
          firstRowNumber: rowNum,
          order_reference: ref,
          pickup_address_id: row.pickup_address_id,
          customer_name: row.customer_name,
          customer_phone: row.customer_phone,
          customer_email: row.customer_email || null,
          shipping_address_line1: row.shipping_address_line1,
          shipping_address_line2: row.shipping_address_line2 || null,
          shipping_city: row.shipping_city,
          shipping_state: row.shipping_state,
          shipping_pincode: row.shipping_pincode,
          shipping_country: row.shipping_country || 'India',
          payment_mode: row.payment_mode ? row.payment_mode.toLowerCase() : '',
          cod_amount: row.cod_amount ? parseFloat(row.cod_amount) : undefined,
          weight_kg: row.weight_kg ? parseFloat(row.weight_kg) : undefined,
          length_cm: row.length_cm ? parseFloat(row.length_cm) : undefined,
          width_cm: row.width_cm ? parseFloat(row.width_cm) : undefined,
          height_cm: row.height_cm ? parseFloat(row.height_cm) : undefined,
          items: [],
        };
      }

      groupedOrders[ref].items.push({
        product_name: row.product_name,
        sku: row.sku || null,
        quantity: row.quantity ? parseInt(row.quantity, 10) : undefined,
        unit_price: row.unit_price ? parseFloat(row.unit_price) : undefined,
        rowNumber: rowNum,
      });
    });

    // Validate each order reference group
    for (const ref of Object.keys(groupedOrders)) {
      const orderGroup = groupedOrders[ref];
      const errors = [];

      // Duplicate ref check
      if (existingReferences.has(ref)) {
        errors.push('Duplicate order_reference: already exists in database');
      }

      // Pickup address validity check with auto-fallback to default address
      const rawAddress = orderGroup.pickup_address_id ? String(orderGroup.pickup_address_id).trim() : '';

      if (!rawAddress) {
        if (defaultAddress) {
          orderGroup.pickup_address_id = defaultAddress.id;
        }
      } else if (validAddressIds.has(rawAddress)) {
        orderGroup.pickup_address_id = rawAddress;
      } else if (locationIdMap.has(rawAddress)) {
        orderGroup.pickup_address_id = locationIdMap.get(rawAddress);
      } else if (locationIdMap.has(rawAddress.toLowerCase())) {
        orderGroup.pickup_address_id = locationIdMap.get(rawAddress.toLowerCase());
      } else if (defaultAddress) {
        // Safe fallback to default warehouse if an unrecognized warehouse reference was entered
        orderGroup.pickup_address_id = defaultAddress.id;
      }

      if (!validAddressIds.has(orderGroup.pickup_address_id)) {
        errors.push(`Invalid or inactive pickup_address_id: "${rawAddress || 'No default warehouse configured'}"`);
      }

      // Joi validation schema check
      const { error: joiError } = createOrderSchema.validate({
        order_reference: orderGroup.order_reference,
        pickup_address_id: orderGroup.pickup_address_id,
        customer_name: orderGroup.customer_name,
        customer_phone: orderGroup.customer_phone,
        customer_email: orderGroup.customer_email,
        shipping_address_line1: orderGroup.shipping_address_line1,
        shipping_address_line2: orderGroup.shipping_address_line2,
        shipping_city: orderGroup.shipping_city,
        shipping_state: orderGroup.shipping_state,
        shipping_pincode: orderGroup.shipping_pincode,
        shipping_country: orderGroup.shipping_country,
        payment_mode: orderGroup.payment_mode,
        cod_amount: orderGroup.cod_amount,
        weight_kg: orderGroup.weight_kg,
        length_cm: orderGroup.length_cm,
        width_cm: orderGroup.width_cm,
        height_cm: orderGroup.height_cm,
        items: orderGroup.items.map(item => ({
          product_name: item.product_name,
          sku: item.sku,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })),
      }, { abortEarly: false });

      if (joiError) {
        joiError.details.forEach(detail => errors.push(detail.message));
      }

      if (errors.length > 0) {
        // Collect failure row mapping
        errorRows.push({
          row_number: orderGroup.firstRowNumber,
          order_reference: ref,
          error_reason: errors.join('; '),
        });
      } else {
        validOrders.push(orderGroup);
      }
    }

    // 2. Insert valid orders in chunks of 500 rows/DB transactions
    const chunkSize = 500;
    let successfulInserts = 0;

    for (let i = 0; i < validOrders.length; i += chunkSize) {
      const chunk = validOrders.slice(i, i + chunkSize);
      
      await sequelize.transaction(async (t) => {
        for (const orderData of chunk) {
          const { items, firstRowNumber, ...orderFields } = orderData;
          
          // Auto-calculate order_value if missing
          const orderValue = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
          
          const order = await Order.create({
            ...orderFields,
            order_value: orderFields.order_value || orderValue,
            tenant_id: tenantId,
            created_by: userId,
            source: 'bulk_import',
            status: 'pending',
          }, { transaction: t });

          const dbItems = items.map(item => ({
            product_name: item.product_name,
            sku: item.sku,
            quantity: item.quantity,
            unit_price: item.unit_price,
            order_id: order.id,
          }));

          await OrderItem.bulkCreate(dbItems, { transaction: t });

          await OrderStatusHistory.create({
            order_id: order.id,
            old_status: null,
            new_status: 'pending',
            changed_by: userId,
            note: 'Order created via bulk import',
          }, { transaction: t });

          successfulInserts++;
        }
      });
    }

    // 3. Handle errors and generate report CSV if failed count > 0
    let errorReportUrl = null;
    const failedCount = errorRows.length;

    if (failedCount > 0) {
      // CSV injection protection: prefix formula-injectable symbols (=, +, -, @) with a single quote
      const escapeCsvCell = (val) => {
        if (val === undefined || val === null) return '';
        const str = String(val);
        if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
          return `'${str}`;
        }
        return str;
      };

      const csvHeaders = 'row_number,order_reference,error_reason\n';
      const csvLines = errorRows.map(row => 
        `"${escapeCsvCell(row.row_number)}","${escapeCsvCell(row.order_reference)}","${escapeCsvCell(row.error_reason)}"`
      ).join('\n');

      const csvBuffer = Buffer.from(csvHeaders + csvLines, 'utf-8');

      // Upload to object storage
      errorReportUrl = await fileUploadService.uploadFile(
        csvBuffer,
        'reports', // put error reports in reports folder
        `import-errors-${importId}.csv`,
        'text/csv'
      );
    }

    // 4. Update the import record status
    await orderImportRepository.update(importId, {
      total_rows: rawRows.length,
      success_count: successfulInserts,
      failed_count: failedCount,
      error_report_url: errorReportUrl,
      status: failedCount === rawRows.length ? 'failed' : 'completed',
    });

    await auditService.log({
      action: 'order_bulk_imported',
      tenant_id: tenantId,
      user_id: userId,
      entity_type: 'order_import',
      entity_id: importId,
      metadata: { success_count: successfulInserts, failed_count: failedCount }
    });
  }
}

module.exports = new OrderImportService();
