'use strict';

const { ShippingAllocationRule, sequelize } = require('../../src/models');
const shippingRuleEvaluator = require('../../src/services/shippingRuleEvaluator.service');

describe('Shipping Rules Engine with Multi-Courier Priority (Up to 5 Couriers)', () => {
  let rule1, rule2;

  beforeAll(async () => {
    await ShippingAllocationRule.sync();
  });

  afterAll(async () => {
    if (rule1) await rule1.destroy().catch(() => {});
    if (rule2) await rule2.destroy().catch(() => {});
  });

  test('should create a shipping rule with up to 5 prioritized fallback couriers', async () => {
    rule1 = await ShippingAllocationRule.create({
      name: 'High-Value COD Multi-Courier Priority Rule',
      priority: 1,
      is_active: true,
      scope: 'global',
      payment_mode: 'cod',
      zone: 'all',
      min_weight_kg: 0.0,
      max_weight_kg: 5.0,
      courier_priorities: [
        { priority: 1, courier_key: '7377', name: 'Blue Dart Express (Air)' },
        { priority: 2, courier_key: '80622', name: 'Delhivery Surface' },
        { priority: 3, courier_key: '80593', name: 'XpressBees Surface' },
        { priority: 4, courier_key: '79681', name: 'Shadowfax Surface' },
        { priority: 5, courier_key: '82861', name: 'Ekart Logistics' },
      ],
    });

    expect(rule1.id).toBeDefined();
    expect(rule1.courier_priorities).toHaveLength(5);
    expect(rule1.courier_priorities[0].courier_key).toBe('7377');
    expect(rule1.courier_priorities[1].courier_key).toBe('80622');
  });

  test('should allocate Priority 1 courier when it is serviceable', async () => {
    const availableRates = [
      { service_type: '80622', display_name: 'Delhivery Surface', price: 48.00 },
      { service_type: '7377', display_name: 'Blue Dart Express', price: 65.00 },
      { service_type: '80593', display_name: 'XpressBees Surface', price: 42.00 },
    ];

    const result = await shippingRuleEvaluator.evaluateOptimalCourier({
      tenantId: 'seller-uuid',
      weightKg: 1.5,
      isCod: true,
      paymentMode: 'cod',
      zone: 'Metro',
      deliveryPincode: '400001',
      availableRates,
      isLocalTn: false,
    });

    expect(result.allocatedRate).toBeDefined();
    expect(result.allocatedRate.service_type).toBe('7377');
    expect(result.priorityRank).toBe(1);
    expect(result.matchedRule.id).toBe(rule1.id);
  });

  test('should automatically fall back to Priority 2 when Priority 1 is unserviceable for pincode', async () => {
    // Blue Dart (7377) is NOT in availableRates (unserviceable)
    const availableRates = [
      { service_type: '80622', display_name: 'Delhivery Surface', price: 48.00 },
      { service_type: '80593', display_name: 'XpressBees Surface', price: 42.00 },
      { service_type: '79681', display_name: 'Shadowfax Surface', price: 44.00 },
    ];

    const result = await shippingRuleEvaluator.evaluateOptimalCourier({
      tenantId: 'seller-uuid',
      weightKg: 1.5,
      isCod: true,
      paymentMode: 'cod',
      zone: 'Regional',
      deliveryPincode: '201301',
      availableRates,
      isLocalTn: false,
    });

    expect(result.allocatedRate).toBeDefined();
    // Delhivery Surface (P2) must be selected!
    expect(result.allocatedRate.service_type).toBe('80622');
    expect(result.priorityRank).toBe(2);
    expect(result.routingReason).toContain('Priority 2');
    expect(result.routingReason).toContain('Unserviceable higher priorities bypassed: P1');
  });

  test('should automatically fall back to Priority 3 when Priority 1 and 2 are unserviceable', async () => {
    // Neither Blue Dart (7377) nor Delhivery (80622) is serviceable
    const availableRates = [
      { service_type: '80593', display_name: 'XpressBees Surface', price: 42.00 },
      { service_type: '79681', display_name: 'Shadowfax Surface', price: 44.00 },
    ];

    const result = await shippingRuleEvaluator.evaluateOptimalCourier({
      tenantId: 'seller-uuid',
      weightKg: 1.5,
      isCod: true,
      paymentMode: 'cod',
      zone: 'Rest of India',
      deliveryPincode: '781001',
      availableRates,
      isLocalTn: false,
    });

    expect(result.allocatedRate).toBeDefined();
    // XpressBees Surface (P3) must be selected!
    expect(result.allocatedRate.service_type).toBe('80593');
    expect(result.priorityRank).toBe(3);
  });

  test('should support multiple rules and prefer seller-specific rules over global rules', async () => {
    const { Tenant } = require('../../src/models');
    let tenant = await Tenant.findOne();
    if (!tenant) {
      tenant = await Tenant.create({
        name: 'Test Store',
        company_name: 'Test Store Pvt Ltd',
        subdomain: 'test-store-' + Date.now(),
        email: 'test' + Date.now() + '@example.com',
      });
    }

    rule2 = await ShippingAllocationRule.create({
      name: 'Seller Custom Light Air Rule',
      priority: 2,
      is_active: true,
      scope: 'seller',
      tenant_id: tenant.id,
      payment_mode: 'all',
      zone: 'all',
      min_weight_kg: 0.0,
      max_weight_kg: 1.0,
      courier_priorities: [
        { priority: 1, courier_key: '80593', name: 'XpressBees Surface' },
      ],
    });

    const availableRates = [
      { service_type: '80622', display_name: 'Delhivery Surface', price: 48.00 },
      { service_type: '7377', display_name: 'Blue Dart Express', price: 65.00 },
      { service_type: '80593', display_name: 'XpressBees Surface', price: 42.00 },
    ];

    // For specific seller, rule2 (Xpressbees) should be matched
    const result = await shippingRuleEvaluator.evaluateOptimalCourier({
      tenantId: tenant.id,
      weightKg: 0.5,
      isCod: false,
      paymentMode: 'prepaid',
      zone: 'Metro',
      deliveryPincode: '110001',
      availableRates,
      isLocalTn: false,
    });

    expect(result.allocatedRate).toBeDefined();
    expect(result.allocatedRate.service_type).toBe('80593');
    expect(result.matchedRule.id).toBe(rule2.id);
  });
});
