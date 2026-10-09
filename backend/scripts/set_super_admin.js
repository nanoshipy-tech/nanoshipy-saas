'use strict';
const { Client } = require('ssh2');
const fs = require('fs');

const remoteScript = `
require('dotenv').config();
const { PlatformAdmin } = require('./src/models');
const redis = require('./src/config/redis.config');

async function fixAdmin() {
  console.log('Setting care@nanoshipy.com to super_admin...');
  await PlatformAdmin.update(
    { role: 'super_admin' },
    { where: { email: 'care@nanoshipy.com' } }
  );

  const updated = await PlatformAdmin.findOne({ where: { email: 'care@nanoshipy.com' } });
  console.log('Updated admin:', {
    id: updated.id,
    email: updated.email,
    role: updated.role,
  });

  // Flush redis platform permissions
  try {
    const keys = await redis.keys('platform_perm:*');
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log('Flushed redis keys:', keys);
    } else {
      console.log('No platform_perm keys to flush in redis');
    }
  } catch (e) {
    console.error('Redis error:', e.message);
  }

  process.exit(0);
}

fixAdmin().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
`;

const b64 = Buffer.from(remoteScript).toString('base64');
const cmd = `cd /var/www/nanoshipy/Saas-Frontend-main/backend && node -e "eval(Buffer.from('${b64}','base64').toString())"`;

const conn = new Client();
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error('Exec error:', err);
      conn.end();
      process.exit(1);
    }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', code => {
      conn.end();
      process.exit(code);
    });
  });
}).on('error', err => {
  console.error('Connection error:', err);
  process.exit(1);
}).connect({
  host: '34.93.11.164',
  port: 22,
  username: 'care',
  privateKey: fs.readFileSync('C:\\Users\\dines\\.ssh\\id_rsa'),
  readyTimeout: 30000,
});
