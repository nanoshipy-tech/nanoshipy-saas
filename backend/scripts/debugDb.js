const { Role, Permission, Tenant, User } = require('../src/models');
const sequelize = require('../src/config/db.config');

const run = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected to DB');
    
    const roles = await Role.findAll();
    console.log('Roles found:', roles.map(r => r.toJSON()));

    const permissions = await Permission.findAll();
    console.log('Permissions count:', permissions.length);

    const tenants = await Tenant.findAll();
    console.log('Tenants:', tenants.map(t => t.toJSON()));

    const users = await User.findAll();
    console.log('Users:', users.map(u => u.toJSON()));

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
};

run();
