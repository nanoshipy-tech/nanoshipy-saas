const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const conn = new Client();

const filesToUpload = [
  {
    local: 'c:/Users/dines/.gemini/antigravity-ide/scratch/nanoshipy/shipping-saasd/Saas-Frontend-main/backend/src/migrations/20260912000007-add-shipway-location-id-to-pickup-addresses.js',
    remote: '/var/www/nanoshipy/Saas-Frontend-main/backend/src/migrations/20260912000007-add-shipway-location-id-to-pickup-addresses.js'
  },
  {
    local: 'c:/Users/dines/.gemini/antigravity-ide/scratch/nanoshipy/shipping-saasd/Saas-Frontend-main/backend/src/models/pickupAddress.model.js',
    remote: '/var/www/nanoshipy/Saas-Frontend-main/backend/src/models/pickupAddress.model.js'
  },
  {
    local: 'c:/Users/dines/.gemini/antigravity-ide/scratch/nanoshipy/shipping-saasd/Saas-Frontend-main/backend/src/validators/pickupAddress.validator.js',
    remote: '/var/www/nanoshipy/Saas-Frontend-main/backend/src/validators/pickupAddress.validator.js'
  },
  {
    local: 'c:/Users/dines/.gemini/antigravity-ide/scratch/nanoshipy/shipping-saasd/Saas-Frontend-main/backend/src/providers/shipway/ShipwayAdapter.js',
    remote: '/var/www/nanoshipy/Saas-Frontend-main/backend/src/providers/shipway/ShipwayAdapter.js'
  },
  {
    local: 'c:/Users/dines/.gemini/antigravity-ide/scratch/nanoshipy/shipping-saasd/Saas-Frontend-main/backend/src/providers/bluedart/bluedartCredentialSchema.js',
    remote: '/var/www/nanoshipy/Saas-Frontend-main/backend/src/providers/bluedart/bluedartCredentialSchema.js'
  },
  {
    local: 'c:/Users/dines/.gemini/antigravity-ide/scratch/nanoshipy/shipping-saasd/Saas-Frontend-main/backend/src/providers/xpressbees/xpressbeesCredentialSchema.js',
    remote: '/var/www/nanoshipy/Saas-Frontend-main/backend/src/providers/xpressbees/xpressbeesCredentialSchema.js'
  },
  {
    local: 'c:/Users/dines/.gemini/antigravity-ide/scratch/nanoshipy/shipping-saasd/Saas-Frontend-main/backend/src/providers/ecomexpress/ecomExpressCredentialSchema.js',
    remote: '/var/www/nanoshipy/Saas-Frontend-main/backend/src/providers/ecomexpress/ecomExpressCredentialSchema.js'
  },
  {
    local: 'c:/Users/dines/.gemini/antigravity-ide/scratch/nanoshipy/shipping-saasd/Saas-Frontend-main/backend/src/providers/shadowfax/shadowfaxCredentialSchema.js',
    remote: '/var/www/nanoshipy/Saas-Frontend-main/backend/src/providers/shadowfax/shadowfaxCredentialSchema.js'
  },
  {
    local: 'c:/Users/dines/.gemini/antigravity-ide/scratch/nanoshipy/shipping-saasd/Saas-Frontend-main/backend/src/validators/courierProvider.validator.js',
    remote: '/var/www/nanoshipy/Saas-Frontend-main/backend/src/validators/courierProvider.validator.js'
  },
  {
    local: 'c:/Users/dines/.gemini/antigravity-ide/scratch/nanoshipy/shipping-saasd/Saas-Frontend-main/backend/src/controllers/courierProvider.controller.js',
    remote: '/var/www/nanoshipy/Saas-Frontend-main/backend/src/controllers/courierProvider.controller.js'
  },
  {
    local: 'c:/Users/dines/.gemini/antigravity-ide/scratch/nanoshipy/shipping-saasd/Saas-Frontend-main/frontend/components/addresses/AddressForm.tsx',
    remote: '/var/www/nanoshipy/Saas-Frontend-main/frontend/components/addresses/AddressForm.tsx'
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
  console.log('SSH Connection established.');
  
  conn.sftp(async (err, sftp) => {
    if (err) {
      console.error('SFTP error:', err);
      conn.end();
      return;
    }

    try {
      console.log('Uploading modified files...');
      for (const f of filesToUpload) {
        console.log(`Uploading ${path.basename(f.local)} -> ${f.remote}`);
        await uploadFile(sftp, f.local, f.remote);
      }
      console.log('All files uploaded successfully!');

      // Step 1: Run database migration
      console.log('Executing database migration...');
      const migRes = await execCommand(conn, 'cd /var/www/nanoshipy/Saas-Frontend-main/backend && npx sequelize-cli db:migrate');
      console.log('Migration stdout:', migRes.stdout);
      if (migRes.stderr) console.log('Migration stderr:', migRes.stderr);

      // Step 2: Ensure admin care@nanoshipy.com has role super_admin
      console.log('Updating platform admin role...');
      const sqlCmd = `node -e "
        require('dotenv').config({ path: '/var/www/nanoshipy/Saas-Frontend-main/backend/.env' });
        const { Sequelize } = require('sequelize');
        const s = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
          host: process.env.DB_HOST || '127.0.0.1',
          port: process.env.DB_PORT || 5432,
          dialect: 'postgres',
          logging: false
        });
        async function run() {
          await s.query(\\\"UPDATE platform_admins SET role = 'super_admin' WHERE email = 'care@nanoshipy.com'\\\");
          const [res] = await s.query(\\\"SELECT id, email, role FROM platform_admins WHERE email = 'care@nanoshipy.com'\\\");
          console.log('Admin record:', res[0]);
          process.exit(0);
        }
        run();
      "`;
      const adminRes = await execCommand(conn, sqlCmd);
      console.log(adminRes.stdout);

      // Step 3: Flush redis permission cache
      console.log('Flushing Redis platform permission keys...');
      const redisRes = await execCommand(conn, 'redis-cli keys "platform_perm:*" | xargs -r redis-cli del');
      console.log('Redis flush output:', redisRes.stdout);

      // Step 4: Restart backend
      console.log('Restarting nanoshipy-backend...');
      const restartRes = await execCommand(conn, 'pm2 restart nanoshipy-backend');
      console.log('PM2 restart output:', restartRes.stdout);

      // Step 5: Build and restart frontend
      console.log('Building and restarting nanoshipy-frontend...');
      const buildRes = await execCommand(conn, 'cd /var/www/nanoshipy/Saas-Frontend-main/frontend && npm run build && pm2 restart nanoshipy-frontend');
      console.log('Frontend build output:', buildRes.stdout);

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
