'use strict';

const fs = require('fs');
const path = require('path');
const sequelize = require('../src/config/db.config');
const models = require('../src/models');

async function main() {
  await sequelize.authenticate();

  const queryInterface = sequelize.getQueryInterface();
  const rawTables = await queryInterface.showAllTables();
  const tables = rawTables
    .map(t => (typeof t === 'object' ? t.tableName || Object.values(t)[0] : t))
    .filter(t => !t.toLowerCase().startsWith('sqlite_'))
    .sort();

  // Model & Attribute mappings
  const modelByTable = {};
  for (const [mName, m] of Object.entries(models)) {
    if (m && m.tableName) {
      modelByTable[m.tableName.toLowerCase()] = {
        name: mName,
        model: m,
        attributes: m.rawAttributes || {},
        associations: m.associations || {},
      };
    }
  }

  // Check target accounts
  const { User, Tenant, PlatformAdmin } = models;

  const targetUser = await User.findOne({
    where: sequelize.where(
      sequelize.fn('LOWER', sequelize.col('email')),
      'demo@nanoshipy.com'
    )
  }).catch(() => null);

  const targetAdmin = await PlatformAdmin.findOne({
    where: sequelize.where(
      sequelize.fn('LOWER', sequelize.col('email')),
      'care@nanoshipy.com'
    )
  }).catch(() => null);

  const demoTenantId = targetUser ? targetUser.tenant_id : '0ff1b049-d711-4605-b86e-0f10723c0602';
  const demoUserId = targetUser ? targetUser.id : '3413e892-3a82-488a-b594-74a7455a0d1d';

  // Group definitions
  const CATEGORIES = {
    '1. Tenant & User Hierarchy': [
      'tenants', 'users', 'sub_users', 'roles', 'permissions', 'role_permissions'
    ],
    '2. Financial Ledger, Wallets & Invoicing': [
      'wallets', 'wallet_transactions', 'wallet_recharge_transactions', 'recharge_orders',
      'invoices', 'invoice_line_items', 'invoice_sequences', 'credit_notes', 'cod_remittances'
    ],
    '3. Operational Orders, Shipments, NDR & RTO': [
      'orders', 'order_items', 'order_status_histories', 'order_imports',
      'shipments', 'shipment_rate_quotes', 'shipment_status_histories',
      'tracking_events', 'manifests', 'ndr_events', 'ndr_actions', 'rto_records',
      'weight_discrepancy_disputes', 'shipments_backup'
    ],
    '4. Warehouse, Pincodes & KYC Documents': [
      'pickup_addresses', 'company_documents', 'kyc_documents', 'pincode_master', 'address_lookup_audit_logs'
    ],
    '5. Authentication, Sessions & Security': [
      'refresh_tokens', 'password_reset_tokens', 'api_keys', 'api_key_usage_logs',
      'tenant_webhooks', 'webhook_deliveries', 'webhook_idempotency', 'webhook_logs'
    ],
    '6. Platform Admin & System Operations': [
      'platform_admins', 'platform_refresh_tokens', 'platform_audit_logs',
      'platform_permissions', 'platform_role_permissions', 'impersonation_sessions',
      'platform_settings', 'platform_integrations'
    ],
    '7. Carrier Master, Rates & Subscriptions': [
      'courier_providers', 'courier_cost_rates', 'rate_cards', 'rate_card_upload_logs',
      'cost_rate_snapshots', 'markup_config', 'cod_markup_config', 'rto_markup_config',
      'carrier_margin_configs', 'provider_health_logs', 'tenant_courier_access',
      'subscription_plans', 'tenant_subscriptions', 'plan_usage_tracking', 'plan_change_history',
      'payment_gateways', 'system_sequences'
    ],
    '8. Communications, Support & Storefronts': [
      'notification_templates', 'notification_preferences', 'notification_logs', 'in_app_notifications',
      'whatsapp_templates', 'whatsapp_bsp_configs', 'support_tickets', 'ticket_messages', 'ticket_attachments',
      'storefront_connections', 'storefront_sync_logs', 'analytics_daily_snapshots', 'tenant_settings',
      'tenant_integration_configs', 'settings_change_history'
    ]
  };

  const results = [];

  for (const tableName of tables) {
    let total = 0;
    try {
      const [res] = await sequelize.query(`SELECT COUNT(*) as c FROM "${tableName}"`);
      total = parseInt(res[0].c || 0, 10);
    } catch {
      try {
        const [res] = await sequelize.query(`SELECT COUNT(*) as c FROM \`${tableName}\``);
        total = parseInt(res[0].c || 0, 10);
      } catch {}
    }

    const mInfo = modelByTable[tableName.toLowerCase()];
    const attrs = mInfo ? Object.keys(mInfo.attributes) : [];

    // Check how many rows currently belong to target demo account
    let demoRowCount = 0;
    if (attrs.includes('tenant_id')) {
      try {
        const [res] = await sequelize.query(`SELECT COUNT(*) as c FROM "${tableName}" WHERE tenant_id = '${demoTenantId}'`);
        demoRowCount = parseInt(res[0].c || 0, 10);
      } catch {}
    } else if (attrs.includes('user_id')) {
      try {
        const [res] = await sequelize.query(`SELECT COUNT(*) as c FROM "${tableName}" WHERE user_id = '${demoUserId}'`);
        demoRowCount = parseInt(res[0].c || 0, 10);
      } catch {}
    }

    // Determine category
    let cat = '9. Miscellaneous';
    for (const [cName, tList] of Object.entries(CATEGORIES)) {
      if (tList.includes(tableName)) {
        cat = cName;
        break;
      }
    }

    // How many rows kept
    let rowsKept = 0;
    let rowsDeleted = total;

    if (tableName === 'users') {
      rowsKept = 1; // demo@nanoshipy.com
      rowsDeleted = Math.max(0, total - rowsKept);
    } else if (tableName === 'tenants') {
      rowsKept = 1; // demo merchant tenant
      rowsDeleted = Math.max(0, total - rowsKept);
    } else if (tableName === 'wallets') {
      rowsKept = 1; // demo wallet (reset to 0)
      rowsDeleted = Math.max(0, total - rowsKept);
    } else if (tableName === 'platform_admins') {
      rowsKept = 1; // Care@nanoshipy.com
      rowsDeleted = Math.max(0, total - rowsKept);
    } else if ([
      'courier_providers', 'roles', 'permissions', 'role_permissions',
      'subscription_plans', 'pincode_master', 'payment_gateways',
      'notification_templates', 'platform_permissions', 'platform_role_permissions',
      'system_sequences'
    ].includes(tableName)) {
      // Platform Master Configuration tables
      rowsKept = total;
      rowsDeleted = 0;
    } else {
      // All other transactional / operational / log data
      rowsKept = 0;
      rowsDeleted = total;
    }

    results.push({
      category: cat,
      tableName,
      modelName: mInfo ? mInfo.name : '(No Sequelize Model)',
      hasTenantId: attrs.includes('tenant_id'),
      hasUserId: attrs.includes('user_id'),
      demoRowCount,
      totalRows: total,
      rowsKept,
      rowsDeleted,
    });
  }

  fs.writeFileSync(
    path.join(__dirname, 'phase1_phase2_complete_data.json'),
    JSON.stringify(results, null, 2)
  );

  console.log(`Generated complete data for ${results.length} tables.`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
