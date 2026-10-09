'use strict';

const courierCostRateRepo = require('../repositories/courierCostRate.repository');
const { CourierProvider } = require('../models');
const { BadRequestError } = require('../utils/errors');
const logger = require('../utils/logger');

async function importShipwayCostCsv(csvText, adminId = null) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) {
    throw new BadRequestError('CSV file must contain a header row and at least one data row.');
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''));

  let imported = 0;
  let skipped = 0;
  const errors = [];

  const providers = await CourierProvider.findAll();

  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1;
    const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    if (cols.length < 5) continue;

    const rowMap = {};
    headers.forEach((h, idx) => { rowMap[h] = cols[idx] || ''; });

    const courierName = rowMap.courier_name || rowMap.courier_display_name || rowMap.courier || cols[0];
    const modeStr = (rowMap.service_mode || rowMap.mode || cols[1] || 'surface').toLowerCase();
    const service_mode = modeStr.includes('air') ? 'air' : 'surface';
    const base_weight_kg = parseFloat(rowMap.base_weight_kg || rowMap.base_weight || cols[2] || 0.5);
    const additional_weight_increment_kg = parseFloat(rowMap.additional_weight_increment_kg || rowMap.additional_weight || cols[3] || 0.5);
    const zoneStr = (rowMap.zone || cols[4] || 'D').toUpperCase();
    const base_cost = parseFloat(rowMap.base_cost || rowMap.cost || cols[5] || 0);
    const additional_cost = parseFloat(rowMap.additional_cost || rowMap.additional_price || cols[6] || 0);
    const cod_flat_cost = rowMap.cod_flat_cost ? parseFloat(rowMap.cod_flat_cost) : null;
    const cod_percent_cost = rowMap.cod_percent_cost ? parseFloat(rowMap.cod_percent_cost) : null;
    const effective_from = rowMap.effective_from || new Date().toISOString().slice(0, 10);

    if (!['A', 'B', 'C', 'D', 'E'].includes(zoneStr)) {
      errors.push({ row: rowNum, reason: `Invalid zone '${zoneStr}'. Must be A, B, C, D, or E.` });
      skipped++;
      continue;
    }

    // Exact or fuzzy match provider
    const matchedProvider = providers.find(p =>
      p.provider_key.toLowerCase() === courierName.toLowerCase() ||
      p.display_name.toLowerCase().includes(courierName.toLowerCase()) ||
      courierName.toLowerCase().includes(p.display_name.toLowerCase())
    );

    try {
      await courierCostRateRepo.upsertCostRate({
        courier_provider_id: matchedProvider ? matchedProvider.id : null,
        courier_display_name: matchedProvider ? matchedProvider.display_name : courierName,
        service_mode,
        base_weight_kg,
        additional_weight_increment_kg,
        zone: zoneStr,
        base_cost,
        additional_cost,
        cod_flat_cost,
        cod_percent_cost,
        effective_from,
      });
      imported++;
    } catch (err) {
      errors.push({ row: rowNum, reason: err.message });
      skipped++;
    }
  }

  logger.info(`[CostRateImportService] Imported ${imported} cost rates, skipped ${skipped}`);
  return { imported, skipped, errors };
}

async function listCostRates(filters, pagination) {
  return courierCostRateRepo.listAll(filters, pagination);
}

module.exports = {
  importShipwayCostCsv,
  listCostRates,
};
