'use strict';

const { Client } = require('ssh2');
const fs = require('fs');

const SSH_CONFIG = {
  host: '34.93.11.164',
  port: 22,
  username: 'care',
  privateKey: fs.readFileSync('C:/Users/dines/.ssh/id_rsa'),
  readyTimeout: 30000,
};

const commands = [
  {
    title: '1. POSTGRESQL CONNECTIONS & DATABASE METRICS',
    cmd: `sudo -u postgres psql -d nanoshipy_db -c "SELECT count(*), state FROM pg_stat_activity WHERE datname='nanoshipy_db' GROUP BY state;" -c "SELECT datname, numbackends, xact_commit, xact_rollback, blks_read, blks_hit FROM pg_stat_database WHERE datname='nanoshipy_db';"`,
  },
  {
    title: '2. REDIS TELEMETRY (MEMORY & CLIENTS)',
    cmd: `redis-cli info memory | grep -E 'used_memory_human|used_memory_peak_human' && redis-cli info clients | grep 'connected_clients'`,
  },
  {
    title: '3. PM2 CLUSTER PROCESS TABLE & METRICS',
    cmd: `pm2 list`,
  },
  {
    title: '4. NGINX REVERSE PROXY HEALTH & ERROR LOGS',
    cmd: `sudo nginx -t && sudo tail -n 10 /var/log/nginx/error.log`,
  },
  {
    title: '5. LIVE BACKEND HTTP HEALTH PROBE',
    cmd: `curl -s http://127.0.0.1:5000/health`,
  },
];

async function runTelemetry() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve);
    conn.on('error', reject);
    conn.connect(SSH_CONFIG);
  });

  for (const item of commands) {
    console.log(`\n=====================================================`);
    console.log(`TELEMETRY SECTION: ${item.title}`);
    console.log(`COMMAND: ${item.cmd}`);
    console.log(`=====================================================`);

    await new Promise((resolve) => {
      conn.exec(item.cmd, (err, stream) => {
        if (err) {
          console.error('Execution error:', err.message);
          return resolve();
        }
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', () => resolve());
      });
    });
  }

  conn.end();
}

runTelemetry().catch(console.error);
