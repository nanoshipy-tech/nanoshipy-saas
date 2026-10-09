'use strict';

const axios = require('axios');
const http = require('http');
const https = require('https');

// Connection pooling agents
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

/**
 * Creates an Axios client instance configured with connection pooling, timeout, and defaults.
 *
 * @param {string} baseURL
 * @param {number} timeoutMs
 * @returns {import('axios').AxiosInstance}
 */
const createClient = (baseURL, timeoutMs = 5000) => {
  return axios.create({
    baseURL,
    timeout: timeoutMs,
    httpAgent,
    httpsAgent,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });
};

module.exports = {
  createClient,
};
