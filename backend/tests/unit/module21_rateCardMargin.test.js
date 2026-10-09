'use strict';

const assert = require('assert');
const zoneResolver = require('../../src/services/zoneResolver');
const rateCardService = require('../../src/services/rateCard.service');

describe('Module 21: Tenant Rate Card & Cost Margin Layer Tests', () => {

  beforeAll(async () => {
    const { RateCard, CostRateSnapshot } = require('../../src/models');
    await RateCard.sync();
    await CostRateSnapshot.sync();
  });

  it('1. Weight Slab Calculation should round up to nearest increment slab', () => {
    // 1.3kg order on 0.5kg base & 0.5kg increment
    const res1 = rateCardService.calculateSlabs(1.30, 0.50, 0.50);
    assert.strictEqual(res1.totalSlabWeight, 1.50);
    assert.strictEqual(res1.baseWeight, 0.50);
    assert.strictEqual(res1.additionalUnits, 2);

    // 0.4kg order on 0.5kg base & 0.5kg increment
    const res2 = rateCardService.calculateSlabs(0.40, 0.50, 0.50);
    assert.strictEqual(res2.totalSlabWeight, 0.50);
    assert.strictEqual(res2.additionalUnits, 0);

    // 2.0kg order on 1.0kg base & 1.0kg increment
    const res3 = rateCardService.calculateSlabs(2.00, 1.00, 1.00);
    assert.strictEqual(res3.totalSlabWeight, 2.00);
    assert.strictEqual(res3.additionalUnits, 1);
  });

  it('2. Zone Resolver should accurately classify pincodes into Zones A, B, C, D, E', async () => {
    // Zone A: Same city (Delhi 110001 -> Delhi 110002)
    const zA = await zoneResolver.resolveZone('110001', '110002');
    assert.strictEqual(zA, 'A');

    // Zone C: Metro to Metro (Delhi 110001 -> Mumbai 400001)
    const zC = await zoneResolver.resolveZone('110001', '400001');
    assert.strictEqual(zC, 'C');

    // Zone E: NE / J&K (Delhi 110001 -> Srinagar 190001)
    const zE = await zoneResolver.resolveZone('110001', '190001');
    assert.strictEqual(zE, 'E');

    // Zone E: Assam (Delhi 110001 -> Guwahati 781001)
    const zE2 = await zoneResolver.resolveZone('110001', '781001');
    assert.strictEqual(zE2, 'E');
  });

  it('3. Security Check: toTenantDTO MUST strip cost_rate, cost_price, margin_amount, provider_raw_response', () => {
    const rawRateData = {
      courier_provider_id: '123e4567-e89b-12d3-a456-426614174000',
      display_name: 'Delhivery Express Direct',
      service_type: 'surface',
      price: 120.50,
      cod_charge: 40.00,
      estimated_days: 3,
      zone: 'D',

      // SENSITIVE INTERNAL COST FIELDS THAT MUST NEVER LEAK TO TENANTS
      cost_price: 85.00,
      cost_rate: 85.00,
      margin_amount: 35.50,
      margin_percent: 29.46,
      provider_raw_response: { raw_cost: 85.00, secret_token: 'xyz' },
      credentials_encrypted: 'encrypted-string',
    };

    const tenantDTO = rateCardService.toTenantDTO(rawRateData);

    assert.strictEqual(tenantDTO.price, 120.50);
    assert.strictEqual(tenantDTO.cod_charge, 40.00);
    assert.strictEqual(tenantDTO.display_name, 'Delhivery Express Direct');
    assert.strictEqual(tenantDTO.zone, 'D');

    // VERIFY ZERO LEAKAGE OF COST OR SENSITIVE FIELDS
    assert.strictEqual(tenantDTO.cost_price, undefined);
    assert.strictEqual(tenantDTO.cost_rate, undefined);
    assert.strictEqual(tenantDTO.margin_amount, undefined);
    assert.strictEqual(tenantDTO.margin_percent, undefined);
    assert.strictEqual(tenantDTO.provider_raw_response, undefined);
    assert.strictEqual(tenantDTO.credentials_encrypted, undefined);

    const jsonStr = JSON.stringify(tenantDTO);
    assert.strictEqual(jsonStr.includes('cost_rate'), false);
    assert.strictEqual(jsonStr.includes('cost_price'), false);
    assert.strictEqual(jsonStr.includes('margin_amount'), false);
    assert.strictEqual(jsonStr.includes('provider_raw_response'), false);
  });

  it('4. CSV Import Parser should parse rate card CSV and validate zones', async () => {
    const sampleCsv = `Courier Name,Service Mode,Base Weight (kg),Additional Weight (kg),Zone,Base Price,Additional Price
Delhivery Express,surface,0.5,0.5,A,40.00,25.00
Delhivery Express,surface,0.5,0.5,B,50.00,30.00
Bluedart Air,air,1.0,1.0,C,120.00,80.00
Shipway Aggregator,surface,0.5,0.5,Z,99.00,99.00`;

    const result = await rateCardService.importRateCardsFromCsv(sampleCsv, 'admin-123');

    assert.strictEqual(result.imported >= 3, true);
    assert.strictEqual(result.skipped >= 1, true); // Zone Z is invalid
    assert.strictEqual(result.errors.some(e => e.reason.includes("Invalid zone 'Z'")), true);
  });

});
