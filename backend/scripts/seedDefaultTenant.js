require('dotenv').config();
const authService = require('../src/services/auth.service');
const { Tenant, User } = require('../src/models');
const sequelize = require('../src/config/db.config');

const seedDefaultTenant = async () => {
  try {
    await sequelize.authenticate();
    
    // Explicitly load models to register relationships
    require('../src/models');

    const subdomain = 'acme';
    const email = 'admin@acme.com';
    const password = 'Password123!';

    const existing = await Tenant.findOne({ where: { subdomain } });
    if (existing) {
      console.log(`Tenant with subdomain "${subdomain}" already exists.`);
      process.exit(0);
    }

    console.log('Registering default tenant (acme)...');
    const result = await authService.register({
      company_name: 'Acme Corp',
      subdomain,
      name: 'Acme Admin',
      email,
      password,
      phone: '1234567890'
    });

    console.log('Activating tenant and user accounts in database...');
    await Tenant.update({ status: 'active' }, { where: { id: result.tenant_id } });
    await User.update({ status: 'active', email_verified_at: new Date() }, { where: { id: result.user_id } });

    console.log('\nSuccess! Created Default Tenant:');
    console.log(`Subdomain: ${subdomain}`);
    console.log(`Email:     ${email}`);
    console.log(`Password:  ${password}`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed default tenant:', error);
    process.exit(1);
  }
};

seedDefaultTenant();
