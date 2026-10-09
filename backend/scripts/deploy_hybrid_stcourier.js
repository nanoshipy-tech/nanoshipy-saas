'use strict';

const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const SSH_CONFIG = {
  host: '34.93.11.164',
  port: 22,
  username: 'care',
  privateKey: fs.readFileSync('C:\\Users\\dines\\.ssh\\id_rsa'),
  readyTimeout: 60000,
};

const BASE_LOCAL = 'c:/Users/dines/.gemini/antigravity-ide/scratch/nanoshipy/shipping-saasd/Saas-Frontend-main';
const BASE_REMOTE = '/var/www/nanoshipy/Saas-Frontend-main';

const filesToUpload = [
  // Backend Migration & Models
  {
    local: `${BASE_LOCAL}/backend/src/migrations/20260912000008-create-st-courier-awb-inventory.js`,
    remote: `${BASE_REMOTE}/backend/src/migrations/20260912000008-create-st-courier-awb-inventory.js`,
  },
  {
    local: `${BASE_LOCAL}/backend/src/models/stCourierAwbInventory.model.js`,
    remote: `${BASE_REMOTE}/backend/src/models/stCourierAwbInventory.model.js`,
  },
  {
    local: `${BASE_LOCAL}/backend/src/models/index.js`,
    remote: `${BASE_REMOTE}/backend/src/models/index.js`,
  },

  // ST Courier Adapter & Provider Registry
  {
    local: `${BASE_LOCAL}/backend/src/providers/stcourier/STCourierAdapter.js`,
    remote: `${BASE_REMOTE}/backend/src/providers/stcourier/STCourierAdapter.js`,
  },
  {
    local: `${BASE_LOCAL}/backend/src/providers/ProviderRegistry.js`,
    remote: `${BASE_REMOTE}/backend/src/providers/ProviderRegistry.js`,
  },

  // Services: Geo-Routing, Rate Comparison, Shipment creation
  {
    local: `${BASE_LOCAL}/backend/src/services/courierRouting.service.js`,
    remote: `${BASE_REMOTE}/backend/src/services/courierRouting.service.js`,
  },
  {
    local: `${BASE_LOCAL}/backend/src/services/rateComparison.service.js`,
    remote: `${BASE_REMOTE}/backend/src/services/rateComparison.service.js`,
  },
  {
    local: `${BASE_LOCAL}/backend/src/services/shipment.service.js`,
    remote: `${BASE_REMOTE}/backend/src/services/shipment.service.js`,
  },

  // Admin AWB Pool Controller & Routes
  {
    local: `${BASE_LOCAL}/backend/src/controllers/stCourierAwb.controller.js`,
    remote: `${BASE_REMOTE}/backend/src/controllers/stCourierAwb.controller.js`,
  },
  {
    local: `${BASE_LOCAL}/backend/src/routes/stCourierAwb.routes.js`,
    remote: `${BASE_REMOTE}/backend/src/routes/stCourierAwb.routes.js`,
  },
  {
    local: `${BASE_LOCAL}/backend/src/routes/index.routes.js`,
    remote: `${BASE_REMOTE}/backend/src/routes/index.routes.js`,
  },

  // Merchant Portal text cleanup
  {
    local: `${BASE_LOCAL}/frontend/components/addresses/AddressForm.tsx`,
    remote: `${BASE_REMOTE}/frontend/components/addresses/AddressForm.tsx`,
  },
  {
    local: `${BASE_LOCAL}/frontend/components/orders/OrderForm.tsx`,
    remote: `${BASE_REMOTE}/frontend/components/orders/OrderForm.tsx`,
  },

  // Admin Portal UI
  {
    local: `${BASE_LOCAL}/frontend-admin/app/(dashboard)/couriers/page.tsx`,
    remote: `${BASE_REMOTE}/frontend-admin/app/(dashboard)/couriers/page.tsx`,
  },
  {
    local: `${BASE_LOCAL}/frontend-admin/app/(dashboard)/logistics/awb-pool/page.tsx`,
    remote: `${BASE_REMOTE}/frontend-admin/app/(dashboard)/logistics/awb-pool/page.tsx`,
  },
  {
    local: `${BASE_LOCAL}/frontend-admin/components/layout/AdminSidebar.tsx`,
    remote: `${BASE_REMOTE}/frontend-admin/components/layout/AdminSidebar.tsx`,
  },
];

function execCommand(conn, cmd) {
  return new Promise((resolve, reject) => {
    console.log(`\n[REMOTE EXEC] ${cmd}`);
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('data', d => {
        const str = d.toString();
        process.stdout.write(str);
        stdout += str;
      });
      stream.stderr.on('data', d => {
        const str = d.toString();
        process.stderr.write(str);
        stderr += str;
      });
      stream.on('close', (code) => {
        if (code !== 0) {
          console.warn(`Command exited with code ${code}`);
        }
        resolve({ code, stdout, stderr });
      });
    });
  });
}

function ensureRemoteDir(sftp, remoteDirPath) {
  return new Promise((resolve, reject) => {
    sftp.mkdir(remoteDirPath, (err) => {
      // Ignore if directory already exists
      resolve();
    });
  });
}

function uploadFile(sftp, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    sftp.fastPut(localPath, remotePath, (err) => {
      if (err) {
        console.error(`❌ Upload failed: ${localPath} -> ${remotePath}`, err.message);
        return reject(err);
      }
      console.log(`✅ Uploaded: ${path.basename(localPath)} -> ${remotePath}`);
      resolve();
    });
  });
}

async function runDeployment() {
  console.log('🚀 Connecting to Production VPS at 34.93.11.164...');
  const conn = new Client();

  conn.on('ready', async () => {
    console.log('⚡ SSH connection established successfully.');

    try {
      // 1. Ensure remote directories exist
      await execCommand(conn, `mkdir -p ${BASE_REMOTE}/backend/src/providers/stcourier ${BASE_REMOTE}/frontend-admin/app/'(dashboard)'/logistics/awb-pool`);

      // 2. SFTP Upload
      console.log('\n📦 Uploading modified source files via SFTP...');
      await new Promise((resolve, reject) => {
        conn.sftp(async (err, sftp) => {
          if (err) return reject(err);
          try {
            for (const file of filesToUpload) {
              await uploadFile(sftp, file.local, file.remote);
            }
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });

      // 3. Run Database Migrations
      console.log('\n🗄️ Running Sequelize DB Migration for ST Courier AWB Inventory...');
      await execCommand(conn, `cd ${BASE_REMOTE}/backend && npx sequelize-cli db:migrate`);

      // 4. Seed / Register ST Courier Provider & Grant Tenant Access
      console.log('\n🚚 Configuring ST Courier in courier_providers and tenant_courier_access...');
      const seedSql = `
        DO $$
        DECLARE
          v_st_id uuid;
        BEGIN
          INSERT INTO courier_providers (
            id, provider_key, display_name, is_active, credentials_encrypted, config,
            supports_cod, supports_prepaid, priority, sandbox_mode, circuit_breaker_state,
            consecutive_failures, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), 'stcourier', 'ST Courier (Tamil Nadu Express)', true,
            '{}', '{"base_rate":30.00,"additional_slab_rate":15.00,"cod_min_fee":30.00,"cod_percent":2.0}'::json,
            true, true, 1, false, 'closed', 0, NOW(), NOW()
          )
          ON CONFLICT (provider_key) DO UPDATE
          SET is_active = true,
              sandbox_mode = false,
              display_name = 'ST Courier (Tamil Nadu Express)',
              config = '{"base_rate":30.00,"additional_slab_rate":15.00,"cod_min_fee":30.00,"cod_percent":2.0}'::json,
              updated_at = NOW()
          RETURNING id INTO v_st_id;

          IF v_st_id IS NULL THEN
            SELECT id INTO v_st_id FROM courier_providers WHERE provider_key = 'stcourier';
          END IF;

          -- Enable ST Courier for all existing tenants
          INSERT INTO tenant_courier_access (id, tenant_id, courier_provider_id, is_enabled, created_at, updated_at)
          SELECT gen_random_uuid(), t.id, v_st_id, true, NOW(), NOW()
          FROM tenants t
          WHERE NOT EXISTS (
            SELECT 1 FROM tenant_courier_access tca WHERE tca.tenant_id = t.id AND tca.courier_provider_id = v_st_id
          );

          RAISE NOTICE 'ST Courier configured with ID %', v_st_id;
        END $$;
      `;
      await execCommand(conn, `sudo -u postgres psql -d nanoshipy_db -c "${seedSql.replace(/\n/g, ' ')}"`);

      // 5. Build Frontend-Admin
      console.log('\n🔨 Building Frontend-Admin Next.js application...');
      await execCommand(conn, `cd ${BASE_REMOTE}/frontend-admin && npm run build`);

      // 6. Build Frontend
      console.log('\n🔨 Building Merchant Frontend Next.js application...');
      await execCommand(conn, `cd ${BASE_REMOTE}/frontend && npm run build`);

      // 7. Restart PM2 Services
      console.log('\n🔄 Restarting PM2 processes...');
      await execCommand(conn, `pm2 restart nanoshipy-backend nanoshipy-admin nanoshipy-frontend`);

      // 8. Verify PM2 Status
      console.log('\n📊 Verifying PM2 cluster status...');
      await execCommand(conn, `pm2 status`);

      console.log('\n🎉 Hybrid Logistics Architecture deployed to Production successfully!');
      conn.end();
      process.exit(0);
    } catch (deployErr) {
      console.error('\n❌ Deployment failed with error:', deployErr);
      conn.end();
      process.exit(1);
    }
  });

  conn.on('error', (err) => {
    console.error('❌ SSH connection error:', err);
    process.exit(1);
  });

  conn.connect(SSH_CONFIG);
}

runDeployment();
