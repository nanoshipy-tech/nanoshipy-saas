'use strict';

require('dotenv').config();
const { sequelize, StCourierDistrictRate } = require('../src/models');

const TN_DISTRICTS = [
  'Ariyalur',
  'Chengalpattu',
  'Chennai',
  'Coimbatore',
  'Cuddalore',
  'Dharmapuri',
  'Dindigul',
  'Erode',
  'Kallakurichi',
  'Kanchipuram',
  'Kanyakumari',
  'Kanniyakumari',
  'Karur',
  'Krishnagiri',
  'Madurai',
  'Mayiladuthurai',
  'Nagapattinam',
  'Namakkal',
  'Nilgiris',
  'Perambalur',
  'Pudukkottai',
  'Ramanathapuram',
  'Ranipet',
  'Salem',
  'Sivaganga',
  'Tenkasi',
  'Thanjavur',
  'Theni',
  'Thoothukudi',
  'Tiruchirappalli',
  'Tirunelveli',
  'Tirupathur',
  'Tiruppur',
  'Tiruvallur',
  'Tiruvannamalai',
  'Tiruvarur',
  'Vellore',
  'Viluppuram',
  'Virudhunagar',
];

async function migrateAndSeed() {
  console.log('--- Migrating st_courier_district_rates Table ---');
  await StCourierDistrictRate.sync({ alter: true });
  console.log('st_courier_district_rates table synced successfully.');

  console.log('--- Seeding District Rate Cards ---');
  for (const district of TN_DISTRICTS) {
    const existing = await StCourierDistrictRate.findOne({
      where: { destination_district: district },
    });

    if (!existing) {
      await StCourierDistrictRate.create({
        destination_district: district,
        first_500g_rate: 30.00,
        additional_500g_rate: 15.00,
        above_10kg_per_kg_rate: 25.00,
        cod_first_500g_rate: 50.00,
        cod_additional_500g_rate: 20.00,
        cod_above_10kg_per_kg_rate: 35.00,
        is_active: true,
      });
      console.log(`+ Seeded district rate for: ${district}`);
    } else {
      console.log(`= District rate exists for: ${district}`);
    }
  }

  console.log('--- Migration & Seeding Complete ---');
  process.exit(0);
}

migrateAndSeed().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
