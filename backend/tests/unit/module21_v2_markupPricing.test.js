'use strict';

const assert = require('assert');
const pricingService = require('../../src/services/pricing.service');
const markupConfigRepo = require('../../src/repositories/markupConfig.repository');
const costRateImportService = require('../../src/services/costRateImport.service');

describe('Module 21 v2: Revised Markup-Based Pricing & Cost Margin Layer Tests', () => {

  beforeAll(async () => {
    const { CourierCostRate, MarkupConfig, CodMarkupConfig, RtoMarkupConfig, CostRateSnapshot } = require('../../src/models');
    await CourierCostRate.sync();
    await MarkupConfig.sync();
    await CodMarkupConfig.sync();
    await RtoMarkupConfig.sync();
    await CostRateSnapshot.sync();
    await MarkupConfig.destroy({ where: {}, truncate: true, force: true });
    await CodMarkupConfig.destroy({ where: {}, truncate: true, force: true });
    await RtoMarkupConfig.destroy({ where: {}, truncate: true, force: true });
  });

  it('1. Weight Slab Calculation should round order weight up to nearest increment slab', () => {
    const res1 = pricingService.calculateSlabs(1.30, 0.50, 0.50);
    assert.strictEqual(res1.totalSlabWeight, 1.50);
    assert.strictEqual(res1.additionalUnits, 2);

    const res2 = pricingService.calculateSlabs(0.45, 0.50, 0.50);
    assert.strictEqual(res2.totalSlabWeight, 0.50);
    assert.strictEqual(res2.additionalUnits, 0);

    const res3 = pricingService.calculateSlabs(2.10, 1.00, 1.00);
    assert.strictEqual(res3.totalSlabWeight, 3.00);
    assert.strictEqual(res3.additionalUnits, 2);
  });

  it('2. Markup Fallback Chain Resolution (courier_zone -> courier -> global 30%)', async () => {
    const cId = '11111111-2222-3333-4444-555555555555';

    // 1. Initially no custom rules exist -> resolves to global 30%
    const defaultRule = await markupConfigRepo.getEffectiveMarkup(cId, 'A');
    assert.strictEqual(parseFloat(defaultRule.markup_percent), 30.00);

    // 2. Add courier-specific override (35%)
    await markupConfigRepo.createOrUpdateMarkup({
      scope: 'courier',
      courier_provider_id: cId,
      markup_percent: 35.00,
    });

    const courierRule = await markupConfigRepo.getEffectiveMarkup(cId, 'A');
    assert.strictEqual(parseFloat(courierRule.markup_percent), 35.00);

    // 3. Add courier_zone specific override (40% for Zone E)
    await markupConfigRepo.createOrUpdateMarkup({
      scope: 'courier_zone',
      courier_provider_id: cId,
      zone: 'E',
      markup_percent: 40.00,
    });

    const courierZoneRule = await markupConfigRepo.getEffectiveMarkup(cId, 'E');
    assert.strictEqual(parseFloat(courierZoneRule.markup_percent), 40.00);

    // Zone A for same courier should still resolve to courier override (35%)
    const zoneARule = await markupConfigRepo.getEffectiveMarkup(cId, 'A');
    assert.strictEqual(parseFloat(zoneARule.markup_percent), 35.00);
  });

  it('3. RTO Pricing Surcharge Formula (forwardSell * 1.05)', async () => {
    const forwardSell = 100.00;
    const rtoSell = await pricingService.getRtoPrice(forwardSell);
    assert.strictEqual(rtoSell, 105.00);
  });

  it('4. Security Check: toTenantRateDTO MUST strip internal cost & margin data', () => {
    const internalRateObject = {
      courier_provider_id: '123e4567-e89b-12d3-a456-426614174000',
      display_name: 'Delhivery Surface Direct',
      service_type: 'surface',
      price: 130.00,
      cod_charge: 40.00,
      estimated_days: 3,
      zone: 'B',

      // INTERNAL FIELDS TO STRIP
      _internal: {
        cost_price: 100.00,
        markup_percent: 30.00,
      },
      cost_price: 100.00,
      cost_rate: 100.00,
      margin_amount: 30.00,
      margin_percent: 23.07,
      provider_raw_response: { secret: 'abc' },
    };

    const tenantDTO = pricingService.toTenantRateDTO(internalRateObject);

    assert.strictEqual(tenantDTO.price, 130.00);
    assert.strictEqual(tenantDTO.cod_charge, 40.00);
    assert.strictEqual(tenantDTO.display_name, 'Delhivery Surface Direct');
    assert.strictEqual(tenantDTO.zone, 'B');

    // Strict validation
    assert.strictEqual(tenantDTO._internal, undefined);
    assert.strictEqual(tenantDTO.cost_price, undefined);
    assert.strictEqual(tenantDTO.cost_rate, undefined);
    assert.strictEqual(tenantDTO.margin_amount, undefined);
    assert.strictEqual(tenantDTO.provider_raw_response, undefined);

    const json = JSON.stringify(tenantDTO);
    assert.strictEqual(json.includes('cost_price'), false);
    assert.strictEqual(json.includes('_internal'), false);
    assert.strictEqual(json.includes('margin_amount'), false);
  });

  it('5. Shipway CSV Cost Rate Import Parser', async () => {
    const sampleShipwayCsv = `Courier Name,Service Mode,Base Weight (kg),Additional Weight (kg),Zone,Base Cost,Additional Cost
Delhivery Express,surface,0.5,0.5,A,30.77,19.23
Delhivery Express,surface,0.5,0.5,B,38.46,23.08
Bluedart Air,air,1.0,1.0,C,92.31,61.54
Shipway Aggregator,surface,0.5,0.5,Z,99.00,99.00`;

    const result = await costRateImportService.importShipwayCostCsv(sampleShipwayCsv, 'admin-uuid');

    assert.strictEqual(result.imported >= 3, true);
    assert.strictEqual(result.skipped >= 1, true); // Zone Z is invalid
    assert.strictEqual(result.errors.some(e => e.reason.includes("Invalid zone 'Z'")), true);
  });

  it('6. calculateSellerRate applies markup and COD charge dynamically', async () => {
    // 100 base cost with default 30% markup = 130 sell price
    const res1 = await pricingService.calculateSellerRate({
      costPrice: 100.00,
      sellerId: null,
      carrierId: null,
      isCod: false,
    });
    assert.strictEqual(res1.costPrice, 100.00);
    assert.strictEqual(res1.sellPrice, 130.00);
    assert.strictEqual(res1.markupPercent, 30.00);
    assert.strictEqual(res1.codCharge, 0.00);
    assert.strictEqual(res1.totalPrice, 130.00);

    // With COD: flat ₹40 vs 2.5% of ₹1000 (25) -> flat ₹40
    const res2 = await pricingService.calculateSellerRate({
      costPrice: 100.00,
      sellerId: null,
      carrierId: null,
      isCod: true,
      codAmount: 1000.00,
    });
    assert.strictEqual(res2.sellPrice, 130.00);
    assert.strictEqual(res2.codCharge, 40.00);
    assert.strictEqual(res2.totalPrice, 170.00);

    // High value COD: 2.5% of ₹3000 = 75.00 -> 75.00
    const res3 = await pricingService.calculateSellerRate({
      costPrice: 100.00,
      sellerId: null,
      carrierId: null,
      isCod: true,
      codAmount: 3000.00,
    });
    assert.strictEqual(res3.codCharge, 75.00);
    assert.strictEqual(res3.totalPrice, 205.00);
  });

  it('7. calculateBillableWeight returns maximum of dead weight and volumetric weight', () => {
    const { calculateBillableWeight, calculateVolumetricWeight } = require('../../src/utils/weight.util');
    // 10 x 10 x 10 cm = 1000 / 5000 = 0.200 kg volumetric vs 0.500 kg dead weight -> 0.500 kg
    assert.strictEqual(calculateBillableWeight(0.50, 10, 10, 10), 0.5);

    // 30 x 30 x 30 cm = 27000 / 5000 = 5.400 kg volumetric vs 1.000 kg dead weight -> 5.400 kg
    assert.strictEqual(calculateBillableWeight(1.00, 30, 30, 30), 5.4);
  });

  it('8. Corrected Shipway formula: CustomerRate = (BaseFreight * (1 + markup)) + Surcharge', async () => {
    // Shipway base: ₹40.00, Markup: 30%, Surcharge: ₹4.00
    // Freight with markup = 40.00 * 1.30 = 52.00
    // Surcharge = 4.00
    // Total sell price = 52.00 + 4.00 = 56.00 (NOT bloated 67.50 with 53.4% markup)
    const res = await pricingService.calculateSellerRate({
      costPrice: 40.00,
      sellerId: null,
      carrierId: null,
      isCod: false,
      applyShipwayTaxAndFee: true,
    });

    assert.strictEqual(res.rawCost, 40.00);
    assert.strictEqual(res.costPrice, 44.00);
    assert.strictEqual(res.sellPrice, 56.00);
    assert.strictEqual(res.markupPercent, 30.00);
    assert.strictEqual(res.totalPrice, 56.00);
  });
});
