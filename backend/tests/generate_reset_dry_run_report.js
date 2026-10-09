'use strict';

const fs = require('fs');
const path = require('path');
const sequelize = require('../src/config/db.config');
const models = require('../src/models');

async function generateReport() {
  await sequelize.authenticate();

  const queryInterface = sequelize.getQueryInterface();
  const rawTables = await queryInterface.showAllTables();
  const tables = rawTables
    .map(t => (typeof t === 'object' ? t.tableName || Object.values(t)[0] : t))
    .filter(t => !t.toLowerCase().startsWith('sqlite_'))
    .sort();

  // Map each table to its model and categorise
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

  // Group definitions
  const GROUPS = {
    '1. Tenant & User Management': [
      'tenants', 'users', 'sub_users', 'roles', 'permissions'
    ],
    '2. Financial Ledger & Invoicing': [
      'wallets', 'wallet_transactions', 'wallet_recharge_transactions', 'recharge_orders',
      'invoices', 'invoice_line_items', 'invoice_sequences', 'credit_notes', 'cod_remittances'
    ],
    '3. Operational Shipping, NDR & RTO': [
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
      'carrier_margin_configs', 'provider_health_logs', 'tenant_courier_accesses',
      'subscription_plans', 'tenant_subscriptions', 'plan_usage_trackings', 'plan_change_histories',
      'payment_gateways', 'system_sequences'
    ],
    '8. Communications, Support & Storefronts': [
      'notification_templates', 'notification_preferences', 'notification_logs', 'in_app_notifications',
      'whatsapp_templates', 'whatsapp_bsp_configs', 'support_tickets', 'ticket_messages', 'ticket_attachments',
      'storefront_connections', 'storefront_sync_logs', 'analytics_daily_snapshots', 'tenant_settings',
      'tenant_integration_configs', 'settings_change_history'
    ]
  };

  const rows = [];
  let totalDbRows = 0;
  let totalKeptRows = 0;
  let totalDeletedRows = 0;

  for (const tableName of tables) {
    let count = 0;
    try {
      const [res] = await sequelize.query(`SELECT COUNT(*) as c FROM "${tableName}"`);
      count = parseInt(res[0].c || res[0].count || 0, 10);
    } catch {
      try {
        const [res] = await sequelize.query(`SELECT COUNT(*) as c FROM \`${tableName}\``);
        count = parseInt(res[0].c || res[0].count || 0, 10);
      } catch {}
    }

    let kept = 0;
    // In our reset, only the 2 accounts are kept
    if (tableName === 'platform_admins' && targetAdmin) {
      kept = 1;
    } else if (tableName === 'users' && targetUser) {
      kept = 1;
    } else if (tableName === 'tenants' && targetUser) {
      kept = 1;
    } else if (tableName === 'wallets' && targetUser) {
      kept = 1;
    }

    const deleted = Math.max(0, count - kept);

    totalDbRows += count;
    totalKeptRows += kept;
    totalDeletedRows += deleted;

    // Find group
    let assignedGroup = '9. Other Uncategorised Tables';
    for (const [groupName, tableList] of Object.entries(GROUPS)) {
      if (tableList.includes(tableName)) {
        assignedGroup = groupName;
        break;
      }
    }

    rows.push({
      group: assignedGroup,
      table: tableName,
      total: count,
      kept,
      deleted
    });
  }

  // Save report to JSON for clean programmatic access
  fs.writeFileSync(
    path.join(__dirname, 'reset_dry_run_data.json'),
    JSON.stringify({
      targetUser: targetUser ? targetUser.toJSON() : null,
      targetAdmin: targetAdmin ? targetAdmin.toJSON() : null,
      summary: { totalDbRows, totalKeptRows, totalDeletedRows },
      rows
    }, null, 2)
  );

  console.log(`Summary: Total Rows: ${totalDbRows}, Rows to Keep: ${totalKeptRows}, Rows to Delete: ${totalDeletedRows}`);
  console.log(`Report generated successfully.`);
  process.exit(0);
}

generateReport().catch(err => {
  console.error(err);
  process.exit(1);
});
