'use strict';

require('dotenv').config();
const { PincodeMaster, sequelize } = require('./src/models');

const SAMPLE_PINCODES = [
  { pincode: '110001', district: 'Central Delhi', state: 'Delhi', city: 'New Delhi', is_serviceable: true, source: 'seed' },
  { pincode: '400001', district: 'Mumbai', state: 'Maharashtra', city: 'Mumbai', is_serviceable: true, source: 'seed' },
  { pincode: '560001', district: 'Bangalore', state: 'Karnataka', city: 'Bengaluru', is_serviceable: true, source: 'seed' },
  { pincode: '600001', district: 'Chennai', state: 'Tamil Nadu', city: 'Chennai', is_serviceable: true, source: 'seed' },
  { pincode: '700001', district: 'Kolkata', state: 'West Bengal', city: 'Kolkata', is_serviceable: true, source: 'seed' },
  { pincode: '500001', district: 'Hyderabad', state: 'Telangana', city: 'Hyderabad', is_serviceable: true, source: 'seed' },
  { pincode: '380001', district: 'Ahmedabad', state: 'Gujarat', city: 'Ahmedabad', is_serviceable: true, source: 'seed' },
  { pincode: '411001', district: 'Pune', state: 'Maharashtra', city: 'Pune', is_serviceable: true, source: 'seed' },
  { pincode: '302001', district: 'Jaipur', state: 'Rajasthan', city: 'Jaipur', is_serviceable: true, source: 'seed' },
  { pincode: '226001', district: 'Lucknow', state: 'Uttar Pradesh', city: 'Lucknow', is_serviceable: true, source: 'seed' },
];

async function seedPincodes() {
  await sequelize.sync({ force: false });
  const count = await PincodeMaster.count();
  if (count > 0) {
    console.log(`[PincodeSeed] Table pincode_master already contains ${count} rows. Skipping auto-seed to prevent overwriting existing data.`);
    process.exit(0);
  }

  console.log(`[PincodeSeed] Table pincode_master is empty. Seeding ${SAMPLE_PINCODES.length} sample Indian pincodes...`);
  for (const item of SAMPLE_PINCODES) {
    await PincodeMaster.upsert(item);
  }

  console.log('[PincodeSeed] Sample pincodes seeded successfully!');
  process.exit(0);
}

seedPincodes().catch((err) => {
  console.error('[PincodeSeed] Seeding error:', err);
  process.exit(1);
});
