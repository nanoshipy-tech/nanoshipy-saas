'use strict';

const axios = require('axios');

async function testLive() {
  try {
    console.log('Logging in to https://api.nanoshipy.com/api/v1/platform/auth/login...');
    const loginRes = await axios.post('https://api.nanoshipy.com/api/v1/platform/auth/login', {
      email: 'care@nanoshipy.com',
      password: 'Care@202601',
    });

    const token = loginRes.data?.data?.access_token || loginRes.data?.data?.accessToken;
    if (!token) {
      throw new Error('No access token received: ' + JSON.stringify(loginRes.data));
    }
    console.log('Login successful! Access token obtained.');

    console.log('\nQuerying https://api.nanoshipy.com/api/v1/admin/reports/seller-overdue...');
    const overdueRes = await axios.get('https://api.nanoshipy.com/api/v1/admin/reports/seller-overdue', {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log('Status code:', overdueRes.status);
    console.log('Summary:', overdueRes.data?.data?.summary);
    console.log('Rows returned:', overdueRes.data?.data?.rows?.length);
    console.log('Sellers returned:', overdueRes.data?.data?.sellers?.length);
    console.log('Pagination:', overdueRes.data?.data?.pagination);

    console.log('\nQuerying export endpoint...');
    const exportRes = await axios.get('https://api.nanoshipy.com/api/v1/admin/reports/seller-overdue/export?format=csv', {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('Export status code:', exportRes.status);
    console.log('Content-Type:', exportRes.headers['content-type']);
    console.log('Content-Disposition:', exportRes.headers['content-disposition']);
    console.log('Export data preview (first 100 bytes):', exportRes.data.slice(0, 100));

    console.log('\nALL LIVE SELLER OVERDUE TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    if (err.response) {
      console.error('API Error Response:', err.response.status, err.response.data);
    } else {
      console.error('Error:', err.message);
    }
    process.exit(1);
  }
}

testLive();
