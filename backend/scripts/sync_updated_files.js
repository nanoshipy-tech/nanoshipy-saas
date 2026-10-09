'use strict';

const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
conn.on('ready', () => {
  console.log('⚡ Connected via SSH. Syncing updated controller and frontend page...');

  conn.sftp((err, sftp) => {
    if (err) throw err;

    const files = [
      {
        local: 'c:/Users/dines/.gemini/antigravity-ide/scratch/nanoshipy/shipping-saasd/Saas-Frontend-main/backend/src/controllers/stCourierAwb.controller.js',
        remote: '/var/www/nanoshipy/Saas-Frontend-main/backend/src/controllers/stCourierAwb.controller.js',
      },
      {
        local: 'c:/Users/dines/.gemini/antigravity-ide/scratch/nanoshipy/shipping-saasd/Saas-Frontend-main/frontend-admin/app/(dashboard)/logistics/awb-pool/page.tsx',
        remote: '/var/www/nanoshipy/Saas-Frontend-main/frontend-admin/app/(dashboard)/logistics/awb-pool/page.tsx',
      },
    ];

    let completed = 0;
    files.forEach(f => {
      sftp.fastPut(f.local, f.remote, (uploadErr) => {
        if (uploadErr) {
          console.error('Upload failed for', f.remote, uploadErr);
          conn.end();
          process.exit(1);
        }
        console.log('✅ Uploaded', f.remote);
        completed++;
        if (completed === files.length) {
          conn.exec('pm2 restart nanoshipy-backend', (execErr, stream) => {
            if (execErr) throw execErr;
            stream.on('data', d => process.stdout.write(d.toString()));
            stream.on('close', code => {
              console.log('Backend restarted with code:', code);
              conn.end();
              process.exit(code);
            });
          });
        }
      });
    });
  });
}).connect({
  host: '34.93.11.164',
  port: 22,
  username: 'care',
  privateKey: fs.readFileSync('C:\\Users\\dines\\.ssh\\id_rsa'),
});
