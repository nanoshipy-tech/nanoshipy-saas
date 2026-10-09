require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const sequelize = require('../src/config/db.config');
const { PlatformAdmin } = require('../src/models');

const seedSuperAdmin = async () => {
  try {
    await sequelize.authenticate();
    
    // We must manually ensure the models are synced/registered since we are running isolated
    const models = require('../src/models');
    
    const email = process.argv[2];
    const password = process.argv[3];
    
    if (!email || !password) {
      console.error('Usage: node scripts/seedFirstSuperAdmin.js <email> <password>');
      process.exit(1);
    }
    
    const existing = await models.PlatformAdmin.findOne({ where: { email } });
    if (existing) {
      console.error('A platform admin with this email already exists.');
      process.exit(1);
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const admin = await models.PlatformAdmin.create({
      id: uuidv4(),
      name: 'Initial Super Admin',
      email,
      password_hash,
      role: 'super_admin',
      status: 'active',
      two_factor_enabled: false,
    });

    console.log(`Successfully created Super Admin! ID: ${admin.id}`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed Super Admin:', error);
    process.exit(1);
  }
};

seedSuperAdmin();
