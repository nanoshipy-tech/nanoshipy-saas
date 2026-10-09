const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();

function uploadFile(sftp, local, remote) {
  return new Promise((resolve, reject) => {
    sftp.fastPut(local, remote, err => err ? reject(err) : resolve());
  });
}

function execCommand(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('data', d => out += d);
      stream.stderr.on('data', d => out += d);
      stream.on('close', code => resolve({ code, out }));
    });
  });
}

conn.on('ready', async () => {
  console.log('SSH Connection ready. Uploading test scripts...');

  conn.sftp(async (err, sftp) => {
    if (err) {
      console.error('SFTP error:', err);
      conn.end();
      return;
    }

    try {
      await uploadFile(
        sftp,
        'c:/Users/dines/.gemini/antigravity-ide/scratch/nanoshipy/shipping-saasd/Saas-Frontend-main/backend/scripts/remote_test_shipway.js',
        '/var/www/nanoshipy/Saas-Frontend-main/backend/scripts/remote_test_shipway.js'
      );
      await uploadFile(
        sftp,
        'c:/Users/dines/.gemini/antigravity-ide/scratch/nanoshipy/shipping-saasd/Saas-Frontend-main/backend/scripts/remote_test_carrier.js',
        '/var/www/nanoshipy/Saas-Frontend-main/backend/scripts/remote_test_carrier.js'
      );
      console.log('Test scripts uploaded to backend/scripts/ successfully.');

      // Clear any cached permission in Redis
      await execCommand(conn, 'redis-cli del platform_perm:153a60fa-4595-496d-835b-775117bf8916');

      console.log('\n=============================================================');
      console.log('RUNNING TEST SUITE 1: SHIPWAY MULTI-WAREHOUSE ROUTING');
      console.log('=============================================================');
      const res1 = await execCommand(conn, 'cd /var/www/nanoshipy/Saas-Frontend-main/backend && node scripts/remote_test_shipway.js');
      console.log(res1.out);

      console.log('\n=============================================================');
      console.log('RUNNING TEST SUITE 2: CARRIER CREDENTIALS & ENCRYPTION AT REST');
      console.log('=============================================================');
      const res2 = await execCommand(conn, 'cd /var/www/nanoshipy/Saas-Frontend-main/backend && node scripts/remote_test_carrier.js');
      console.log(res2.out);

      const allSuccess = (res1.code === 0 && res2.code === 0);
      process.exit(allSuccess ? 0 : 1);
    } catch (e) {
      console.error('Error during execution:', e);
      process.exit(1);
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
