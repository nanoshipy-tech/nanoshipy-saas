const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();

const filesToUpload = [
  {
    local: 'c:/Users/dines/.gemini/antigravity-ide/scratch/nanoshipy/shipping-saasd/Saas-Frontend-main/backend/src/services/sellerPayment.service.js',
    remote: '/var/www/nanoshipy/Saas-Frontend-main/backend/src/services/sellerPayment.service.js'
  },
  {
    local: 'c:/Users/dines/.gemini/antigravity-ide/scratch/nanoshipy/shipping-saasd/Saas-Frontend-main/backend/src/services/shipment.service.js',
    remote: '/var/www/nanoshipy/Saas-Frontend-main/backend/src/services/shipment.service.js'
  },
  {
    local: 'c:/Users/dines/.gemini/antigravity-ide/scratch/nanoshipy/shipping-saasd/Saas-Frontend-main/frontend/app/(dashboard)/orders/[orderId]/ship/page.tsx',
    remote: '/var/www/nanoshipy/Saas-Frontend-main/frontend/app/(dashboard)/orders/[orderId]/ship/page.tsx'
  }
];

function execCommand(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('data', d => stdout += d);
      stream.stderr.on('data', d => stderr += d);
      stream.on('close', code => resolve({ code, stdout, stderr }));
    });
  });
}

function uploadFile(sftp, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.fastPut(localPath, remotePath, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

conn.on('ready', async () => {
  console.log('SSH Connection established to 34.93.11.164.');

  conn.sftp(async (err, sftp) => {
    if (err) {
      console.error('SFTP error:', err);
      conn.end();
      return;
    }

    try {
      console.log('Uploading updated files...');
      for (const f of filesToUpload) {
        console.log(`Uploading ${path.basename(f.local)} -> ${f.remote}`);
        await uploadFile(sftp, f.local, f.remote);
      }
      console.log('Files uploaded successfully!');

      // Step 1: Restart backend
      console.log('Restarting nanoshipy-backend via PM2...');
      const restartRes = await execCommand(conn, 'pm2 restart nanoshipy-backend');
      console.log('PM2 restart output:', restartRes.stdout);
      if (restartRes.stderr) console.error('PM2 restart stderr:', restartRes.stderr);

      // Step 2: Build frontend and reload
      console.log('Building and restarting nanoshipy-frontend...');
      const buildRes = await execCommand(conn, 'cd /var/www/nanoshipy/Saas-Frontend-main/frontend && npm run build && pm2 restart nanoshipy-frontend');
      console.log('Frontend build output:', buildRes.stdout);
      if (buildRes.stderr) console.error('Frontend build stderr:', buildRes.stderr);

      // Step 3: Check pm2 status
      const pm2Status = await execCommand(conn, 'pm2 status');
      console.log('Current PM2 status:\n', pm2Status.stdout);

      console.log('Deployment complete!');
    } catch (e) {
      console.error('Deployment error:', e);
    } finally {
      conn.end();
    }
  });
}).connect({
  host: '34.93.11.164',
  port: 22,
  username: 'care',
  privateKey: fs.readFileSync('C:\\Users\\dines\\.ssh\\id_rsa')
});
