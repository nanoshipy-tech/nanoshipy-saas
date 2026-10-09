'use strict';
// Fix script: assign ALL permissions to both global and tenant owner roles
const db = require('../src/config/db.config');

async function fixOwnerRolePermissions() {
  console.log('Connecting to database...');
  await db.authenticate();

  // Fetch all permissions
  const [allPerms] = await db.query('SELECT id, key FROM permissions ORDER BY key');
  console.log(`Total permissions in DB: ${allPerms.length}`);

  // Find all owner roles (both global and tenant-specific)
  const [ownerRoles] = await db.query(
    "SELECT id, tenant_id, is_system_role FROM roles WHERE name = 'owner'"
  );
  console.log(`Found ${ownerRoles.length} owner role(s)`);

  for (const role of ownerRoles) {
    const label = role.tenant_id ? `tenant owner (${role.tenant_id})` : 'global system owner';
    
    // Find already-assigned permission IDs for this role
    const [existing] = await db.query(
      'SELECT permission_id FROM role_permissions WHERE role_id = $1',
      { bind: [role.id] }
    );
    const existingSet = new Set(existing.map(r => r.permission_id));
    
    const toAdd = allPerms.filter(p => !existingSet.has(p.id));
    
    if (toAdd.length === 0) {
      console.log(`  [OK] ${label} already has all ${allPerms.length} permissions`);
      continue;
    }
    
    for (const perm of toAdd) {
      await db.query(
        'INSERT INTO role_permissions(role_id, permission_id) VALUES($1, $2) ON CONFLICT DO NOTHING',
        { bind: [role.id, perm.id] }
      );
    }
    console.log(`  [FIXED] Added ${toAdd.length} permissions to ${label} (${role.id})`);
  }

  console.log('\nDone! All owner roles now have all permissions.');
  process.exit(0);
}

fixOwnerRolePermissions().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
