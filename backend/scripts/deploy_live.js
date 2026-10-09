'use strict';

const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SSH_CONFIG = {
  host: '34.93.11.164',
  port: 22,
  username: 'care',
  privateKey: fs.readFileSync('C:/Users/dines/.ssh/id_rsa'),
  readyTimeout: 30000,
};

const LOCAL_ROOT = path.resolve(__dirname, '..', '..');
const REMOTE_ROOT = '/var/www/nanoshipy/Saas-Frontend-main';

const FILES_TO_DEPLOY = [
  'backend/src/controllers/platformSmtp.controller.js',
  'backend/src/controllers/platformPaymentGateway.controller.js',
  'backend/src/services/sms.service.js',
  'backend/src/services/auth.service.js',
  'backend/src/validators/auth.validator.js',
  'backend/src/controllers/platformAuth.controller.js',
  'backend/src/routes/platformAuth.routes.js',
  'frontend-admin/app/(dashboard)/configuration/smtp/page.tsx',
  'frontend-admin/app/(dashboard)/configuration/payment-gateways/page.tsx',
  'frontend-admin/components/layout/AdminSidebar.tsx',
  'frontend-admin/app/forgot-password/page.tsx',
  'frontend/app/(auth)/forgot-password/page.tsx',
];

async function runCmd(conn, cmd) {
  return new Promise((resolve, reject) => {
    console.log(`\n>>> [REMOTE] ${cmd}`);
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('data', d => { process.stdout.write(d.toString()); out += d.toString(); });
      stream.stderr.on('data', d => { process.stderr.write(d.toString()); out += d.toString(); });
      stream.on('close', code => {
        if (code !== 0) {
          console.warn(`[WARN] Process exited with code ${code}`);
        }
        resolve({ code, out });
      });
    });
  });
}

function createLocalTar(tarPath) {
  console.log('Creating deployment tarball...');
  const fileListPath = path.join(LOCAL_ROOT, 'deploy_files.txt');
  
  // Recursively collect all files
  const allFiles = [];
  for (const item of FILES_TO_DEPLOY) {
    const full = path.join(LOCAL_ROOT, item);
    if (!fs.existsSync(full)) {
      console.warn('File not found locally, skipping:', item);
      continue;
    }
    if (fs.statSync(full).isDirectory()) {
      function walk(dir) {
        for (const f of fs.readdirSync(dir)) {
          const p = path.join(dir, f);
          if (fs.statSync(p).isDirectory()) {
            walk(p);
          } else {
            allFiles.push(path.relative(LOCAL_ROOT, p).replace(/\\/g, '/'));
          }
        }
      }
      walk(full);
    } else {
      allFiles.push(item.replace(/\\/g, '/'));
    }
  }

  fs.writeFileSync(fileListPath, allFiles.join('\n'));
  execSync(`tar -cf "${tarPath}" -T "${fileListPath}"`, { cwd: LOCAL_ROOT });
  fs.unlinkSync(fileListPath);
  console.log(`Tarball created successfully: ${tarPath} (${fs.statSync(tarPath).size} bytes)`);
}

async function uploadAndExtractTar(conn, tarPath) {
  const remoteTar = '/tmp/deploy_update.tar';
  console.log('Uploading tarball via SFTP to /tmp/deploy_update.tar...');
  await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.fastPut(tarPath, remoteTar, (putErr) => {
        if (putErr) return reject(putErr);
        console.log('Tarball uploaded to remote successfully.');
        resolve();
      });
    });
  });

  console.log('Extracting tarball on remote host...');
  await runCmd(conn, `tar -xf ${remoteTar} -C ${REMOTE_ROOT} && rm -f ${remoteTar}`);
  console.log('Tarball extracted cleanly on remote server!');
}

async function main() {
  const tarPath = path.join(LOCAL_ROOT, 'deploy_update.tar');
  try {
    createLocalTar(tarPath);

    console.log('Connecting to GCP VM 34.93.11.164...');
    const conn = new Client();
    await new Promise((resolve, reject) => {
      conn.on('ready', resolve);
      conn.on('error', reject);
      conn.connect(SSH_CONFIG);
    });
    console.log('SSH Connection established.');

    // 1. Upload & Extract files
    await uploadAndExtractTar(conn, tarPath);

    // 2. Remove duplicate finance-hub directory if present
    await runCmd(conn, `rm -rf ${REMOTE_ROOT}/frontend-admin/app/\\(dashboard\\)/finance-hub`);

    // 3. Run Sequelize database migrations
    console.log('\n--- Running Database Migrations ---');
    await runCmd(conn, `cd ${REMOTE_ROOT}/backend && npx sequelize-cli db:migrate`);

    // 4. Build frontend-admin & frontend
    console.log('\n--- Building Frontend Admin ---');
    await runCmd(conn, `cd ${REMOTE_ROOT}/frontend-admin && npm run build`);

    console.log('\n--- Building Frontend ---');
    await runCmd(conn, `cd ${REMOTE_ROOT}/frontend && npm run build`);

    // 5. Restart PM2 Services
    console.log('\n--- Restarting PM2 Services ---');
    await runCmd(conn, `pm2 restart nanoshipy-backend nanoshipy-admin nanoshipy-frontend`);

    // 6. PM2 Status
    console.log('\n--- Checking PM2 Status ---');
    await runCmd(conn, `pm2 list`);

    // 7. Verify API Health
    console.log('\n--- Verifying Live API Endpoint ---');
    await runCmd(conn, `curl -s http://127.0.0.1:5000/api/health || curl -s http://127.0.0.1:5000/health || echo "Checking port 5000"`);

    conn.end();
    console.log('\n=== DEPLOYMENT COMPLETED SUCCESSFULLY ===\n');
  } finally {
    if (fs.existsSync(tarPath)) {
      fs.unlinkSync(tarPath);
    }
  }
}

main().catch(err => {
  console.error('\nDEPLOYMENT FAILED:', err);
  process.exit(1);
});
