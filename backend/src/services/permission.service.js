const permissionRepo = require('../repositories/permission.repository');

const getPermissionCatalogue = async () => {
  const permissions = await permissionRepo.findAll();
  
  // Group by module_name
  const grouped = permissions.reduce((acc, perm) => {
    const mod = perm.module_name || 'other';
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push({
      key: perm.key,
      description: perm.description,
    });
    return acc;
  }, {});

  return grouped;
};

module.exports = {
  getPermissionCatalogue,
};
