'use strict';

const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
conn.on('ready', () => {
  const nodeScript = `
    const { PlatformSetting } = require('./src/models');
    const { decrypt } = require('./src/utils/encryption.util');
    async function check() {
      const setting = await PlatformSetting.findOne({ where: { setting_key: 'smtp_password_encrypted' } });
      if (!setting) {
        console.log('No password setting found');
        return;
      }
      console.log('Ciphertext:', setting.setting_value);
      try {
        const plain = decrypt(setting.setting_value);
        console.log('Decrypted Length:', plain ? plain.length : 0);
        console.log('Decrypted Plaintext Value:', plain);
      } catch (e) {
        console.error('Decryption failed:', e.message);
      }
    }
    check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
  `;
  const cmd = `cd /var/www/nanoshipy/Saas-Frontend-main/backend && node -e "${nodeScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
});

conn.connect({
  host: '34.93.11.164',
  port: 22,
  username: 'care',
  privateKey: fs.readFileSync('C:/Users/dines/.ssh/id_rsa'),
});
