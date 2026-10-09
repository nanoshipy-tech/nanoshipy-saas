'use strict';

const { Shipment, Order, Tenant, PlatformAdmin, CourierProvider, PickupAddress, PincodeMaster } = require('../models');
const { Op } = require('sequelize');
const { resolveZone, getPincodeLocation } = require('./zoneResolver');

/**
 * Resolves date range defaults (last 30 days if unspecified).
 */
function resolveDateRange(from, to) {
  const toDate = to ? new Date(`${to}T23:59:59.999Z`) : new Date();
  const fromDate = from
    ? new Date(`${from}T00:00:00.000Z`)
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  return {
    from: fromDate.toISOString().split('T')[0],
    to: toDate.toISOString().split('T')[0],
    fromDate,
    toDate,
  };
}

class AdminOperationsReportService {
  /**
   * Builds the query filters based on caller role and request parameters.
   */
  _buildQueryContext(filters = {}, callerAdmin = null) {
    const range = resolveDateRange(filters.from, filters.to);

    const shipmentWhere = {
      created_at: {
        [Op.between]: [range.fromDate, range.toDate],
      },
    };

    if (filters.courier_id) {
      shipmentWhere.courier_provider_id = filters.courier_id;
    }

    if (filters.status) {
      shipmentWhere.status = filters.status;
    }

    if (filters.awb) {
      shipmentWhere.awb_number = { [Op.iLike || Op.like]: `%${filters.awb.trim()}%` };
    }

    const orderWhere = {};
    if (filters.payment_mode) {
      orderWhere.payment_mode = filters.payment_mode.toLowerCase();
    }
    if (filters.state) {
      orderWhere.shipping_state = { [Op.iLike || Op.like]: `%${filters.state.trim()}%` };
    }
    if (filters.order_ref) {
      orderWhere.order_reference = { [Op.iLike || Op.like]: `%${filters.order_ref.trim()}%` };
    }

    const tenantWhere = {};
    const effectiveKamId = (callerAdmin && callerAdmin.role === 'key_account_manager')
      ? callerAdmin.id
      : filters.kam_id;

    if (effectiveKamId) {
      tenantWhere.kam_id = effectiveKamId;
    }
    if (filters.tenant_id) {
      tenantWhere.id = filters.tenant_id;
    }

    return { range, shipmentWhere, orderWhere, tenantWhere, effectiveKamId };
  }

  /**
   * Retrieves operational reports (KPI summary, district-wise, KAM-wise, and detailed rows).
   */
  async getOperationsReport(filters = {}, callerAdmin = null) {
    const { range, shipmentWhere, orderWhere, tenantWhere } = this._buildQueryContext(filters, callerAdmin);

    const page = Math.max(1, parseInt(filters.page || 1, 10));
    const limit = Math.max(1, Math.min(200, parseInt(filters.limit || 50, 10)));
    const offset = (page - 1) * limit;

    // Fetch all matching shipments for KPI calculations & aggregations
    // We fetch necessary fields with joins
    const allShipments = await Shipment.findAll({
      where: shipmentWhere,
      include: [
        {
          model: Order,
          as: 'order',
          where: Object.keys(orderWhere).length > 0 ? orderWhere : undefined,
          attributes: [
            'id', 'order_reference', 'order_value', 'payment_mode',
            'shipping_address_line1', 'shipping_address_line2',
            'shipping_city', 'shipping_state', 'shipping_pincode'
          ],
        },
        {
          model: Tenant,
          as: 'tenant',
          where: Object.keys(tenantWhere).length > 0 ? tenantWhere : undefined,
          attributes: ['id', 'company_name', 'kam_id'],
          include: [
            {
              model: PlatformAdmin,
              as: 'kam',
              attributes: ['id', 'name', 'email'],
            },
          ],
        },
        {
          model: CourierProvider,
          as: 'provider',
          attributes: ['id', 'display_name', 'provider_key'],
        },
        {
          model: PickupAddress,
          as: 'pickupAddress',
          attributes: ['id', 'pincode', 'city', 'state'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    // Cache pincode to location lookups to optimize performance
    const pincodeMap = new Map();
    const uniquePincodes = [...new Set(allShipments.map(s => s.order?.shipping_pincode).filter(Boolean))];
    if (uniquePincodes.length > 0) {
      const pincodeRecords = await PincodeMaster.findAll({
        where: { pincode: { [Op.in]: uniquePincodes } },
        attributes: ['pincode', 'district', 'city', 'state'],
      });
      pincodeRecords.forEach(r => pincodeMap.set(r.pincode, r));
    }

    // Process rows into standard schema
    const formattedRows = await Promise.all(allShipments.map(async (s) => {
      const order = s.order || {};
      const tenant = s.tenant || {};
      const provider = s.provider || {};
      const pickup = s.pickupAddress || {};

      const pinRecord = pincodeMap.get(order.shipping_pincode);
      let district = pinRecord?.district || '';
      if (!district && order.shipping_pincode) {
        const loc = await getPincodeLocation(order.shipping_pincode);
        district = loc.district || loc.city || '';
      }
      if (!district) {
        district = order.shipping_city || 'N/A';
      }

      // Zone calculation
      const zone = await resolveZone(pickup.pincode, order.shipping_pincode);

      const freightCharge = parseFloat(s.selected_rate || s.sell_rate || 0);
      const codCharge = parseFloat(s.cod_charge || 0);
      const isRto = String(s.status || '').toLowerCase().includes('rto');
      const returnFreightCharge = parseFloat(s.rto_charge || (isRto ? freightCharge : 0));
      const orderValue = parseFloat(order.order_value || 0);

      const addressParts = [
        order.shipping_address_line1,
        order.shipping_address_line2,
        order.shipping_city,
        order.shipping_pincode,
      ].filter(Boolean);

      return {
        shipment_id: s.id,
        awb_number: s.awb_number || s.courier_shipment_id || 'N/A',
        order_number: order.order_reference || 'N/A',
        courier_name: provider.display_name || provider.name || provider.provider_key || 'N/A',
        tenant_name: tenant.company_name || 'N/A',
        tenant_id: tenant.id || null,
        order_value: Number(orderValue.toFixed(2)),
        payment_mode: (order.payment_mode || 'prepaid').toUpperCase(),
        freight_charge: Number(freightCharge.toFixed(2)),
        status: s.status || 'created',
        created_date: s.created_at ? s.created_at.toISOString().replace('T', ' ').substring(0, 19) : 'N/A',
        zone: `Zone ${zone}`,
        cod_charge: Number(codCharge.toFixed(2)),
        return_freight_charge: Number(returnFreightCharge.toFixed(2)),
        kam_id: tenant.kam?.id || null,
        kam_name: tenant.kam?.name || 'Unassigned',
        address: addressParts.join(', ') || 'N/A',
        district: district,
        state: order.shipping_state || pinRecord?.state || 'N/A',
      };
    }));

    // Optional district filter if requested
    let filteredRows = formattedRows;
    if (filters.district) {
      const dFilter = filters.district.trim().toLowerCase();
      filteredRows = filteredRows.filter(r => r.district.toLowerCase().includes(dFilter));
    }

    // Compute Summary KPIs
    const summary = {
      from: range.from,
      to: range.to,
      total_shipments: filteredRows.length,
      total_order_value: Number(filteredRows.reduce((sum, r) => sum + r.order_value, 0).toFixed(2)),
      total_freight_charge: Number(filteredRows.reduce((sum, r) => sum + r.freight_charge, 0).toFixed(2)),
      total_cod_charge: Number(filteredRows.reduce((sum, r) => sum + r.cod_charge, 0).toFixed(2)),
      total_return_freight: Number(filteredRows.reduce((sum, r) => sum + r.return_freight_charge, 0).toFixed(2)),
      delivered_count: filteredRows.filter(r => r.status.toLowerCase() === 'delivered').length,
      rto_count: filteredRows.filter(r => r.status.toLowerCase().includes('rto')).length,
    };

    // Aggregate District-Wise
    const districtAggMap = new Map();
    filteredRows.forEach(r => {
      const key = `${r.district}__${r.state}`;
      if (!districtAggMap.has(key)) {
        districtAggMap.set(key, {
          district: r.district,
          state: r.state,
          total_orders: 0,
          delivered_orders: 0,
          rto_orders: 0,
          total_order_value: 0,
          total_freight_charge: 0,
          total_cod_charge: 0,
          total_return_freight: 0,
        });
      }
      const agg = districtAggMap.get(key);
      agg.total_orders += 1;
      if (r.status.toLowerCase() === 'delivered') agg.delivered_orders += 1;
      if (r.status.toLowerCase().includes('rto')) agg.rto_orders += 1;
      agg.total_order_value += r.order_value;
      agg.total_freight_charge += r.freight_charge;
      agg.total_cod_charge += r.cod_charge;
      agg.total_return_freight += r.return_freight_charge;
    });

    const district_breakdown = Array.from(districtAggMap.values())
      .map(d => ({
        ...d,
        total_order_value: Number(d.total_order_value.toFixed(2)),
        total_freight_charge: Number(d.total_freight_charge.toFixed(2)),
        total_cod_charge: Number(d.total_cod_charge.toFixed(2)),
        total_return_freight: Number(d.total_return_freight.toFixed(2)),
        delivery_rate_pct: d.total_orders > 0 ? Number(((d.delivered_orders / d.total_orders) * 100).toFixed(1)) : 0,
        rto_rate_pct: d.total_orders > 0 ? Number(((d.rto_orders / d.total_orders) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.total_orders - a.total_orders);

    // Aggregate KAM-Wise
    const kamAggMap = new Map();
    filteredRows.forEach(r => {
      const key = r.kam_name;
      if (!kamAggMap.has(key)) {
        kamAggMap.set(key, {
          kam_name: r.kam_name,
          kam_id: r.kam_id,
          tenants_set: new Set(),
          total_orders: 0,
          delivered_orders: 0,
          rto_orders: 0,
          total_order_value: 0,
          total_freight_charge: 0,
          total_cod_charge: 0,
          total_return_freight: 0,
        });
      }
      const agg = kamAggMap.get(key);
      if (r.tenant_id) agg.tenants_set.add(r.tenant_id);
      agg.total_orders += 1;
      if (r.status.toLowerCase() === 'delivered') agg.delivered_orders += 1;
      if (r.status.toLowerCase().includes('rto')) agg.rto_orders += 1;
      agg.total_order_value += r.order_value;
      agg.total_freight_charge += r.freight_charge;
      agg.total_cod_charge += r.cod_charge;
      agg.total_return_freight += r.return_freight_charge;
    });

    const kam_breakdown = Array.from(kamAggMap.values())
      .map(k => ({
        kam_name: k.kam_name,
        kam_id: k.kam_id,
        assigned_sellers_count: k.tenants_set.size,
        total_orders: k.total_orders,
        delivered_orders: k.delivered_orders,
        rto_orders: k.rto_orders,
        total_order_value: Number(k.total_order_value.toFixed(2)),
        total_freight_charge: Number(k.total_freight_charge.toFixed(2)),
        total_cod_charge: Number(k.total_cod_charge.toFixed(2)),
        total_return_freight: Number(k.total_return_freight.toFixed(2)),
        delivery_rate_pct: k.total_orders > 0 ? Number(((k.delivered_orders / k.total_orders) * 100).toFixed(1)) : 0,
        rto_rate_pct: k.total_orders > 0 ? Number(((k.rto_orders / k.total_orders) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.total_orders - a.total_orders);

    // Paginated detailed rows
    const paginatedRows = filteredRows.slice(offset, offset + limit);

    return {
      summary,
      district_breakdown,
      kam_breakdown,
      rows: paginatedRows,
      pagination: {
        total: filteredRows.length,
        page,
        limit,
        total_pages: Math.ceil(filteredRows.length / limit) || 1,
      },
    };
  }

  /**
   * Prepares export data and columns for CSV/XLSX generation.
   */
  async exportOperationsReport(filters = {}, callerAdmin = null) {
    const reportData = await this.getOperationsReport(
      { ...filters, page: 1, limit: 10000 },
      callerAdmin
    );

    const viewMode = (filters.view_mode || 'detailed').toLowerCase();

    if (viewMode === 'district') {
      const columns = [
        { key: 'district', label: 'District' },
        { key: 'state', label: 'State' },
        { key: 'total_orders', label: 'Total Orders' },
        { key: 'delivered_orders', label: 'Delivered Orders' },
        { key: 'rto_orders', label: 'RTO Orders' },
        { key: 'delivery_rate_pct', label: 'Delivery Rate (%)' },
        { key: 'rto_rate_pct', label: 'RTO Rate (%)' },
        { key: 'total_order_value', label: 'Total Order Value (INR)' },
        { key: 'total_freight_charge', label: 'Total Freight Charge (INR)' },
        { key: 'total_cod_charge', label: 'Total COD Charge (INR)' },
        { key: 'total_return_freight', label: 'Total Return Freight (INR)' },
      ];
      return {
        data: reportData.district_breakdown,
        columns,
        filename: `district_operations_report_${reportData.summary.from}_to_${reportData.summary.to}`,
        sheetName: 'District Operations',
      };
    }

    if (viewMode === 'kam') {
      const columns = [
        { key: 'kam_name', label: 'KAM Name' },
        { key: 'assigned_sellers_count', label: 'Assigned Sellers' },
        { key: 'total_orders', label: 'Total Orders' },
        { key: 'delivered_orders', label: 'Delivered Orders' },
        { key: 'rto_orders', label: 'RTO Orders' },
        { key: 'delivery_rate_pct', label: 'Delivery Rate (%)' },
        { key: 'rto_rate_pct', label: 'RTO Rate (%)' },
        { key: 'total_order_value', label: 'Total Order Value (INR)' },
        { key: 'total_freight_charge', label: 'Total Freight Charge (INR)' },
        { key: 'total_cod_charge', label: 'Total COD Charge (INR)' },
        { key: 'total_return_freight', label: 'Total Return Freight (INR)' },
      ];
      return {
        data: reportData.kam_breakdown,
        columns,
        filename: `kam_operations_report_${reportData.summary.from}_to_${reportData.summary.to}`,
        sheetName: 'KAM Operations',
      };
    }

    // Default Detailed 15-column master shipment ledger
    const columns = [
      { key: 'awb_number', label: 'AWB Number' },
      { key: 'order_number', label: 'Order Number' },
      { key: 'courier_name', label: 'Courier Name' },
      { key: 'tenant_name', label: 'Tenant Name' },
      { key: 'order_value', label: 'Order Value' },
      { key: 'payment_mode', label: 'COD/Prepaid' },
      { key: 'freight_charge', label: 'Fright Charge' },
      { key: 'status', label: 'Status' },
      { key: 'created_date', label: 'Created Date' },
      { key: 'zone', label: 'Zone' },
      { key: 'cod_charge', label: 'COD Charge' },
      { key: 'return_freight_charge', label: 'Return Frieght Charge' },
      { key: 'kam_name', label: 'KAM Name' },
      { key: 'address', label: 'Address' },
      { key: 'district', label: 'District' },
      { key: 'state', label: 'State' },
    ];

    return {
      data: reportData.rows,
      columns,
      filename: `operations_shipments_ledger_${reportData.summary.from}_to_${reportData.summary.to}`,
      sheetName: 'Shipments Ledger',
    };
  }

  /**
   * Retrieves dropdown options for filters (KAMs, Couriers, States, Common Statuses).
   */
  async getFilterOptions(callerAdmin = null) {
    const kams = await PlatformAdmin.findAll({
      where: {
        role: { [Op.in]: ['key_account_manager', 'super_admin'] },
        status: 'active',
      },
      attributes: ['id', 'name', 'email', 'role'],
      order: [['name', 'ASC']],
    });

    const rawCouriers = await CourierProvider.findAll({
      where: { is_active: true },
      attributes: ['id', 'display_name', 'provider_key'],
      order: [['display_name', 'ASC']],
    });

    const couriers = rawCouriers.map(c => ({
      id: c.id,
      name: c.display_name || c.provider_key,
      code: c.provider_key,
    }));

    const statuses = [
      'created',
      'manifested',
      'picked_up',
      'in_transit',
      'out_for_delivery',
      'delivered',
      'ndr',
      'rto_initiated',
      'rto_in_transit',
      'rto_delivered',
      'cancelled',
    ];

    return {
      kams,
      couriers,
      statuses,
    };
  }
}

module.exports = new AdminOperationsReportService();
