'use strict';

const fs = require('fs');
const path = require('path');
const sequelize = require('../src/config/db.config');

async function verifyAll() {
  await sequelize.authenticate();
  const [tables] = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC");
  const report = [];
  let totalRows = 0;

  for (const t of tables) {
    try {
      const [res] = await sequelize.query(`SELECT COUNT(*) as c FROM "${t.name}"`);
      const count = parseInt(res[0].c, 10);
      totalRows += count;
      report.push({ table: t.name, rows: count });
    } catch {
      report.push({ table: t.name, rows: 0 });
    }
  }

  console.log('Total database tables:', report.length);
  console.log('Total database rows:', totalRows);
  console.log('\n--- All Tables with Rows Remaining ---');
  report.filter(r => r.rows > 0).forEach(r => {
    console.log(`  ${r.table.padEnd(35)} : ${r.rows}`);
  });

  const emptyTables = report.filter(r => r.rows === 0);
  console.log(`\nEmpty Tables Count: ${emptyTables.length} / ${report.length}`);

  process.exit(0);
}

verifyAll().catch(err => {
  console.error(err);
  process.exit(1);
});
