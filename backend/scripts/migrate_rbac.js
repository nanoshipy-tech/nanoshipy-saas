'use strict';

require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../src/config/db.config');
const {
  ADMIN_MODULES,
  USER_MODULES,
  getAllAdminPermissionKeys,
} = require('../src/constants/rbacCatalog.constant');

async function migrateRbac() {
  console.log('=== [RBAC Migration] Starting Additive RBAC Migration ===');

  // 1. Create platform_roles table if not exists
  console.log('[1/5] Ensuring platform_roles table exists...');
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS platform_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(50) NOT NULL UNIQUE,
      display_name VARCHAR(100) NOT NULL,
      description VARCHAR(255),
      is_system BOOLEAN NOT NULL DEFAULT false,
      created_by UUID,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_platform_roles_name ON platform_roles(name);
  `);

  // 2. Add custom_role_id to platform_admins table if not exists
  console.log('[2/5] Ensuring custom_role_id column exists on platform_admins...');
  await sequelize.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'platform_admins' AND column_name = 'custom_role_id'
      ) THEN
        ALTER TABLE platform_admins ADD COLUMN custom_role_id UUID REFERENCES platform_roles(id) ON DELETE SET NULL;
      END IF;
    END $$;
  `);

  // 3. Upsert all Admin Permissions into platform_permissions
  console.log('[3/5] Seeding Admin Permissions into platform_permissions...');
  for (const mod of ADMIN_MODULES) {
    for (const action of mod.actions) {
      const key = `${mod.moduleKey}.${action}`;
      const desc = `${action.toUpperCase()} permission for ${mod.label}`;
      await sequelize.query(`
        INSERT INTO platform_permissions (id, key, module_name, description, created_at, updated_at)
        VALUES ('${uuidv4()}', '${key}', '${mod.moduleKey}', '${desc.replace(/'/g, "''")}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET
          module_name = EXCLUDED.module_name,
          description = EXCLUDED.description,
          updated_at = CURRENT_TIMESTAMP;
      `);
    }
  }

  // 4. Upsert all User Permissions into permissions table
  console.log('[4/5] Seeding User Permissions into permissions...');
  for (const mod of USER_MODULES) {
    for (const action of mod.actions) {
      const key = `${mod.moduleKey}.${action}`;
      const desc = `${action.toUpperCase()} permission for ${mod.label}`;
      await sequelize.query(`
        INSERT INTO permissions (id, key, module_name, description, created_at, updated_at)
        VALUES ('${uuidv4()}', '${key}', '${mod.moduleKey}', '${desc.replace(/'/g, "''")}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (key) DO UPDATE SET
          module_name = EXCLUDED.module_name,
          description = EXCLUDED.description,
          updated_at = CURRENT_TIMESTAMP;
      `);
    }
  }

  // 5. Seed default system platform roles into platform_roles
  console.log('[5/5] Seeding default Platform System Roles...');
  const systemRoles = [
    {
      name: 'super_admin',
      displayName: 'Super Administrator',
      description: 'Unrestricted master access across all platform modules and data',
      isSystem: true,
    },
    {
      name: 'platform_staff',
      displayName: 'Platform Staff',
      description: 'General platform operations, ticket resolution, and seller inspection',
      isSystem: true,
    },
    {
      name: 'finance',
      displayName: 'Finance Auditor',
      description: 'COD remittances, wallet adjustments, recharge auditing, and invoice management',
      isSystem: true,
    },
    {
      name: 'support_agent',
      displayName: 'Support Agent',
      description: 'Merchant customer support, ticket response, and shipment tracking inquiries',
      isSystem: true,
    },
    {
      name: 'key_account_manager',
      displayName: 'Key Account Manager',
      description: 'Seller health, volume monitoring, dedicated merchant support, and performance reports',
      isSystem: true,
    },
  ];

  for (const r of systemRoles) {
    await sequelize.query(`
      INSERT INTO platform_roles (id, name, display_name, description, is_system, created_at, updated_at)
      VALUES ('${uuidv4()}', '${r.name}', '${r.displayName}', '${r.description}', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (name) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        description = EXCLUDED.description,
        is_system = true,
        updated_at = CURRENT_TIMESTAMP;
    `);
  }

  // Map all platform permissions to super_admin in platform_role_permissions
  const [perms] = await sequelize.query(`SELECT id, key FROM platform_permissions;`);
  for (const p of perms) {
    await sequelize.query(`
      INSERT INTO platform_role_permissions (role, permission_id, created_at, updated_at)
      VALUES ('super_admin', '${p.id}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT DO NOTHING;
    `);
  }

  console.log('=== [RBAC Migration] Successfully Completed! ===');
}

if (require.main === module) {
  migrateRbac()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[RBAC Migration Error]', err);
      process.exit(1);
    });
}

module.exports = migrateRbac;
