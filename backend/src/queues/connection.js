'use strict';

const config = require('../config/env');
const RedisMock = require('ioredis-mock');

let connection;

if (process.env.USE_MOCK_REDIS === 'true') {
  connection = new RedisMock();
} else {
  connection = {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

module.exports = { connection };
