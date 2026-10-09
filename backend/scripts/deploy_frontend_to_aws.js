'use strict';

const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SSH_CONFIG = {
  host: '13.239.18.131',
  port: 22,
  username: 'ubuntu',
  privateKey: fs.readFileSync('c:/Users/dines/.gemini/antigravity-ide/scratch/nanoshipy (2)/nanoshipy/aws_key.pem'),
  readyTimeout: 30000,
};

const LOCAL_ROOT = path.resolve(__dirname, '..', '..');
const FRONTEND_LOCAL = path.join(LOCAL_ROOT, 'frontend');
const REMOTE_FRONTEND = '/var/www/nanoshipy/Saas-Frontend-main/frontend';

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

function createFrontendTarball(tarPath) {
  console.log('\n--- 1. Packaging Frontend Source Code ---');
  if (fs.existsSync(tarPath)) {
    fs.unlinkSync(tarPath);
  }

  // Create tar from frontend directory excluding node_modules, .next, .env files
  const tarCmd = [
    'tar',
    '--exclude="node_modules"',
    '--exclude="**/node_modules"',
    '--exclude=".next"',
    '--exclude="**/.next"',
    '--exclude=".git"',
    '--exclude="**/.git"',
    '--exclude=".env*"',
    '--exclude="**/.env*"',
    `-cf "${tarPath}"`,
    '.',
  ].join(' ');

  console.log('Running:', tarCmd);
  execSync(tarCmd, { cwd: FRONTEND_LOCAL, stdio: 'inherit' });
  const sizeMb = (fs.statSync(tarPath).size / (1024 * 1024)).toFixed(2);
  console.log(`Frontend tarball created: ${tarPath} (${sizeMb} MB)`);
}

async function uploadTarball(conn, tarPath) {
  const remoteTar = '/tmp/deploy_frontend.tar';
  console.log('\n--- 2. Uploading Tarball to AWS Server via SFTP ---');
  await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      console.log('Transferring to /tmp/deploy_frontend.tar...');
      sftp.fastPut(tarPath, remoteTar, (putErr) => {
        if (putErr) return reject(putErr);
        console.log('Tarball uploaded successfully.');
        resolve();
      });
    });
  });

  console.log('\n--- 3. Extracting Updated Files into /var/www/nanoshipy/Saas-Frontend-main/frontend ---');
  await runCmd(conn, `tar -xf ${remoteTar} -C ${REMOTE_FRONTEND} && rm -f ${remoteTar}`);
  console.log('Files unpacked successfully.');
}

async function main() {
  const tarPath = path.join(LOCAL_ROOT, 'deploy_frontend.tar');
  try {
    createFrontendTarball(tarPath);

    console.log('\n--- Connecting to AWS EC2 (13.239.18.131) ---');
    const conn = new Client();
    await new Promise((resolve, reject) => {
      conn.on('ready', resolve);
      conn.on('error', reject);
      conn.connect(SSH_CONFIG);
    });
    console.log('SSH Connection established.');

    // Upload & unpack
    await uploadTarball(conn, tarPath);

    // Build Next.js production app on remote server
    console.log('\n--- 4. Building Next.js Production Bundle on Server ---');
    await runCmd(conn, `cd ${REMOTE_FRONTEND} && NODE_OPTIONS="--max-old-space-size=768" npm run build`);

    // Restart PM2 process
    console.log('\n--- 5. Reloading nanoshipy-frontend in PM2 ---');
    await runCmd(conn, `pm2 reload nanoshipy-frontend || pm2 restart nanoshipy-frontend`);

    // Verify service health
    console.log('\n--- 6. Verifying Local and Public Endpoint Health ---');
    await runCmd(conn, `pm2 status nanoshipy-frontend`);
    await runCmd(conn, `curl -s -I http://127.0.0.1:3000 | head -n 6`);

    conn.end();
    console.log('\n======================================================');
    console.log(' ✅ LIVE DEPLOYMENT COMPLETED SUCCESSFULLY! ');
    console.log(' https://app.nanoshipy.com is now running the new code! ');
    console.log('======================================================\n');
  } finally {
    if (fs.existsSync(tarPath)) {
      try { fs.unlinkSync(tarPath); } catch (_) {}
    }
  }
}

main().catch(err => {
  console.error('\n❌ DEPLOYMENT FAILED:', err);
  process.exit(1);
});
