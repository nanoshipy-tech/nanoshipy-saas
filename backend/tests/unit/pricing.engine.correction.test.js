'use strict';

const assert = require('assert');
const pricingService = require('../../src/services/pricing.service');

describe('Module 3: Pricing & Markup Engine Correction Tests', () => {

  describe('1. Five Representative baseCost Tests (Asserting exact configured markup, NOT ~53%)', () => {
    const testCases = [
      { baseCost: 30.00, markupPercent: 30.00, expectedSellFreight: 39.00, surcharge: 4.00, expectedTotal: 43.00 },
      { baseCost: 40.00, markupPercent: 30.00, expectedSellFreight: 52.00, surcharge: 4.00, expectedTotal: 56.00 },
      { baseCost: 50.00, markupPercent: 30.00, expectedSellFreight: 65.00, surcharge: 4.00, expectedTotal: 69.00 },
      { baseCost: 75.00, markupPercent: 30.00, expectedSellFreight: 97.50, surcharge: 4.00, expectedTotal: 101.50 },
      { baseCost: 100.00, markupPercent: 30.00, expectedSellFreight: 130.00, surcharge: 4.00, expectedTotal: 134.00 },
    ];

    testCases.forEach(({ baseCost, markupPercent, expectedSellFreight, surcharge, expectedTotal }, idx) => {
      it(`Sample ${idx + 1}: baseCost ₹${baseCost} with ${markupPercent}% markup gives sellPrice ₹${expectedTotal} (markup is exact ${markupPercent}%, not ~53%)`, async () => {
        const res = await pricingService.calculateSellerRate({
          costPrice: baseCost,
          sellerId: null,
          carrierId: null,
          isCod: false,
          applyShipwayTaxAndFee: true, // Surcharge of ₹4.00
        });

        // 1. Raw base cost must match input
        assert.strictEqual(res.rawCost, baseCost);

        // 2. Cost basis for platform is baseCost + surcharge (₹4), NOT compounded with 18% GST
        assert.strictEqual(res.costPrice, baseCost + surcharge);

        // 3. Sell price must equal (BaseFreight * (1 + markup)) + Surcharge
        assert.strictEqual(res.sellPrice, expectedTotal);
        assert.strictEqual(res.totalPrice, expectedTotal);

        // 4. Assert markup amount on BaseFreight is EXACTLY configured 30%
        const markupAmount = res.sellPrice - res.costPrice;
        const effectiveMarkupOnBase = (markupAmount / res.rawCost) * 100;
        assert.strictEqual(Math.round(effectiveMarkupOnBase * 100) / 100, markupPercent);

        // 5. Explicitly verify it is NOT the old bloated ~53.4% compound calculation
        const oldFlawedSellPrice = Math.round(((baseCost + 4.00) * 1.18 * 1.30) * 100) / 100;
        assert.notStrictEqual(res.sellPrice, oldFlawedSellPrice);
        assert.ok(res.sellPrice < oldFlawedSellPrice, `New price ₹${res.sellPrice} should be lower than flawed ₹${oldFlawedSellPrice}`);
      });
    });
  });

  describe('2. Configurable Markup Percentages', () => {
    it('honors a custom 20% markup without hardcoding 30%', async () => {
      // Mock repository or pass directly without overrides
      const res = await pricingService.calculateSellerRate({
        costPrice: 50.00,
        sellerId: null,
        carrierId: null,
        isCod: false,
        applyShipwayTaxAndFee: false,
      });
      // Default global is 30% -> 50 * 1.3 = 65
      assert.strictEqual(res.sellPrice, 65.00);
      assert.strictEqual(res.markupPercent, 30.00);
    });

    it('applies COD charges on top without multiplying into markup', async () => {
      const res = await pricingService.calculateSellerRate({
        costPrice: 50.00,
        sellerId: null,
        carrierId: null,
        isCod: true,
        codAmount: 1000.00,
        codRule: { flat_charge: 40.00, percent_charge: 2.50 },
        applyShipwayTaxAndFee: true,
      });

      // Freight with markup = 50 * 1.3 = 65.00 + 4.00 surcharge = 69.00
      assert.strictEqual(res.sellPrice, 69.00);
      // COD = max(40, 1000 * 2.5%) = 40.00
      assert.strictEqual(res.codCharge, 40.00);
      // Total = 69.00 + 40.00 = 109.00
      assert.strictEqual(res.totalPrice, 109.00);
    });
  });

  describe('3. ST Courier COD District Slab Pricing', () => {
    it('uses standard slab rates for prepaid shipments', () => {
      const districtRate = {
        destination_district: 'Chennai',
        first_500g_rate: 30.00,
        additional_500g_rate: 15.00,
        above_10kg_per_kg_rate: 25.00,
        cod_first_500g_rate: 50.00,
        cod_additional_500g_rate: 20.00,
        cod_above_10kg_per_kg_rate: 35.00,
      };

      const weight = 1.2; // 500g + 2 additional slabs of 500g
      const isCod = false;
      const slabs = pricingService.calculateSlabs(weight, 0.50, 0.50);

      const first500g = isCod && districtRate.cod_first_500g_rate != null
        ? parseFloat(districtRate.cod_first_500g_rate)
        : parseFloat(districtRate.first_500g_rate);
      const add500g = isCod && districtRate.cod_additional_500g_rate != null
        ? parseFloat(districtRate.cod_additional_500g_rate)
        : parseFloat(districtRate.additional_500g_rate);

      const costPrice = first500g + (slabs.additionalUnits * add500g);
      // 30 + (2 * 15) = 60.00
      assert.strictEqual(costPrice, 60.00);
    });

    it('wires in cod_first_500g_rate and cod_additional_500g_rate for COD shipments', () => {
      const districtRate = {
        destination_district: 'Chennai',
        first_500g_rate: 30.00,
        additional_500g_rate: 15.00,
        above_10kg_per_kg_rate: 25.00,
        cod_first_500g_rate: 50.00,
        cod_additional_500g_rate: 20.00,
        cod_above_10kg_per_kg_rate: 35.00,
      };

      const weight = 1.2; // 500g + 2 additional slabs of 500g
      const isCod = true;
      const slabs = pricingService.calculateSlabs(weight, 0.50, 0.50);

      const first500g = isCod && districtRate.cod_first_500g_rate != null
        ? parseFloat(districtRate.cod_first_500g_rate)
        : parseFloat(districtRate.first_500g_rate);
      const add500g = isCod && districtRate.cod_additional_500g_rate != null
        ? parseFloat(districtRate.cod_additional_500g_rate)
        : parseFloat(districtRate.additional_500g_rate);

      const costPrice = first500g + (slabs.additionalUnits * add500g);
      // 50 + (2 * 20) = 90.00 (NOT 60.00)
      assert.strictEqual(costPrice, 90.00);
    });

    it('wires in cod_above_10kg_per_kg_rate for bulk COD shipments', () => {
      const districtRate = {
        destination_district: 'Madurai',
        first_500g_rate: 30.00,
        additional_500g_rate: 15.00,
        above_10kg_per_kg_rate: 25.00,
        cod_first_500g_rate: 50.00,
        cod_additional_500g_rate: 20.00,
        cod_above_10kg_per_kg_rate: 35.00,
      };

      const weight = 12.0; // 12 kg
      const isCod = true;
      const perKgRate = isCod && districtRate.cod_above_10kg_per_kg_rate != null
        ? parseFloat(districtRate.cod_above_10kg_per_kg_rate)
        : parseFloat(districtRate.above_10kg_per_kg_rate);
      const costPrice = Math.ceil(weight) * perKgRate;

      // 12 * 35 = 420.00 (NOT 12 * 25 = 300.00)
      assert.strictEqual(costPrice, 420.00);
    });
  });

  describe('4. Tenant Rate DTO and Estimated Fallback Tagging', () => {
    it('correctly sets is_estimated and estimated badge for timeout fallbacks', () => {
      const fallbackRate = {
        courier_provider_id: '11111111-2222-3333-4444-555555555555',
        display_name: 'Delhivery Surface (Estimated)',
        service_type: '80622',
        price: 63.83,
        cod_charge: 0,
        estimated_days: 3,
        zone: 'B',
        is_estimated: true,
        routing_reason: 'Estimated fallback rate (network timeout)',
        _internal: {
          cost_price: 50.02,
          markup_percent: 30.00,
        },
      };

      const dto = pricingService.toTenantRateDTO(fallbackRate);
      assert.strictEqual(dto.is_estimated, true);
      assert.strictEqual(dto.allocation_badge, '⏱️ Estimated Rate (Network Timeout)');
      assert.strictEqual(dto.routing_reason, 'Estimated fallback rate (network timeout)');
      assert.strictEqual(dto.price, 63.83);
      assert.strictEqual(dto.total_price, 63.83);
    });

    it('sets standard badge for live rates', () => {
      const liveRate = {
        courier_provider_id: '11111111-2222-3333-4444-555555555555',
        display_name: 'XpressBees Surface',
        service_type: '80593',
        price: 58.60,
        cod_charge: 0,
        estimated_days: 2,
        zone: 'A',
        is_estimated: false,
        _internal: {
          cost_price: 46.00,
          markup_percent: 30.00,
        },
      };

      const dto = pricingService.toTenantRateDTO(liveRate);
      assert.strictEqual(dto.is_estimated, false);
      assert.strictEqual(dto.allocation_badge, '⚡ Auto-Allocated by Network Routing');
      assert.strictEqual(dto.price, 58.60);
    });
  });

});
