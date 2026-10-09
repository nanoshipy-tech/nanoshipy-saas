'use strict';

const axios = require('axios');
const { Order, Shipment, ShopifyConnection } = require('./src/models');
const shopifyIntegrationService = require('./src/services/shopifyIntegration.service');

async function testFulfill() {
  try {
    const conn = await ShopifyConnection.findOne({ where: { status: 'connected' } });
    if (!conn) {
      console.log('No connected Shopify found');
      return;
    }

    const plainToken = shopifyIntegrationService.decryptToken(conn.access_token);
    console.log('Shop:', conn.shop_domain);
    console.log('Token prefix:', plainToken.substring(0, 10));

    const shopifyOrderId = '6800298246326';
    const awbNumber = '30234044939214';
    const carrierName = 'ST Courier';
    const trackingUrl = `https://app.nanoshipy.com/track/${awbNumber}`;

    const host = conn.shop_domain;
    const client = axios.create({
      baseURL: `https://${host}/admin/api/2024-01`,
      headers: { 'X-Shopify-Access-Token': plainToken, 'Content-Type': 'application/json' },
    });

    console.log('\n1. Testing GET /admin/api/2024-01/orders/' + shopifyOrderId + '.json');
    try {
      const ordRes = await client.get(`/orders/${shopifyOrderId}.json`);
      const ord = ordRes.data.order;
      console.log('Order status:', ord.financial_status, ord.fulfillment_status);
      console.log('Fulfillments count:', ord.fulfillments?.length);
    } catch (e) {
      console.log('Order fetch failed:', e.response?.status, e.response?.data || e.message);
    }

    console.log('\n2. Testing GET /admin/api/2024-01/orders/' + shopifyOrderId + '/fulfillment_orders.json');
    let foData;
    try {
      const foRes = await client.get(`/orders/${shopifyOrderId}/fulfillment_orders.json`);
      foData = foRes.data;
      console.log('Fulfillment Orders:', JSON.stringify(foData, null, 2));
    } catch (e) {
      console.log('Fulfillment orders fetch failed:', e.response?.status, e.response?.data || e.message);
    }

    console.log('\n3. Testing shopifyIntegrationService.fulfillOrder(...)');
    const result = await shopifyIntegrationService.fulfillOrder(
      conn,
      plainToken,
      shopifyOrderId,
      awbNumber,
      carrierName,
      trackingUrl
    );
    console.log('fulfillOrder result:', JSON.stringify(result, null, 2));

  } catch (err) {
    console.error('Fatal test error:', err);
  } finally {
    process.exit(0);
  }
}

testFulfill();
