'use strict';

const fs = require('fs');
const path = require('path');
const sequelize = require('../src/config/db.config');

async function main() {
  const [tables] = await sequelize.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  const fkMap = {};
  for (const t of tables) {
    let fkList;
    try {
      const res = await sequelize.query(`PRAGMA foreign_key_list("${t.name}")`);
      fkList = Array.isArray(res) ? (Array.isArray(res[0]) ? res[0] : res) : [];
    } catch {
      fkList = [];
    }
    if (Array.isArray(fkList) && fkList.length > 0) {
      fkMap[t.name] = fkList.map(f => ({
        to: f.table,
        from: f.from,
        target: f.to,
        on_delete: f.on_delete,
      }));
    }
  }

  fs.writeFileSync(
    path.join(__dirname, 'fk_map.json'),
    JSON.stringify(fkMap, null, 2)
  );

  console.log(`Extracted FKs for ${Object.keys(fkMap).length} tables.`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
