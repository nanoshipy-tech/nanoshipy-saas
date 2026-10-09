'use strict';

const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
conn.on('ready', () => {
  const remoteCmd = `cd /var/www/nanoshipy/Saas-Frontend-main/backend && node -e '
require("dotenv").config({ path: "/var/www/nanoshipy/Saas-Frontend-main/backend/.env" });
(async () => {
  const { determineAssignedCourier } = require("/var/www/nanoshipy/Saas-Frontend-main/backend/src/services/courierRouting.service");
  const { StCourierServiceablePincode } = require("/var/www/nanoshipy/Saas-Frontend-main/backend/src/models");
  const STCourierAdapter = require("/var/www/nanoshipy/Saas-Frontend-main/backend/src/providers/stcourier/STCourierAdapter");
  const adapter = new STCourierAdapter();

  console.log("=== TEST 1: Serviceable Pincode Routing ===");
  await StCourierServiceablePincode.destroy({ where: {} });
  await StCourierServiceablePincode.create({ pincode: "641001", district: "Coimbatore", city: "Coimbatore" });

  const r1 = await determineAssignedCourier("641001", "Tamil Nadu", "639001", "Tamil Nadu");
  console.log("Whitelisted TN Pincode 641001 -> Provider:", r1.providerKey);
  console.log("Routing Reason:", r1.routingReason);

  const r2 = await determineAssignedCourier("643201", "Tamil Nadu", "639001", "Tamil Nadu");
  console.log("\\nNon-Whitelisted TN Pincode 643201 -> Provider:", r2.providerKey);
  console.log("Routing Reason:", r2.routingReason);

  console.log("\\n=== TEST 2: Strict AWB District Pool Isolation ===");
  try {
    await adapter.createShipment({
      order: { id: 99999, payment_mode: "prepaid", order_reference: "TEST-SALEM-1" },
      pickupAddress: { district: "Salem", city: "Salem", pincode: "636001" }
    });
    console.log("ERROR: Salem booking should have failed!");
  } catch (err) {
    console.log("SUCCESS: Salem booking strictly halted with error:");
    console.log(err.message);
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
'`;

  conn.exec(remoteCmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '34.93.11.164',
  port: 22,
  username: 'care',
  privateKey: fs.readFileSync('C:\\Users\\dines\\.ssh\\id_rsa'),
});
