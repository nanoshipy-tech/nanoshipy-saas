'use strict';

const emailService = require('../src/services/email.service');

async function test() {
  console.log('Testing live email sending via emailService to dineshtcr2004@gmail.com...');
  try {
    const res = await emailService.sendEmail({
      to: 'dineshtcr2004@gmail.com',
      subject: 'Nanoshipy SMTP Verification Test',
      htmlBody: '<div style="font-family: Arial, sans-serif; padding: 20px;"><h2>Nanoshipy SMTP Live Verification</h2><p>Your Google App Password (ynct plkb fdbk yelf) is functioning properly on Nanoshipy.</p></div>',
    });
    console.log('Send Email Result:', res);
  } catch (err) {
    console.error('Send Email Failed with Error:', err);
  }
}

test().then(() => process.exit(0)).catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
