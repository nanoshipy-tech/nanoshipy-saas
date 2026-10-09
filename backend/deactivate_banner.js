require('dotenv').config({ path: '/var/www/nanoshipy/Saas-Frontend-main/backend/.env' });
const { Banner } = require('./src/models');

async function main() {
  const all = await Banner.findAll();
  console.log('CURRENT BANNERS IN DB:', JSON.stringify(all.map(x => ({ id: x.id, mode: x.mode, is_active: x.is_active })), null, 2));

  // Deactivate all banners so no banner loads in user panel!
  const res = await Banner.update({ is_active: false }, { where: {} });
  console.log('Deactivated result:', res);

  const active = await Banner.findOne({ where: { is_active: true } });
  console.log('ACTIVE BANNER NOW:', active ? active.id : 'NONE (null)');
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
