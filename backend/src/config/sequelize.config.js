require('dotenv').config();
const config = require('./env');

const dbConfig = {
  username: config.db.user,
  password: config.db.password,
  database: config.db.name,
  host: config.db.host,
  port: config.db.port,
  dialect: config.db.dialect,
  define: {
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
};

module.exports = {
  development: dbConfig,
  test: dbConfig,
  production: dbConfig,
};
