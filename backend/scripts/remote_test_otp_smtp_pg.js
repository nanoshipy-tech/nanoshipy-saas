'use strict';

const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
conn.on('ready', () => {
  const remoteTestCode = `
    const axios = require('axios');
    const { PlatformSetting, PaymentGateway, User, PlatformAdmin } = require('./src/models');
    const { decrypt, encrypt } = require('./src/utils/encryption.util');
    const { getRedisClient } = require('./src/config/redis.config');

    const API_BASE = 'http://127.0.0.1:5000/api/v1';

    async function testAll() {
      console.log('=== STARTING AUTOMATED VERIFICATION ===\\n');
      const redis = getRedisClient();

      // Step 0: Obtain Platform Admin JWT Token
      console.log('[TEST 1] Authenticating as Platform Super Admin...');
      let adminToken = '';
      try {
        const loginRes = await axios.post(\`\${API_BASE}/platform/auth/login\`, {
          email: 'care@nanoshipy.com',
          password: 'Password@123',
        });
        adminToken = loginRes.data.data.token || loginRes.data.data.access_token;
        console.log('>>> Admin Login SUCCESS! Token obtained.');
      } catch (err) {
        console.error('>>> Admin Login FAILED:', err.response?.data || err.message);
        process.exit(1);
      }

      const adminHeaders = { Authorization: \`Bearer \${adminToken}\` };

      // Step 1: Verify SMTP Decrypted Value Display
      console.log('\\n[TEST 2] Verifying SMTP Real Decrypted Value Display via GET /platform/smtp...');
      try {
        const smtpRes = await axios.get(\`\${API_BASE}/platform/smtp\`, { headers: adminHeaders });
        const data = smtpRes.data.data;
        console.log('SMTP Config Response:');
        console.log('  host:', data.smtp_host);
        console.log('  port:', data.smtp_port);
        console.log('  username:', data.smtp_username);
        console.log('  password status:', data.smtp_password_status);
        console.log('  real decrypted password:', data.smtp_password);

        if (!data.smtp_password || data.smtp_password.startsWith('••••')) {
          throw new Error('FAILED: smtp_password is empty or masked instead of returning real decrypted value!');
        }
        console.log('>>> TEST 2 PASSED: Real decrypted SMTP password returned to super admin!');
      } catch (err) {
        console.error('>>> TEST 2 FAILED:', err.response?.data || err.message);
      }

      // Step 2: Verify Payment Gateways Real Decrypted Value Display
      console.log('\\n[TEST 3] Verifying Payment Gateways Real Decrypted Values via GET /platform/payment-gateways...');
      try {
        const pgRes = await axios.get(\`\${API_BASE}/platform/payment-gateways\`, { headers: adminHeaders });
        const gateways = pgRes.data.data.gateways;
        const razorpay = gateways.find(g => g.name === 'razorpay');
        console.log('Razorpay Gateway:');
        console.log('  mode:', razorpay?.mode);
        console.log('  api_key:', razorpay?.api_key);
        console.log('  api_secret (real decrypted):', razorpay?.api_secret ? razorpay.api_secret.substring(0, 8) + '...' : 'none');
        console.log('  webhook_secret (real decrypted):', razorpay?.webhook_secret ? razorpay.webhook_secret.substring(0, 8) + '...' : 'none');
        console.log('  api_secret_status:', razorpay?.api_secret_status);

        if (!razorpay?.api_secret || razorpay.api_secret.startsWith('••••') || razorpay.api_secret === 'Not set') {
          throw new Error('FAILED: Razorpay api_secret is masked or Not set!');
        }
        console.log('>>> TEST 3 PASSED: Real decrypted Payment Gateway secrets returned to super admin!');
      } catch (err) {
        console.error('>>> TEST 3 FAILED:', err.response?.data || err.message);
      }

      // Step 3: Test Multi-Channel OTP Dispatch for Forgot Password
      console.log('\\n[TEST 4] Testing Multi-Channel OTP Dispatch via POST /auth/forgot-password...');
      const testEmail = 'merchant.test@nanoshipy.com';
      const testPhone = '9876543210';

      // Find or create test merchant
      let testUser = await User.findOne({ where: { email: testEmail } });
      if (!testUser) {
        const { Tenant, Role } = require('./src/models');
        let t = await Tenant.findOne();
        let r = await Role.findOne();
        const bcrypt = require('bcryptjs');
        testUser = await User.create({
          name: 'Test Merchant',
          email: testEmail,
          phone: testPhone,
          password_hash: await bcrypt.hash('OldPassword@123', 10),
          tenant_id: t?.id,
          role_id: r?.id,
          status: 'active',
        });
        console.log('Created temporary test user for OTP reset test.');
      } else {
        await testUser.update({ phone: testPhone });
      }

      try {
        const forgotRes = await axios.post(\`\${API_BASE}/auth/forgot-password\`, {
          email: testEmail,
          phone: testPhone,
        });
        console.log('Forgot Password Response:', forgotRes.data.data);

        // Verify OTP cached in Redis
        const cachedOtpRaw = await redis.get(\`pwd_reset_otp:\${testEmail}\`);
        console.log('Redis cached OTP payload:', cachedOtpRaw);
        if (!cachedOtpRaw) {
          throw new Error('FAILED: OTP was not cached in Redis!');
        }

        const parsedOtp = JSON.parse(cachedOtpRaw);
        console.log('Generated 6-digit OTP:', parsedOtp.otp);
        console.log('>>> TEST 4 PASSED: Multi-channel OTP generated and cached with TTL!');

        // Step 4: Test Password Reset using the OTP
        console.log('\\n[TEST 5] Testing Password Reset using 6-Digit OTP via POST /auth/reset-password...');
        const newTestPassword = 'NewSecretPassword@2026!';
        const resetRes = await axios.post(\`\${API_BASE}/auth/reset-password\`, {
          email: testEmail,
          otp: parsedOtp.otp,
          new_password: newTestPassword,
        });
        console.log('Reset Password Response:', resetRes.data.data);

        // Verify login works with the new password
        const verifyLoginRes = await axios.post(\`\${API_BASE}/auth/login\`, {
          email: testEmail,
          password: newTestPassword,
        });
        console.log('Login with new password SUCCESS! Token:', !!verifyLoginRes.data.data?.token);
        console.log('>>> TEST 5 PASSED: Password successfully reset and authenticated with new password!');

      } catch (err) {
        console.error('>>> OTP / Reset FAILED:', err.response?.data || err.message);
      }

      console.log('\\n=== ALL VERIFICATIONS FINISHED ===\\n');
    }

    testAll().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
  `;

  const base64 = Buffer.from(remoteTestCode).toString('base64');
  const cmd = `cd /var/www/nanoshipy/Saas-Frontend-main/backend && node -e "eval(Buffer.from('${base64}','base64').toString())"`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
});

conn.connect({
  host: '34.93.11.164',
  port: 22,
  username: 'care',
  privateKey: fs.readFileSync('C:/Users/dines/.ssh/id_rsa'),
});
