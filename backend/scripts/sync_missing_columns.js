'use strict';

require('dotenv').config();
const { sequelize } = require('../src/models');

async function syncMissingColumns() {
  const queryInterface = sequelize.getQueryInterface();
  const models = sequelize.models;

  for (const modelName of Object.keys(models)) {
    const model = models[modelName];
    const tableName = model.getTableName();
    
    // tableName could be object { schema, tableName } or string
    const tableStr = typeof tableName === 'object' ? tableName.tableName : tableName;

    try {
      const tableInfo = await queryInterface.describeTable(tableStr);
      const attributes = model.rawAttributes;

      for (const attrName of Object.keys(attributes)) {
        const attr = attributes[attrName];
        const fieldName = attr.field || attrName;

        if (!tableInfo[fieldName]) {
          console.log(`[Adding Column] Table: ${tableStr}, Column: ${fieldName}`);
          try {
            await queryInterface.addColumn(tableStr, fieldName, attr);
            console.log(`✅ Added ${fieldName} to ${tableStr}`);
          } catch (colErr) {
            console.warn(`⚠️ Failed to add ${fieldName} to ${tableStr}: ${colErr.message}`);
          }
        }
      }
    } catch (err) {
      // Table might not exist yet or other error
      // console.log(`Table ${tableStr} describe error:`, err.message);
    }
  }

  console.log('Finished checking missing columns.');
}

syncMissingColumns()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
