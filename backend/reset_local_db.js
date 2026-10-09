const { Client } = require('pg');
const bcrypt = require('bcrypt');

const client = new Client({
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'shipping_saas'
});

async function reset() {
  await client.connect();
  console.log('Connected to local PostgreSQL database [shipping_saas]...');

  // Truncate operational & log tables cleanly
  const tables = [
    'webhook_deliveries', 'tenant_webhooks', 'api_key_usage_logs', 'api_keys',
    'in_app_notifications', 'notification_logs', 'support_tickets', 'ticket_messages',
    'ticket_attachments', 'analytics_daily_snapshots', 'credit_notes', 'invoice_line_items',
    'invoices', 'wallet_transactions', 'wallet_recharge_requests', 'recharge_orders',
    'wallets', 'rto_records', 'ndr_actions', 'ndr_events', 'tracking_events',
    'shipment_status_histories', 'shipment_rate_quotes', 'shipments',
    'order_status_histories', 'order_items', 'order_imports', 'orders',
    'provider_health_logs', 'pickup_addresses', 'company_documents', 'settings_change_history',
    'tenant_settings', 'audit_logs', 'platform_audit_logs', 'refresh_tokens',
    'platform_refresh_tokens', 'weight_discrepancy_disputes', 'cod_remittances',
    'users', 'tenants', 'platform_admins'
  ];

  console.log('Clearing old data and logs...');
  for (const table of tables) {
    try {
      await client.query(`TRUNCATE TABLE "${table}" CASCADE;`);
    } catch (e) {
      // Table might not exist or already clear
    }
  }

  console.log('Creating fresh Superadmin account...');
  const adminHash = await bcrypt.hash('admin@123', 10);
  await client.query(`
    INSERT INTO platform_admins (id, email, password_hash, name, role, created_at, updated_at)
    VALUES ('a1111111-1111-4111-8111-111111111111', 'admin@gmail.com', '${adminHash}', 'Super Admin', 'super_admin', NOW(), NOW());
  `);
  console.log('✅ Admin account created: admin@gmail.com / admin@123');

  // Ensure default role exists
  let roleId = 'b1111111-1111-4111-8111-111111111111';
  const roleRes = await client.query(`SELECT id FROM roles WHERE name = 'owner' LIMIT 1;`);
  if (roleRes.rows.length > 0) {
    roleId = roleRes.rows[0].id;
  } else {
    await client.query(`
      INSERT INTO roles (id, name, is_system_role, created_at, updated_at)
      VALUES ('${roleId}', 'owner', true, NOW(), NOW());
    `);
  }

  // Create default tenant 'test'
  const tenantId = 'c1111111-1111-4111-8111-111111111111';
  await client.query(`
    INSERT INTO tenants (id, company_name, subdomain, status, created_at, updated_at)
    VALUES ('${tenantId}', 'Test Logistics', 'test', 'active', NOW(), NOW());
  `);
  console.log('✅ Default tenant created: workspace "test"');

  // Create default user test@gmail.com / test@123
  const userHash = await bcrypt.hash('test@123', 10);
  await client.query(`
    INSERT INTO users (id, tenant_id, role_id, name, email, password_hash, status, created_at, updated_at)
    VALUES ('d1111111-1111-4111-8111-111111111111', '${tenantId}', '${roleId}', 'Test User', 'test@gmail.com', '${userHash}', 'active', NOW(), NOW());
  `);
  console.log('✅ Default user created: test@gmail.com / test@123');

  // Create wallet for test tenant
  await client.query(`
    INSERT INTO wallets (id, tenant_id, balance, currency, created_at, updated_at)
    VALUES ('e1111111-1111-4111-8111-111111111111', '${tenantId}', 5000.00, 'INR', NOW(), NOW());
  `);
  console.log('✅ Wallet seeded with ₹5000.00 balance');

  await client.end();
  console.log('\n=== LOCAL DATABASE CLEAN RESET COMPLETE ===');
}

reset().catch(err => {
  console.error('Reset error:', err.message);
  process.exit(1);
});
