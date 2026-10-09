'use strict';

const { Order, Shipment, ShopifyConnection, StorefrontConnection, CourierProvider } = require('./src/models');
const { Op } = require('sequelize');

async function run() {
  try {
    console.log('=== 1. SHOPIFY CONNECTIONS ===');
    const conns = await ShopifyConnection.findAll({ raw: true });
    console.log(`Found ${conns.length} ShopifyConnection rows:`);
    for (const c of conns) {
      console.log(`- ID: ${c.id}`);
      console.log(`  Tenant: ${c.tenant_id}`);
      console.log(`  Shop: ${c.shop_domain}`);
      console.log(`  Status: ${c.status}`);
      console.log(`  Token format: ${c.access_token ? c.access_token.substring(0, 15) + '...' : 'none'}`);
      console.log(`  Method: ${c.connection_method}`);
      console.log(`  Scopes: ${c.scopes}`);
    }

    console.log('\n=== 2. RECENT ORDERS (Shopify or External) ===');
    const orders = await Order.findAll({
      where: {
        [Op.or]: [
          { storefront_connection_id: { [Op.ne]: null } },
          { external_order_id: { [Op.ne]: null } },
          { order_reference: { [Op.like]: 'SHP-%' } },
          { order_reference: { [Op.like]: '#%' } },
        ],
      },
      order: [['created_at', 'DESC']],
      limit: 10,
      raw: true,
    });
    console.log(`Found ${orders.length} orders:`);
    for (const o of orders) {
      console.log(`- Order ID: ${o.id}`);
      console.log(`  Ref: ${o.order_reference}`);
      console.log(`  Ext ID: ${o.external_order_id}`);
      console.log(`  Conn ID: ${o.storefront_connection_id}`);
      console.log(`  Status: ${o.status}`);
      console.log(`  Tenant: ${o.tenant_id}`);
    }

    if (orders.length > 0) {
      const orderIds = orders.map(o => o.id);
      console.log('\n=== 3. SHIPMENTS FOR THESE ORDERS ===');
      const shipments = await Shipment.findAll({
        where: { order_id: { [Op.in]: orderIds } },
        raw: true,
      });
      console.log(`Found ${shipments.length} shipments:`);
      for (const s of shipments) {
        console.log(`- Shipment ID: ${s.id}`);
        console.log(`  Order ID: ${s.order_id}`);
        console.log(`  AWB: ${s.awb_number}`);
        console.log(`  Status: ${s.status}`);
        console.log(`  Courier ID: ${s.courier_provider_id}`);
      }
    }

    console.log('\n=== 4. TEST TOKEN DECRYPTION FOR ACTIVE CONNECTIONS ===');
    const shopifyIntegrationService = require('./src/services/shopifyIntegration.service');
    for (const c of conns) {
      const token = shopifyIntegrationService.decryptToken(c.access_token);
      console.log(`Shop: ${c.shop_domain} -> Decrypted token valid: ${Boolean(token && token.startsWith('shpat_'))} (prefix: ${token ? token.substring(0, 10) : 'null'})`);
    }

  } catch (err) {
    console.error('Diagnostic error:', err);
  } finally {
    process.exit(0);
  }
}

run();
