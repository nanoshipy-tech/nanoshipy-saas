'use strict';

const { Client } = require('ssh2');
const fs = require('fs');

const SSH_CONFIG = {
  host: '34.93.11.164',
  port: 22,
  username: 'care',
  privateKey: fs.readFileSync('C:\\Users\\dines\\.ssh\\id_rsa'),
  readyTimeout: 60000,
};

async function verifyLive() {
  console.log('🧪 Connecting to Production VPS for Hybrid Architecture Verification...');
  const conn = new Client();

  conn.on('ready', () => {
    console.log('⚡ Connected. Uploading run_live_tests.js and executing...');

    conn.sftp((err, sftp) => {
      if (err) {
        console.error('SFTP error:', err);
        conn.end();
        process.exit(1);
      }

      const localFile = 'c:/Users/dines/.gemini/antigravity-ide/scratch/nanoshipy/shipping-saasd/Saas-Frontend-main/backend/scripts/run_live_tests.js';
      const remoteFile = '/var/www/nanoshipy/Saas-Frontend-main/backend/scripts/run_live_tests.js';

      sftp.fastPut(localFile, remoteFile, (uploadErr) => {
        if (uploadErr) {
          console.error('Upload failed:', uploadErr);
          conn.end();
          process.exit(1);
        }

        console.log('✅ run_live_tests.js uploaded. Running remote test suite...\n');
        conn.exec('cd /var/www/nanoshipy/Saas-Frontend-main/backend && node scripts/run_live_tests.js', (execErr, stream) => {
          if (execErr) {
            console.error('Exec error:', execErr);
            conn.end();
            process.exit(1);
          }

          stream.on('data', d => process.stdout.write(d.toString()));
          stream.stderr.on('data', d => process.stderr.write(d.toString()));
          stream.on('close', (code) => {
            conn.end();
            process.exit(code);
          });
        });
      });
    });
  });

  conn.on('error', err => {
    console.error('SSH error:', err);
    process.exit(1);
  });

  conn.connect(SSH_CONFIG);
}

verifyLive();
