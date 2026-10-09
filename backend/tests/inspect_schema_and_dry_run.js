'use strict';

const sequelize = require('../src/config/db.config');
const models = require('../src/models');

async function runDiscovery() {
  console.log('Connecting to database...');
  await sequelize.authenticate();
  console.log(`Database connected via dialect: ${sequelize.getDialect()}\n`);

  // Query all physical tables in database
  const queryInterface = sequelize.getQueryInterface();
  const tables = await queryInterface.showAllTables();

  console.log(`Found ${tables.length} tables in database.\n`);

  // Inspect models and map to tables
  const modelMap = {};
  for (const [modelName, model] of Object.entries(models)) {
    if (model && model.tableName) {
      modelMap[model.tableName.toLowerCase()] = {
        modelName,
        model,
        rawAttributes: Object.keys(model.rawAttributes || {}),
        associations: Object.keys(model.associations || {}),
      };
    }
  }

  // Look for target accounts if they currently exist
  const { User, Tenant, PlatformAdmin } = models;
  
  const targetUser = await User.findOne({
    where: sequelize.where(
      sequelize.fn('LOWER', sequelize.col('email')),
      'demo@nanoshipy.com'
    ),
    include: [{ model: Tenant, as: 'tenant' }]
  }).catch(() => null);

  const targetAdmin = await PlatformAdmin.findOne({
    where: sequelize.where(
      sequelize.fn('LOWER', sequelize.col('email')),
      'care@nanoshipy.com'
    )
  }).catch(() => null);

  const targetTenantId = targetUser ? targetUser.tenant_id : null;
  const targetUserId = targetUser ? targetUser.id : null;
  const targetAdminId = targetAdmin ? targetAdmin.id : null;

  console.log('====================================================');
  console.log('  CURRENT TARGET ACCOUNTS IN DATABASE:');
  console.log('====================================================');
  console.log('Demo Merchant (demo@nanoshipy.com):', targetUser ? `Found (User ID: ${targetUserId}, Tenant ID: ${targetTenantId})` : 'Not Found (Will be created)');
  console.log('Platform Admin (Care@nanoshipy.com):', targetAdmin ? `Found (Admin ID: ${targetAdminId})` : 'Not Found (Will be created)');
  console.log('====================================================\n');

  // For each table, get:
  // - total_rows
  // - rows_kept
  // - rows_deleted
  const report = [];

  for (const table of tables) {
    const tableName = typeof table === 'object' ? table.tableName || Object.values(table)[0] : table;
    const lowerName = tableName.toLowerCase();

    // Skip sqlite internal tables
    if (lowerName.startsWith('sqlite_')) continue;

    let totalRows = 0;
    try {
      const [res] = await sequelize.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
      totalRows = parseInt(res[0].count || res[0].COUNT || 0, 10);
    } catch (e) {
      try {
        const [res] = await sequelize.query(`SELECT COUNT(*) as count FROM \`${tableName}\``);
        totalRows = parseInt(res[0].count || res[0].COUNT || 0, 10);
      } catch (err) {
        totalRows = 0;
      }
    }

    const modelInfo = modelMap[lowerName];
    let rowsKept = 0;

    // Check if table has tenant_id, user_id, or is platform_admins
    if (lowerName === 'platform_admins') {
      if (targetAdminId) {
        rowsKept = 1;
      }
    } else if (lowerName === 'users') {
      if (targetUserId) {
        rowsKept = 1;
      }
    } else if (lowerName === 'tenants') {
      if (targetTenantId) {
        rowsKept = 1;
      }
    } else if (lowerName === 'wallets') {
      // In reset, demo wallet will either be kept with balance 0 or fresh created
      if (targetTenantId) {
        rowsKept = 1;
      }
    } else if (lowerName === 'courier_providers' || lowerName === 'subscription_plans' || lowerName === 'pincode_masters' || lowerName === 'notification_templates' || lowerName === 'platform_permissions' || lowerName === 'platform_role_permissions' || lowerName === 'roles' || lowerName === 'permissions') {
      // Platform master configurations are NOT tenant/order data
      // Check if user wants master config kept
    }

    const rowsDeleted = Math.max(0, totalRows - rowsKept);

    report.push({
      tableName,
      modelName: modelInfo ? modelInfo.modelName : '(Raw SQL Table)',
      totalRows,
      rowsKept,
      rowsDeleted,
      hasTenantId: modelInfo ? modelInfo.rawAttributes.includes('tenant_id') : false,
      hasUserId: modelInfo ? modelInfo.rawAttributes.includes('user_id') : false,
    });
  }

  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

runDiscovery().catch(err => {
  console.error('Discovery failed:', err);
  process.exit(1);
});
