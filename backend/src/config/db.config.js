const { Sequelize } = require('sequelize');
const config = require('./env');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

let sequelize;

if (process.env.USE_SQLITE === 'true') {
  const dbPath = path.join(__dirname, '..', '..', 'database.sqlite');
  logger.info(`[DB] Using SQLite local database at: ${dbPath}`);
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: dbPath,
    logging: (msg) => {
      if (config.nodeEnv === 'development') {
        logger.debug(msg);
      }
    },
    define: {
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  });
} else {
  sequelize = new Sequelize(
    config.db.name,
    config.db.user,
    config.db.password,
    {
      host: config.db.host,
      port: config.db.port,
      dialect: 'postgres',
      pool: config.db.pool,
      logging: (msg) => {
        if (config.nodeEnv === 'development') {
          logger.debug(msg);
        }
      },
      define: {
        underscored: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    }
  );
}

module.exports = sequelize;
