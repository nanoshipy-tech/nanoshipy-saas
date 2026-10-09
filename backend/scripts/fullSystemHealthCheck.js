'use strict';

const sequelize = require('../src/config/db.config');
const models = require('../src/models');

async function runHealthCheck() {
  console.log('========================================================');
  console.log('  SHIPPING SAAS COMPREHENSIVE SYSTEM HEALTH CHECK');
  console.log('========================================================\n');

  try {
    // 1. Database Connection Test
    console.log('[1/4] Testing Database Connection...');
    await sequelize.authenticate();
    console.log('  ✅ Database connection established successfully via Sequelize.');
    console.log(`  Dialect: ${sequelize.getDialect()}`);

    // Sync models to ensure tables exist in local database
    await sequelize.sync();
    await models.CostRateSnapshot.sync({ alter: true });
    console.log('  ✅ All database models synced successfully.\n');

    // 2. Database Models & Record Counts Audit
    console.log('[2/4] Auditing Core Models & Table Records...');
    const modelChecks = [
      { name: 'Tenants', model: models.Tenant },
      { name: 'Users', model: models.User },
      { name: 'Platform Admins', model: models.PlatformAdmin },
      { name: 'Courier Providers', model: models.CourierProvider },
      { name: 'Payment Gateways', model: models.PaymentGateway },
      { name: 'Courier Cost Rates (Module 21 v2)', model: models.CourierCostRate },
      { name: 'Markup Config (Module 21 v2)', model: models.MarkupConfig },
      { name: 'COD Markup Config', model: models.CodMarkupConfig },
      { name: 'RTO Markup Config', model: models.RtoMarkupConfig },
      { name: 'Cost Rate Snapshots', model: models.CostRateSnapshot },
      { name: 'Orders', model: models.Order },
      { name: 'Shipments', model: models.Shipment },
      { name: 'Wallets', model: models.Wallet },
      { name: 'Wallet Transactions', model: models.WalletTransaction },
      { name: 'KYC Documents', model: models.KycDocument },
      { name: 'Platform Audit Logs', model: models.PlatformAuditLog },
      { name: 'Tenant Audit Logs', model: models.AuditLog },
      { name: 'Pincode Master Records', model: models.PincodeMaster },
    ];

    for (const check of modelChecks) {
      if (check.model) {
        const count = await check.model.count();
        console.log(`  - ${check.name.padEnd(38)} : ${count} records`);
      } else {
        console.log(`  - ${check.name.padEnd(38)} : [Model Not Registered]`);
      }
    }

    console.log('\n[3/4] Testing Functional Service Methods...');

    // 3.1 Zone Resolver Functional Check
    const zoneResolver = require('../src/services/zoneResolver');
    const zA = await zoneResolver.resolveZone('110001', '110002');
    const zC = await zoneResolver.resolveZone('110001', '400001');
    const zE = await zoneResolver.resolveZone('110001', '190001');
    console.log(`  ✅ Zone Resolver: Delhi->Delhi=${zA}, Delhi->Mumbai=${zC}, Delhi->Srinagar=${zE}`);

    // 3.2 Pricing Service Functional Check
    const pricingService = require('../src/services/pricing.service');
    const slabs = pricingService.calculateSlabs(1.30, 0.50, 0.50);
    console.log(`  ✅ Weight Slab Calc: 1.3kg -> Total Slab ${slabs.totalSlabWeight}kg (${slabs.additionalUnits} additional units)`);

    const rtoPrice = await pricingService.getRtoPrice(100.00);
    console.log(`  ✅ RTO Surcharge Calc: Forward ₹100 -> RTO Sell Price ₹${rtoPrice}`);

    // 3.3 Markup Config Functional Check
    const markupConfigRepo = require('../src/repositories/markupConfig.repository');
    const effectiveMarkup = await markupConfigRepo.getEffectiveMarkup(null, 'A');
    console.log(`  ✅ Effective Markup: Scope ${effectiveMarkup.scope} -> ${effectiveMarkup.markup_percent}%`);

    // 3.4 Audit Log Repository Search Check
    const auditLogRepo = require('../src/repositories/auditLog.repository');
    const auditResults = await auditLogRepo.searchPlatformAuditLog({});
    console.log(`  ✅ Unified Platform Audit Log: Retrieved ${auditResults.rows ? auditResults.rows.length : 0} logs`);

    // 3.5 Margin Report Functional Check
    const costRateSnapshotRepo = require('../src/repositories/costRateSnapshot.repository');
    const marginStats = await costRateSnapshotRepo.getMarginReport({});
    console.log(`  ✅ Margin Report Aggregation: Total Sell ₹${marginStats.total_sell}, Total Cost ₹${marginStats.total_cost}, Total Margin ₹${marginStats.total_margin} (${marginStats.shipping_margin_percent}%)`);

    console.log('\n[4/4] Summary & Verification Status...');
    console.log('  ========================================================');
    console.log('  🎉 ALL SYSTEM & DATABASE CONNECTION CHECKS PASSED!');
    console.log('  ========================================================\n');

  } catch (err) {
    console.error('❌ SYSTEM HEALTH CHECK FAILED:', err);
    process.exit(1);
  }
}

runHealthCheck().then(() => process.exit(0));
