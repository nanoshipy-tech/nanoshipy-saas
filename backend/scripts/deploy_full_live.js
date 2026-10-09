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

function createFullTarball(tarPath) {
  console.log('--- Creating Complete Codebase Tarball ---');
  if (fs.existsSync(tarPath)) {
    fs.unlinkSync(tarPath);
  }

  // Use tar with strict excludes to package clean source code
  const tarCmd = [
    'tar',
    '--exclude="**/node_modules"',
    '--exclude="node_modules"',
    '--exclude="**/.next"',
    '--exclude=".next"',
    '--exclude="**/.git"',
    '--exclude=".git"',
    '--exclude="database.sqlite"',
    '--exclude="*.sqlite"',
    '--exclude="*.log"',
    '--exclude="**/*.log"',
    '--exclude="**/backend/backups"',
    '--exclude="**/.env"', // Protect remote production .env from being overwritten
    '--exclude="deploy_*.tar"',
    `-cf "${tarPath}"`,
    'backend',
    'frontend',
    'frontend-admin',
    'docs',
  ].join(' ');

  console.log('Running:', tarCmd);
  execSync(tarCmd, { cwd: LOCAL_ROOT, stdio: 'inherit' });
  const sizeMb = (fs.statSync(tarPath).size / (1024 * 1024)).toFixed(2);
  console.log(`Full tarball created successfully: ${tarPath} (${sizeMb} MB)`);
}

async function uploadFullTarball(conn, tarPath) {
  const remoteTar = '/tmp/deploy_full_code.tar';
  console.log('\n--- Uploading Full Codebase to Remote Host ---');
  await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      console.log('Starting SFTP fastPut transfer...');
      sftp.fastPut(tarPath, remoteTar, (putErr) => {
        if (putErr) return reject(putErr);
        console.log('Full codebase archive uploaded to /tmp/deploy_full_code.tar successfully.');
        resolve();
      });
    });
  });

  console.log('\n--- Extracting Full Codebase on Remote Server ---');
  await runCmd(conn, `tar -xf ${remoteTar} -C ${REMOTE_ROOT} && rm -f ${remoteTar}`);
  console.log('Full codebase successfully unpacked into /var/www/nanoshipy/Saas-Frontend-main!');
}

async function main() {
  const tarPath = path.join(LOCAL_ROOT, 'deploy_full.tar');
  try {
    createFullTarball(tarPath);

    console.log('\nConnecting to GCP Live Production Server (34.93.11.164)...');
    const conn = new Client();
    await new Promise((resolve, reject) => {
      conn.on('ready', resolve);
      conn.on('error', reject);
      conn.connect(SSH_CONFIG);
    });
    console.log('SSH Connection established successfully.');

    // 1. Upload & unpack all code
    await uploadFullTarball(conn, tarPath);

    // 2. Clean any deprecated folders
    await runCmd(conn, `rm -rf ${REMOTE_ROOT}/frontend-admin/app/\\(dashboard\\)/finance-hub`);

    // 3. Run database migrations on PostgreSQL
    console.log('\n--- Running Database Migrations on Live PostgreSQL ---');
    await runCmd(conn, `cd ${REMOTE_ROOT}/backend && npx sequelize-cli db:migrate`);

    // 4. Build Frontend Admin
    console.log('\n--- Building Production Frontend Admin (Next.js) ---');
    await runCmd(conn, `cd ${REMOTE_ROOT}/frontend-admin && npm run build`);

    // 5. Build Frontend Merchant
    console.log('\n--- Building Production Frontend Merchant (Next.js) ---');
    await runCmd(conn, `cd ${REMOTE_ROOT}/frontend && npm run build`);

    // 6. Restart all PM2 services
    console.log('\n--- Restarting All PM2 Services ---');
    await runCmd(conn, `pm2 restart all --update-env`);

    // 7. Check PM2 status
    console.log('\n--- PM2 Service Status ---');
    await runCmd(conn, `pm2 list`);

    // 8. Health verifications
    console.log('\n--- Verifying Live Endpoints ---');
    await runCmd(conn, `curl -s http://127.0.0.1:5000/api/v1/health`);
    await runCmd(conn, `curl -s -I http://127.0.0.1:3000 | head -n 5`);
    await runCmd(conn, `curl -s -I http://127.0.0.1:3001 | head -n 5`);

    conn.end();
    console.log('\n======================================================');
    console.log(' FULL CODE UPDATE COMPLETED ON LIVE GOOGLE SERVER! ');
    console.log('======================================================\n');
  } finally {
    if (fs.existsSync(tarPath)) {
      try { fs.unlinkSync(tarPath); } catch (_) {}
    }
  }
}

main().catch(err => {
  console.error('\nFULL CODE DEPLOYMENT FAILED:', err);
  process.exit(1);
});
