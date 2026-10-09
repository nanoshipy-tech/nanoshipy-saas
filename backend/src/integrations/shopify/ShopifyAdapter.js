'use strict';

const SalesChannelAdapterInterface = require('../base/SalesChannelAdapter.interface');
const axios = require('axios');

class ShopifyAdapter extends SalesChannelAdapterInterface {
  constructor(config = {}) {
    super();
    this.storeUrl = config.storeUrl;
    this.accessToken = config.accessToken;
    this.apiVersion = config.apiVersion || '2024-01';
  }

  async fetchOrders(options = {}) {
    if (!this.storeUrl || !this.accessToken) {
      throw new Error('Shopify credentials missing');
    }
    const cleanUrl = this.storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const url = `https://${cleanUrl}/admin/api/${this.apiVersion}/orders.json?status=open&limit=${options.limit || 50}`;

    try {
      const response = await axios.get(url, {
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json',
        },
      });

      const shopifyOrders = response.data.orders || [];
      return shopifyOrders.map(order => ({
        external_order_id: String(order.id),
        order_number: String(order.name || order.order_number),
        customer_name: order.shipping_address ? `${order.shipping_address.first_name} ${order.shipping_address.last_name}` : 'Customer',
        customer_email: order.email,
        customer_phone: order.shipping_address?.phone || order.phone || '',
        shipping_address: order.shipping_address ? {
          line1: order.shipping_address.address1,
          line2: order.shipping_address.address2,
          city: order.shipping_address.city,
          state: order.shipping_address.province,
          pincode: order.shipping_address.zip,
          country: order.shipping_address.country || 'India',
        } : null,
        total_amount: parseFloat(order.total_price || 0),
        payment_method: order.financial_status === 'paid' ? 'prepaid' : 'cod',
        items: (order.line_items || []).map(item => ({
          name: item.name || item.title,
          sku: item.sku,
          quantity: item.quantity,
          price: parseFloat(item.price),
        })),
        raw_payload: order,
      }));
    } catch (err) {
      throw new Error(`Shopify API order fetch failed: ${err.message}`);
    }
  }

  async pushTrackingUpdate(externalOrderId, trackingData) {
    if (!this.storeUrl || !this.accessToken) {
      throw new Error('Shopify credentials missing');
    }
    const cleanUrl = this.storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const url = `https://${cleanUrl}/admin/api/${this.apiVersion}/orders/${externalOrderId}/fulfillments.json`;

    try {
      const payload = {
        fulfillment: {
          location_id: trackingData.locationId || null,
          tracking_number: trackingData.awb,
          tracking_company: trackingData.courierName || 'Courier',
          tracking_url: trackingData.trackingUrl || '',
          notify_customer: true,
        },
      };
      const response = await axios.post(url, payload, {
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (err) {
      throw new Error(`Shopify tracking update failed: ${err.message}`);
    }
  }

  verifyWebhook(req) {
    const crypto = require('crypto');
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    const secret = req.headers['x-shopify-secret'] || process.env.SHOPIFY_WEBHOOK_SECRET;

    if (!hmacHeader || !secret) return false;
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const hash = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader));
  }
}

module.exports = ShopifyAdapter;
