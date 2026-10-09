'use strict';

const nodemailer = require('nodemailer');

async function testCombos() {
  const combos = [
    { user: 'care@nanoshipy.com', pass: 'ynct plkb fdbk yelf', label: 'care@nanoshipy.com (with spaces)' },
    { user: 'care@nanoshipy.com', pass: 'ynctplkbfdbkyelf', label: 'care@nanoshipy.com (no spaces)' },
    { user: 'dineshtcr2004@gmail.com', pass: 'ynct plkb fdbk yelf', label: 'dineshtcr2004@gmail.com (with spaces)' },
    { user: 'dineshtcr2004@gmail.com', pass: 'ynctplkbfdbkyelf', label: 'dineshtcr2004@gmail.com (no spaces)' },
  ];

  for (const c of combos) {
    console.log(`\n--- Testing ${c.label} ---`);
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // TLS
      auth: {
        user: c.user,
        pass: c.pass,
      },
      tls: { rejectUnauthorized: false },
    });

    try {
      await transporter.verify();
      console.log(`>>> SUCCESS! Verified credentials for ${c.label}`);
      return c;
    } catch (err) {
      console.log(`>>> FAILED: ${err.message}`);
    }
  }
  return null;
}

testCombos().then((successCombo) => {
  console.log('\nFinal Result:', successCombo ? 'FOUND WORKING COMBO: ' + JSON.stringify(successCombo) : 'NO COMBO WORKED');
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
