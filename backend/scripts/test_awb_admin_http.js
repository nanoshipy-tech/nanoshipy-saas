'use strict';

const axios = require('axios');
const jwt = require('jsonwebtoken');

// Generate a valid platform admin JWT using the server's PLATFORM_JWT_ACCESS_SECRET
async function testAdminHttp() {
  const { Client } = require('ssh2');
  const fs = require('fs');

  const conn = new Client();
  conn.on('ready', () => {
    console.log('⚡ Connected via SSH. Testing Admin AWB API endpoints locally on production...');

    const remoteTest = `
      const axios = require('axios');
      const jwt = require('jsonwebtoken');
      const tokenService = require('/var/www/nanoshipy/Saas-Frontend-main/backend/src/services/token.service');
      const { PlatformAdmin } = require('/var/www/nanoshipy/Saas-Frontend-main/backend/src/models');

      async function run() {
        const admin = await PlatformAdmin.findOne();
        if (!admin) throw new Error('No PlatformAdmin found');

        const token = tokenService.signPlatformAccessToken({
          admin_id: admin.id,
          email: admin.email,
          role: admin.role,
        });

        const client = axios.create({
          baseURL: 'http://127.0.0.1:5000/api/v1',
          headers: {
            Authorization: 'Bearer ' + token,
          },
        });

        console.log('1. Calling GET /platform/st-courier-awb/stats...');
        const statsRes = await client.get('/platform/st-courier-awb/stats');
        console.log('   Stats Response:', statsRes.data);

        console.log('\\n2. Calling POST /platform/st-courier-awb/upload...');
        const uploadRes = await client.post('/platform/st-courier-awb/upload', {
          awb_text: 'STC_DEMO_01, STC_DEMO_02, STC_DEMO_03',
          origin_district: 'Chennai',
          payment_mode: 'prepaid',
          batch_id: 'DEMO-BATCH-001',
          notes: 'Admin HTTP API Verification',
        });
        console.log('   Upload Response:', uploadRes.data);

        console.log('\\n3. Calling GET /platform/st-courier-awb...');
        const listRes = await client.get('/platform/st-courier-awb?batch_id=DEMO-BATCH-001');
        console.log('   List Count:', listRes.data.data.total, 'items retrieved');

        console.log('\\n4. Cleaning up demo uploaded AWBs...');
        const { StCourierAwbInventory } = require('/var/www/nanoshipy/Saas-Frontend-main/backend/src/models');
        await StCourierAwbInventory.destroy({ where: { batch_id: 'DEMO-BATCH-001' } });
        console.log('   [PASS] Cleaned up demo batch.');

        console.log('\\n✅ ALL ADMIN HTTP ENDPOINTS VERIFIED SUCCESSFULLY!');
      }

      run().then(() => process.exit(0)).catch(err => {
        console.error('❌ Admin HTTP Test Failed:', err.response?.data || err.message);
        process.exit(1);
      });
    `;

    conn.exec(`cd /var/www/nanoshipy/Saas-Frontend-main/backend && node -e "${remoteTest.replace(/"/g, '\\"')}"`, (err, stream) => {
      if (err) {
        console.error('Exec error:', err);
        conn.end();
        process.exit(1);
      }
      stream.on('data', d => process.stdout.write(d.toString()));
      stream.stderr.on('data', d => process.stderr.write(d.toString()));
      stream.on('close', code => {
        conn.end();
        process.exit(code);
      });
    });
  }).connect({
    host: '34.93.11.164',
    port: 22,
    username: 'care',
    privateKey: fs.readFileSync('C:\\Users\\dines\\.ssh\\id_rsa'),
  });
}

testAdminHttp();
