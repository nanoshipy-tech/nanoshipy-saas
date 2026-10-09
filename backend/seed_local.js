const { Client } = require('pg');
const bcrypt = require('bcrypt');

const client = new Client({
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'shipping_saas'
});

async function main() {
  await client.connect();
  console.log('Connected to local Postgres');

  // 1. Seed or Update Admin admin@nanoshipy.com / admin@123
  const adminHash = await bcrypt.hash('admin@123', 10);
  
  await client.query(`
    INSERT INTO platform_admins (id, email, password_hash, name, role, created_at, updated_at)
    VALUES ('a1111111-1111-4111-8111-111111111111', 'admin@nanoshipy.com', '${adminHash}', 'Super Admin', 'super_admin', NOW(), NOW())
    ON CONFLICT (email) DO UPDATE SET password_hash = '${adminHash}';
  `);
  console.log('✅ Admin user admin@nanoshipy.com / admin@123 created/updated in local DB');

  // 2. Ensure default role exists
  const roleRes = await client.query(`SELECT id FROM roles WHERE name = 'owner' LIMIT 1;`);
  let roleId;
  if (roleRes.rows.length > 0) {
    roleId = roleRes.rows[0].id;
  } else {
    const newRole = await client.query(`
      INSERT INTO roles (id, name, is_system_role, created_at, updated_at)
      VALUES ('b1111111-1111-4111-8111-111111111111', 'owner', true, NOW(), NOW())
      RETURNING id;
    `);
    roleId = newRole.rows[0].id;
  }

  // 3. Seed Tenant 'test'
  const tenantRes = await client.query(`
    INSERT INTO tenants (id, company_name, subdomain, status, created_at, updated_at)
    VALUES ('c1111111-1111-4111-8111-111111111111', 'Test Logistics', 'test', 'active', NOW(), NOW())
    ON CONFLICT (subdomain) DO UPDATE SET status = 'active'
    RETURNING id;
  `);
  const tenantId = tenantRes.rows[0].id;
  console.log('✅ Tenant test created/updated in local DB, ID:', tenantId);

  // 4. Seed User test@gmail.com / test@123
  const userHash = await bcrypt.hash('test@123', 10);
  await client.query(`DELETE FROM users WHERE email = 'test@gmail.com';`);
  await client.query(`
    INSERT INTO users (id, tenant_id, role_id, name, email, password_hash, status, created_at, updated_at)
    VALUES ('d1111111-1111-4111-8111-111111111111', '${tenantId}', '${roleId}', 'Test User', 'test@gmail.com', '${userHash}', 'active', NOW(), NOW());
  `);
  console.log('✅ User test@gmail.com / test@123 created/updated in local DB');

  await client.end();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
