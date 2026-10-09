'use strict';

const { Shipment, CostRateSnapshot, CourierProvider, Order } = require('../models');
const providerCredentialService = require('./providerCredential.service');
const ProviderFactory = require('../providers/ProviderFactory');
const logger = require('../utils/logger');

/**
 * Background Cost Reconciliation Service
 * Asynchronously captures real adapter cost from Shipway / carrier APIs,
 * populates cost_rate_snapshots, and updates shipment cost_rate & margin_amount.
 */
async function reconcileShipmentCost(shipmentId) {
  try {
    const shipment = await Shipment.findByPk(shipmentId, {
      include: [
        { model: Order, as: 'order', include: ['pickupAddress'] },
        { model: CourierProvider, as: 'courierProvider' },
      ],
    });

    if (!shipment || !shipment.order || !shipment.courierProvider) {
      logger.warn(`[CostTrackingService] Shipment ${shipmentId} missing required associations for cost reconciliation`);
      return null;
    }

    const provider = await CourierProvider.scope('withCredentials').findByPk(shipment.courier_provider_id);
    if (!provider || !provider.credentials_encrypted) {
      logger.warn(`[CostTrackingService] No credentials for provider ${shipment.courier_provider_id}`);
      return null;
    }

    const credentials = providerCredentialService.decrypt(provider.credentials_encrypted);
    const adapter = await ProviderFactory.getAdapter(provider.provider_key, credentials, provider.config || {}, provider.id);

    // Call live adapter.getRates() in background to capture true provider cost
    const rateResponse = await adapter.getRates({
      pickupPincode: shipment.order.pickupAddress ? shipment.order.pickupAddress.pincode : '',
      deliveryPincode: shipment.order.shipping_pincode,
      weight: shipment.declared_weight_kg,
      dimensions: {
        length: shipment.order.length_cm,
        width: shipment.order.width_cm,
        height: shipment.order.height_cm,
      },
      paymentMode: shipment.order.payment_mode,
      codAmount: shipment.order.cod_amount ? parseFloat(shipment.order.cod_amount) : 0,
    });

    let costPrice = parseFloat(shipment.selected_rate) * 0.70; // 30% margin fallback if adapter cost is omitted
    if (rateResponse.success && rateResponse.data && rateResponse.data.rates && rateResponse.data.rates.length > 0) {
      const match = rateResponse.data.rates.find(r => r.serviceType === shipment.service_type) || rateResponse.data.rates[0];
      if (match && match.price) {
        costPrice = parseFloat(match.price);
      }
    }

    const sellPrice = parseFloat(shipment.sell_rate || shipment.selected_rate);
    const marginAmount = sellPrice - costPrice;
    const marginPercent = sellPrice > 0 ? (marginAmount / sellPrice) * 100 : 0;

    // Create cost snapshot
    const snapshot = await CostRateSnapshot.create({
      shipment_id: shipment.id,
      courier_provider_id: shipment.courier_provider_id,
      cost_price: Math.round(costPrice * 100) / 100,
      sell_price: Math.round(sellPrice * 100) / 100,
      margin_amount: Math.round(marginAmount * 100) / 100,
      margin_percent: Math.round(marginPercent * 100) / 100,
      captured_at: new Date(),
    });

    // Update shipment columns
    await shipment.update({
      sell_rate: Math.round(sellPrice * 100) / 100,
      cost_rate: Math.round(costPrice * 100) / 100,
      margin_amount: Math.round(marginAmount * 100) / 100,
    });

    logger.info(`[CostTrackingService] Reconciled cost for Shipment ${shipment.id}: Sell=₹${sellPrice}, Cost=₹${costPrice}, Margin=₹${marginAmount} (${marginPercent.toFixed(1)}%)`);
    return snapshot;
  } catch (err) {
    logger.error(`[CostTrackingService] Cost reconciliation failed for shipment ${shipmentId}: ${err.message}`);
    return null;
  }
}

module.exports = {
  reconcileShipmentCost,
};
