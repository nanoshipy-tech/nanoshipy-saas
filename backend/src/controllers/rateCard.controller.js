'use strict';

const rateCardService = require('../services/rateCard.service');
const { success, error } = require('../utils/apiResponse');

/**
 * Tenant Rate Resolution (`POST /api/v1/orders/:orderId/rates`)
 * Tenant API — Returns rate_cards-derived sell prices only. Zero cost data.
 */
const getTenantRates = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const tenantId = req.tenant.id;
    const userId = req.user ? req.user.id : null;

    const result = await rateCardService.getTenantRates(orderId, tenantId, userId);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

/**
 * List Rate Cards (`GET /api/v1/platform/rate-cards`)
 * Platform Admin API
 */
const listRateCards = async (req, res, next) => {
  try {
    const { courier, mode, zone, is_active, page, limit } = req.query;
    const result = await rateCardService.listRateCards(
      { courier, mode, zone, is_active },
      { page, limit }
    );
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

/**
 * RFC 4180 CSV Escaping Helper
 * Wraps values containing commas, quotes, or newlines in double quotes and escapes internal quotes.
 */
const escapeCsv = (val) => {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
};

/**
 * RFC 4180 Compliant CSV Line Parser
 * Correctly parses CSV lines without splitting on commas within quotes.
 */
const parseCsvLine = (line) => {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result;
};

/**
 * Bulk CSV or JSON Import Rate Cards (`POST /api/v1/rate-cards/import`)
 * Platform Admin API
 */
const importRateCards = async (req, res, next) => {
  try {
    const platformAdminId = req.platformAdmin ? req.platformAdmin.id : null;
    const { RateCardUploadLog, RateCard, CourierProvider } = require('../models');

    let rowsToImport = [];
    const fileName = req.body?.file_name || (req.file ? req.file.originalname : 'rate_card_upload.csv');
    const importMode = req.body?.import_mode || 'append';

    if (req.body && Array.isArray(req.body.rows)) {
      rowsToImport = req.body.rows;
    } else if (req.file && req.file.buffer) {
      const csvText = req.file.buffer.toString('utf-8');
      const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length > 1) {
        const headers = parseCsvLine(lines[0]).map(h => h.replace(/^["']|["']$/g, ''));
        rowsToImport = lines.slice(1).map(l => {
          const vals = parseCsvLine(l).map(v => v.replace(/^["']|["']$/g, ''));
          const obj = {};
          headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
          return obj;
        });
      }
    } else if (req.body && req.body.csv) {
      const lines = req.body.csv.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length > 1) {
        const headers = parseCsvLine(lines[0]).map(h => h.replace(/^["']|["']$/g, ''));
        rowsToImport = lines.slice(1).map(l => {
          const vals = parseCsvLine(l).map(v => v.replace(/^["']|["']$/g, ''));
          const obj = {};
          headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
          return obj;
        });
      }
    }

    if (!rowsToImport || rowsToImport.length === 0) {
      return error(res, { code: 'BAD_REQUEST', message: 'No rows provided for import.' }, 400);
    }

    let successCount = 0;
    let failedCount = 0;
    const errDetails = [];

    if (importMode === 'replace') {
      await RateCard.update({ is_active: false }, { where: {} });
    }

    for (let i = 0; i < rowsToImport.length; i++) {
      const r = rowsToImport[i];
      try {
        const courierName = r.courier_name || r.courier || 'Delhivery';
        let provider = await CourierProvider.findOne({ where: { display_name: courierName } });
        if (!provider) {
          provider = await CourierProvider.findOne();
        }

        const baseRate = parseFloat(r.base_rate || r.base_price || 0);
        const addRate = parseFloat(r.additional_rate || r.additional_price || 0);
        const zone = (r.zone || 'A').toUpperCase();

        await RateCard.create({
          courier_provider_id: provider ? provider.id : null,
          courier_name: courierName,
          service_mode: r.service_mode || r.service_type || 'Surface',
          zone,
          min_weight_kg: parseFloat(r.min_weight_kg || r.base_weight_kg || 0.5),
          max_weight_kg: parseFloat(r.max_weight_kg || 10.0),
          base_rate: baseRate,
          additional_weight_kg: parseFloat(r.additional_weight_kg || r.additional_weight_increment_kg || 0.5),
          additional_rate: addRate,
          cod_charge_flat: parseFloat(r.cod_charge_flat || 40.0),
          cod_charge_percent: parseFloat(r.cod_charge_percent || 2.5),
          is_active: true,
          effective_from: r.effective_from || new Date().toISOString().slice(0, 10),
          created_by: platformAdminId,
        });
        successCount++;
      } catch (err) {
        failedCount++;
        errDetails.push({ row: i + 1, error: err.message });
      }
    }

    await RateCardUploadLog.create({
      uploaded_by: platformAdminId,
      file_name: fileName,
      import_mode: importMode,
      total_rows: rowsToImport.length,
      success_rows: successCount,
      failed_rows: failedCount,
      error_details: errDetails,
      status: failedCount === 0 ? 'success' : (successCount > 0 ? 'partial_success' : 'failed'),
    });

    return success(res, {
      message: `Successfully imported ${successCount} rate cards!`,
      imported: successCount,
      failed: failedCount,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Preview & Validate Rate Cards (`POST /api/v1/rate-cards/preview`)
 */
const previewRateCards = async (req, res, next) => {
  try {
    let rows = [];
    if (req.body && Array.isArray(req.body.rows)) {
      rows = req.body.rows;
    } else if (req.file && req.file.buffer) {
      const csvText = req.file.buffer.toString('utf-8');
      const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length > 1) {
        const headers = parseCsvLine(lines[0]).map(h => h.replace(/^["']|["']$/g, ''));
        rows = lines.slice(1).map(l => {
          const vals = parseCsvLine(l).map(v => v.replace(/^["']|["']$/g, ''));
          const obj = {};
          headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
          return obj;
        });
      }
    }

    const results = rows.map((r, idx) => {
      const errors = [];
      const courierName = r.courier_name || r.courier || '';
      const zone = (r.zone || '').toUpperCase();
      const serviceType = (r.service_mode || r.service_type || 'Surface').toLowerCase();
      const baseRate = parseFloat(r.base_rate || r.base_price);
      const addRate = parseFloat(r.additional_rate || r.additional_price);

      if (!courierName) errors.push('Missing courier name');
      if (!zone) errors.push('Missing zone');
      if (isNaN(baseRate) || baseRate <= 0) errors.push('Invalid base rate');
      if (isNaN(addRate) || addRate < 0) errors.push('Invalid additional rate');

      const valid = errors.length === 0;

      return {
        row_number: idx + 1,
        valid,
        errors,
        data: {
          courier_name: courierName || 'Unknown',
          zone: zone || 'A',
          service_type: serviceType,
          min_weight_kg: parseFloat(r.min_weight_kg || r.base_weight_kg || 0.5),
          max_weight_kg: parseFloat(r.max_weight_kg || 10.0),
          base_rate: isNaN(baseRate) ? 0 : baseRate,
          additional_weight_kg: parseFloat(r.additional_weight_kg || r.additional_weight_increment_kg || 0.5),
          additional_rate: isNaN(addRate) ? 0 : addRate,
          cod_charge_flat: parseFloat(r.cod_charge_flat || 40.0),
          cod_charge_percent: parseFloat(r.cod_charge_percent || 2.5),
        }
      };
    });

    const validRows = results.filter(r => r.valid).length;
    const invalidRows = results.length - validRows;

    return success(res, {
      total_rows: results.length,
      valid_rows: validRows,
      invalid_rows: invalidRows,
      results,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get Rate Card Upload History (`GET /api/v1/rate-cards/history`)
 */
const getHistory = async (req, res, next) => {
  try {
    const { RateCardUploadLog } = require('../models');
    const logs = await RateCardUploadLog.findAll({
      order: [['created_at', 'DESC']],
      limit: 50,
    });
    return success(res, logs);
  } catch (err) {
    next(err);
  }
};

/**
 * Update Rate Card Row (`PUT /api/v1/platform/rate-cards/:id`)
 * Platform Admin API
 */
const updateRateCard = async (req, res, next) => {
  try {
    const { id } = req.params;
    const platformAdminId = req.platformAdmin ? req.platformAdmin.id : null;

    const updated = await rateCardService.updateRateCard(id, req.body, platformAdminId);
    return success(res, updated);
  } catch (err) {
    next(err);
  }
};

/**
 * Get Cost vs Sell Margin Report (`GET /api/v1/platform/margin-report`)
 * Platform Admin API (report.view permission required)
 */
const getMarginReport = async (req, res, next) => {
  try {
    const { date_from, date_to, courier_id } = req.query;
    const result = await rateCardService.getMarginReport({ date_from, date_to, courier_id });
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

/**
 * Download Sample Rate Card Template CSV (`GET /api/v1/rate-cards/template`)
 */
const getTemplate = async (req, res) => {
  const headers = ['courier_name', 'service_mode', 'base_weight_kg', 'additional_weight_increment_kg', 'zone', 'base_price', 'additional_price', 'effective_from'];
  const sampleRows = [
    ['Delhivery', 'Surface', '0.5', '0.5', 'Zone A, Metro', '38.00', '32.00', '2026-01-01'],
    ['Delhivery', 'Surface', '0.5', '0.5', 'Zone B, Regional', '44.00', '38.00', '2026-01-01'],
    ['Delhivery', 'Surface', '0.5', '0.5', 'Zone C, National', '52.00', '45.00', '2026-01-01'],
    ['Delhivery', 'Surface', '0.5', '0.5', 'Zone D, Special', '60.00', '52.00', '2026-01-01'],
    ['Delhivery', 'Surface', '0.5', '0.5', 'Zone E, North-East/J&K', '72.00', '65.00', '2026-01-01'],
    ['Bluedart', 'Air', '0.5', '0.5', 'Zone A, Metro', '55.00', '48.00', '2026-01-01'],
    ['Bluedart', 'Air', '0.5', '0.5', 'Zone B, Regional', '65.00', '58.00', '2026-01-01'],
    ['Bluedart', 'Air', '0.5', '0.5', 'Zone C, National', '78.00', '70.00', '2026-01-01'],
    ['Bluedart', 'Air', '0.5', '0.5', 'Zone D, Special', '92.00', '82.00', '2026-01-01'],
    ['Bluedart', 'Air', '0.5', '0.5', 'Zone E, North-East/J&K', '110.00', '98.00', '2026-01-01']
  ];

  const csv = [
    headers.map(escapeCsv).join(','),
    ...sampleRows.map(row => row.map(escapeCsv).join(','))
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="rate_card_sample_template.csv"');
  return res.status(200).send(csv);
};

/**
 * Export Active Rate Cards to CSV (`GET /api/v1/rate-cards/export`)
 * Exports all active rate cards with proper RFC 4180 quotes for zones, courier names, and amounts.
 */
const exportRateCards = async (req, res, next) => {
  try {
    const { RateCard, CourierProvider } = require('../models');
    const cards = await RateCard.findAll({
      where: { is_active: true },
      include: [{ model: CourierProvider, as: 'courierProvider', attributes: ['display_name'] }],
      order: [['courier_name', 'ASC'], ['zone', 'ASC']]
    });

    const headers = ['courier_name', 'service_mode', 'base_weight_kg', 'additional_weight_increment_kg', 'zone', 'base_price', 'additional_price', 'cod_charge_flat', 'cod_charge_percent', 'effective_from'];
    const rows = cards.map(c => [
      c.courierProvider?.display_name || c.courier_name || 'Express',
      c.service_mode || 'Surface',
      parseFloat(c.min_weight_kg || 0.5).toFixed(3),
      parseFloat(c.additional_weight_kg || 0.5).toFixed(3),
      c.zone || 'Zone A',
      parseFloat(c.base_rate || 0).toFixed(2),
      parseFloat(c.additional_rate || 0).toFixed(2),
      parseFloat(c.cod_charge_flat || 40).toFixed(2),
      parseFloat(c.cod_charge_percent || 2.5).toFixed(1),
      c.effective_from || new Date().toISOString().slice(0, 10)
    ]);

    const csv = [
      headers.map(escapeCsv).join(','),
      ...rows.map(row => row.map(escapeCsv).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="active_rate_cards_${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getTenantRates,
  listRateCards,
  importRateCards,
  previewRateCards,
  getHistory,
  updateRateCard,
  getMarginReport,
  getTemplate,
  exportRateCards,
  escapeCsv,
  parseCsvLine,
};
