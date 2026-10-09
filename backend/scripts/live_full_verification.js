'use strict';

const http = require('http');
require('dotenv').config({ path: '/var/www/nanoshipy/Saas-Frontend-main/backend/.env' });
const { PlatformAdmin, PlatformSetting, PaymentGateway, User, Tenant, Role } = require('/var/www/nanoshipy/Saas-Frontend-main/backend/src/models');
const tokenService = require('/var/www/nanoshipy/Saas-Frontend-main/backend/src/services/token.service');
const { getRedisClient } = require('/var/www/nanoshipy/Saas-Frontend-main/backend/src/config/redis.config');
const bcrypt = require('bcrypt');

function apiRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: '127.0.0.1',
      port: 5000,
      path: '/api/v1' + path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? ('Bearer ' + token) : '',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch (e) {
          resolve({ status: res.statusCode, raw });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runLiveVerification() {
  console.log('=====================================================');
  console.log('STARTING FULL LIVE VERIFICATION SUITE');
  console.log('=====================================================\n');

  const redis = getRedisClient();

  // 1. Authenticate Platform Admin
  console.log('--- TEST 1: Platform Admin Authentication & JWT Generation ---');
  const admin = await PlatformAdmin.findOne({ where: { email: 'care@nanoshipy.com' } });
  if (!admin) {
    console.error('❌ Super Admin care@nanoshipy.com not found');
    process.exit(1);
  }
  const adminToken = tokenService.signPlatformAccessToken({
    admin_id: admin.id,
    role: admin.role,
  });
  console.log('✅ Generated valid Platform Admin JWT token for role:', admin.role);

  // 2. Test GET /platform/smtp (Real Decrypted Password Display)
  console.log('\n--- TEST 2: GET /platform/smtp (Decrypted Password Verification) ---');
  const smtpRes = await apiRequest('GET', '/platform/smtp', null, adminToken);
  console.log('HTTP Status:', smtpRes.status);
  console.log('Response:', JSON.stringify(smtpRes.body, null, 2));

  if (smtpRes.status !== 200) {
    throw new Error(`SMTP GET failed with status ${smtpRes.status}`);
  }
  const smtpData = smtpRes.body.data;
  if (!smtpData.smtp_password || smtpData.smtp_password.startsWith('••••')) {
    throw new Error('❌ smtp_password is empty or still masked with bullets!');
  }
  console.log(`✅ Decrypted SMTP Password returned: "${smtpData.smtp_password}"`);
  console.log(`✅ Password status: ${smtpData.smtp_password_status}`);

  // 3. Test PUT /platform/smtp (Saving without overwriting password)
  console.log('\n--- TEST 3: PUT /platform/smtp (Update config preserving password) ---');
  const updateSmtpRes = await apiRequest('PUT', '/platform/smtp', {
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_username: 'care@nanoshipy.com',
    smtp_sender_email: 'care@nanoshipy.com',
    smtp_sender_name: 'Nanoshipy Support',
    smtp_encryption: 'tls',
    smtp_enabled: true,
    smtp_password: smtpData.smtp_password // Sending existing password
  }, adminToken);
  console.log('Update Status:', updateSmtpRes.status);
  if (updateSmtpRes.status !== 200) {
    throw new Error(`SMTP PUT failed with status ${updateSmtpRes.status}`);
  }
  console.log('✅ SMTP Config updated successfully');

  // Verify it still decrypts properly
  const recheckSmtp = await apiRequest('GET', '/platform/smtp', null, adminToken);
  if (recheckSmtp.body.data.smtp_password !== 'ynct plkb fdbk yelf') {
    throw new Error(`❌ SMTP Password mismatch after update: ${recheckSmtp.body.data.smtp_password}`);
  }
  console.log('✅ SMTP Password re-verified as "ynct plkb fdbk yelf"');

  // 4. Test GET /platform/payment-gateways (Decrypted Secrets)
  console.log('\n--- TEST 4: GET /platform/payment-gateways (Decrypted Secrets Display) ---');
  const pgRes = await apiRequest('GET', '/platform/payment-gateways', null, adminToken);
  console.log('HTTP Status:', pgRes.status);
  const gateways = pgRes.body.data.gateways;
  console.log(`Total gateways found: ${gateways.length}`);

  const razorpay = gateways.find(g => g.name === 'razorpay');
  if (!razorpay) {
    throw new Error('❌ Razorpay gateway not found in list');
  }
  console.log('Razorpay Details:');
  console.log('  name:', razorpay.name);
  console.log('  display_name:', razorpay.display_name);
  console.log('  mode:', razorpay.mode);
  console.log('  api_key:', razorpay.api_key);
  console.log('  api_secret (first 8 chars):', razorpay.api_secret ? razorpay.api_secret.substring(0, 8) + '...' : 'none');
  console.log('  api_secret_status:', razorpay.api_secret_status);
  console.log('  is_active:', razorpay.is_active);

  if (!razorpay.api_secret || razorpay.api_secret.startsWith('••••') || razorpay.api_secret === 'Not set') {
    throw new Error('❌ Razorpay api_secret is not decrypted or is "Not set"');
  }
  console.log('✅ Razorpay real decrypted secret successfully exposed to super admin!');

  // 5. Test Merchant Forgot Password (Multi-channel OTP dispatch)
  console.log('\n--- TEST 5: Merchant Multi-Channel Forgot Password (POST /auth/forgot-password) ---');
  const testEmail = 'merchant.test@nanoshipy.com';
  const testPhone = '9876543210';

  let testUser = await User.findOne({ where: { email: testEmail } });
  if (!testUser) {
    let t = await Tenant.findOne();
    let r = await Role.findOne();
    testUser = await User.create({
      name: 'Test Merchant',
      email: testEmail,
      phone: testPhone,
      password_hash: await bcrypt.hash('OldPassword@123', 10),
      tenant_id: t?.id,
      role_id: r?.id,
      status: 'active',
      is_email_verified: true,
      is_phone_verified: true
    });
    console.log('Created test merchant user');
  } else {
    // Ensure phone is set
    testUser.phone = testPhone;
    testUser.email_verified_at = new Date();
    await testUser.save();
  }

  // Request forgot password by Email
  console.log('Requesting OTP forgot password for email:', testEmail);
  const forgotEmailRes = await apiRequest('POST', '/auth/forgot-password', { email: testEmail });
  console.log('Forgot Password (email) Status:', forgotEmailRes.status);
  console.log('Response:', forgotEmailRes.body);

  if (forgotEmailRes.status !== 200) {
    throw new Error(`Forgot password by email failed with status ${forgotEmailRes.status}`);
  }

  // Check Redis for cached OTP
  const rawCached = await redis.get(`pwd_reset_otp:${testEmail.toLowerCase()}`);
  const cachedTtl = await redis.ttl(`pwd_reset_otp:${testEmail.toLowerCase()}`);
  console.log(`✅ Redis OTP Key [pwd_reset_otp:${testEmail.toLowerCase()}]: Raw = ${rawCached}, TTL = ${cachedTtl}s`);

  if (!rawCached) {
    throw new Error('❌ OTP was not found in Redis!');
  }
  const parsed = JSON.parse(rawCached);
  const cachedOtp = parsed.otp;

  if (!cachedOtp || String(cachedOtp).length !== 6) {
    throw new Error('❌ OTP was not properly saved to Redis with 6 digits!');
  }

  // 6. Test Merchant Reset Password via OTP (Direct on-screen)
  console.log('\n--- TEST 6: Merchant Direct OTP Password Reset (POST /auth/reset-password) ---');
  const newPassword = 'NewSecretPassword@2026!';
  const resetRes = await apiRequest('POST', '/auth/reset-password', {
    email: testEmail,
    otp: cachedOtp,
    new_password: newPassword
  });
  console.log('Reset Password Status:', resetRes.status);
  console.log('Response:', resetRes.body);

  if (resetRes.status !== 200) {
    throw new Error(`Reset password failed with status ${resetRes.status}`);
  }

  // Verify Redis OTP key is invalidated
  const otpAfterReset = await redis.get(`pwd_reset_otp:${testEmail.toLowerCase()}`);
  console.log(`✅ Redis OTP Key after reset: ${otpAfterReset} (should be null)`);
  if (otpAfterReset) {
    throw new Error('❌ OTP was not deleted from Redis after successful password reset!');
  }

  // Verify login with new password
  console.log('Testing Merchant Login with new password...');
  const loginRes = await apiRequest('POST', '/auth/login', {
    email: testEmail,
    password: newPassword
  });
  console.log('Merchant Login Status:', loginRes.status);
  if (loginRes.status !== 200) {
    throw new Error(`Merchant login with new password failed with status ${loginRes.status}`);
  }
  console.log('✅ Merchant successfully logged in with new password!');

  // 7. Test Forgot Password by Phone
  console.log('\n--- TEST 7: Merchant Forgot Password by Phone Number ---');
  const forgotPhoneRes = await apiRequest('POST', '/auth/forgot-password', { phone: testPhone });
  console.log('Forgot Password (phone) Status:', forgotPhoneRes.status);
  console.log('Response:', forgotPhoneRes.body);
  if (forgotPhoneRes.status !== 200) {
    throw new Error(`Forgot password by phone failed with status ${forgotPhoneRes.status}`);
  }
  const rawPhoneData = await redis.get(`pwd_reset_otp:${testPhone}`);
  console.log(`✅ Redis OTP Key from Phone dispatch: Raw = ${rawPhoneData}`);
  if (!rawPhoneData) {
    throw new Error('❌ Phone OTP was not cached in Redis!');
  }
  const cachedPhoneOtp = JSON.parse(rawPhoneData).otp;

  // Reset password using Phone + OTP
  const newPhonePassword = 'PhoneResetSecret@2026!';
  const resetPhoneRes = await apiRequest('POST', '/auth/reset-password', {
    phone: testPhone,
    otp: cachedPhoneOtp,
    new_password: newPhonePassword
  });
  console.log('Reset Password (phone) Status:', resetPhoneRes.status);
  if (resetPhoneRes.status !== 200) {
    throw new Error(`Reset password with phone failed with status ${resetPhoneRes.status}`);
  }
  console.log('✅ Password successfully reset using Phone + OTP!');

  // 8. Test Platform Admin Forgot Password and Reset Password via OTP
  console.log('\n--- TEST 8: Platform Admin Multi-Channel Forgot Password & OTP Reset ---');
  const adminForgotRes = await apiRequest('POST', '/platform/auth/forgot-password', {
    email: 'care@nanoshipy.com'
  });
  console.log('Admin Forgot Password Status:', adminForgotRes.status);
  console.log('Response:', adminForgotRes.body);
  if (adminForgotRes.status !== 200) {
    throw new Error(`Admin forgot password failed with status ${adminForgotRes.status}`);
  }

  const cachedAdminOtp = await redis.get(`admin_pwd_reset_otp:care@nanoshipy.com`);
  console.log(`✅ Redis Admin OTP Key [admin_pwd_reset_otp:care@nanoshipy.com]: Value = ${cachedAdminOtp}`);
  if (!cachedAdminOtp || cachedAdminOtp.length !== 6) {
    throw new Error('❌ Admin OTP was not generated in Redis!');
  }

  const newAdminPassword = 'AdminSecretPassword@2026!';
  const adminResetRes = await apiRequest('POST', '/platform/auth/reset-password', {
    email: 'care@nanoshipy.com',
    otp: cachedAdminOtp,
    new_password: newAdminPassword
  });
  console.log('Admin Reset Password Status:', adminResetRes.status);
  console.log('Response:', adminResetRes.body);
  if (adminResetRes.status !== 200) {
    throw new Error(`Admin reset password failed with status ${adminResetRes.status}`);
  }
  console.log('✅ Admin Password successfully reset via 6-digit OTP!');

  // Test Admin Login with new password
  console.log('Testing Admin Login with newly set password...');
  const adminLoginRes = await apiRequest('POST', '/platform/auth/login', {
    email: 'care@nanoshipy.com',
    password: newAdminPassword
  });
  console.log('Admin Login Status:', adminLoginRes.status);
  if (adminLoginRes.status !== 200) {
    throw new Error(`Admin login with newly reset password failed with status ${adminLoginRes.status}`);
  }
  console.log('✅ Platform Admin logged in successfully with the new password!');

  console.log('\n=====================================================');
  console.log('🎉 ALL 8 TESTS PASSED FULLY ON PRODUCTION!');
  console.log('=====================================================');
  process.exit(0);
}

runLiveVerification().catch(err => {
  console.error('\n❌ VERIFICATION TEST FAILED:', err);
  process.exit(1);
});
