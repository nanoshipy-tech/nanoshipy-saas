'use strict';

const SalesChannelAdapterInterface = require('../base/SalesChannelAdapter.interface');
const axios = require('axios');

class WooCommerceAdapter extends SalesChannelAdapterInterface {
  constructor(config = {}) {
    super();
    this.storeUrl = config.storeUrl;
    this.consumerKey = config.consumerKey;
    this.consumerSecret = config.consumerSecret;
  }

  async fetchOrders(options = {}) {
    if (!this.storeUrl || !this.consumerKey || !this.consumerSecret) {
      throw new Error('WooCommerce credentials missing');
    }
    const baseUrl = this.storeUrl.replace(/\/$/, '');
    const url = `${baseUrl}/wp-json/wc/v3/orders?status=processing&per_page=${options.limit || 50}`;

    try {
      const authHeader = 'Basic ' + Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
      const response = await axios.get(url, {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      });

      const wooOrders = response.data || [];
      return wooOrders.map(order => ({
        external_order_id: String(order.id),
        order_number: String(order.number || order.id),
        customer_name: order.shipping ? `${order.shipping.first_name} ${order.shipping.last_name}` : `${order.billing.first_name} ${order.billing.last_name}`,
        customer_email: order.billing?.email || '',
        customer_phone: order.billing?.phone || '',
        shipping_address: order.shipping ? {
          line1: order.shipping.address_1,
          line2: order.shipping.address_2,
          city: order.shipping.city,
          state: order.shipping.state,
          pincode: order.shipping.postcode,
          country: order.shipping.country || 'India',
        } : null,
        total_amount: parseFloat(order.total || 0),
        payment_method: order.payment_method === 'cod' ? 'cod' : 'prepaid',
        items: (order.line_items || []).map(item => ({
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          price: parseFloat(item.price),
        })),
        raw_payload: order,
      }));
    } catch (err) {
      throw new Error(`WooCommerce API order fetch failed: ${err.message}`);
    }
  }

  async pushTrackingUpdate(externalOrderId, trackingData) {
    if (!this.storeUrl || !this.consumerKey || !this.consumerSecret) {
      throw new Error('WooCommerce credentials missing');
    }
    const baseUrl = this.storeUrl.replace(/\/$/, '');
    const url = `${baseUrl}/wp-json/wc/v3/orders/${externalOrderId}`;

    try {
      const authHeader = 'Basic ' + Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
      const payload = {
        status: 'completed',
        meta_data: [
          { key: '_tracking_number', value: trackingData.awb },
          { key: '_tracking_provider', value: trackingData.courierName },
          { key: '_tracking_url', value: trackingData.trackingUrl },
        ],
      };
      const response = await axios.put(url, payload, {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (err) {
      throw new Error(`WooCommerce tracking update failed: ${err.message}`);
    }
  }

  verifyWebhook(req) {
    const crypto = require('crypto');
    const signature = req.headers['x-wc-webhook-signature'];
    const secret = process.env.WOOCOMMERCE_WEBHOOK_SECRET;

    if (!signature || !secret) return false;
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const hash = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  }
}

module.exports = WooCommerceAdapter;
