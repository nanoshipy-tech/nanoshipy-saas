'use strict';

const { Order, ShipmentRateQuote, CourierProvider } = require('../models');
const { OrderNotShippableError } = require('../utils/errors');
const tenantCourierAccessRepository = require('../repositories/tenantCourierAccess.repository');
const providerCredentialService = require('./providerCredential.service');
const providerHealthService = require('./providerHealth.service');
const ProviderFactory = require('../providers/ProviderFactory');
const courierRoutingService = require('./courierRouting.service');
const config = require('../config/env');
const auditService = require('./audit.service');
const carrierMarginConfigService = require('./carrierMarginConfig.service');
const logger = require('../utils/logger');
const { sanitizeCourierDisplayName, resolveCleanCarrierLogo } = require('../utils/courierBranding.util');

/**
 * Fetch and compare courier shipping rates in parallel with geo-allocation and price masking.
 *
 * @param {string} orderId
 * @param {string} tenantId
 * @param {string} userId
 * @returns {Promise<object>} Result containing user rate cards, allocation badges, and expiry
 */
const compareRates = async (orderId, tenantId, userId) => {
  // 1. Load order
  const order = await Order.findOne({
    where: { id: orderId, tenant_id: tenantId },
    include: ['pickupAddress'],
  });

  if (!order) {
    throw new OrderNotShippableError('Order not found');
  }

  // Allow rate comparison for pending, processing, ready_to_ship, and cancelled (re-ship)
  if (!['pending', 'processing', 'ready_to_ship', 'cancelled'].includes(order.status)) {
    throw new OrderNotShippableError(`Order is in status "${order.status}" and is not shippable`);
  }

  const tenantAccess = await tenantCourierAccessRepository.listByTenant(tenantId);
  let activeProviders = tenantAccess.map(access => access.provider);

  // Determine geographic allocation (Intra-TN -> ST Courier vs Rest of India -> Shipway)
  const routingAllocation = await courierRoutingService.determineAssignedCourier(
    order.shipping_pincode,
    order.shipping_state,
    order.pickupAddress ? order.pickupAddress.pincode : null,
    order.pickupAddress ? order.pickupAddress.state : null
  );

  // Strict Geo-Routing filter:
  if (routingAllocation.isLocal) {
    // LOCAL / INTRA-TAMIL NADU: Exclusively ST Courier
    activeProviders = activeProviders.filter(p => p.provider_key === 'stcourier');
    if (activeProviders.length === 0) {
      const stProvider = await CourierProvider.findOne({ where: { provider_key: 'stcourier', is_active: true } });
      if (stProvider) activeProviders = [stProvider];
    }
  } else {
    // INTERSTATE / OTHER STATES: Exclusively Shipway (National Multi-Carrier Gateway)
    const shipwayProvider = activeProviders.find(p => p.provider_key === 'shipway') ||
      await CourierProvider.findOne({ where: { provider_key: 'shipway', is_active: true } });
    if (shipwayProvider) {
      activeProviders = [shipwayProvider];
    } else {
      activeProviders = activeProviders.filter(p => p.provider_key !== 'stcourier');
    }
  }

  const rates = [];
  const unavailableProviders = [];
  const ratePromises = [];

  const expiryMinutes = config.shipment.rateQuoteExpiryMinutes || 30;
  const quoteExpiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  const { getRedisClient } = require('../config/redis.config');
  const redis = getRedisClient();
  const weightSlab = Math.ceil(parseFloat(order.weight_kg) * 2) / 2;
  const pickupPin = order.pickupAddress ? order.pickupAddress.pincode : '000000';
  const destPin = order.shipping_pincode;

  // 3. Query adapters in parallel with Redis cache fallback
  for (const provider of activeProviders) {
    const promise = (async () => {
      // Check health status of provider
      const healthy = await providerHealthService.isHealthy(provider.id);
      if (!healthy) {
        throw new Error('PROVIDER_UNHEALTHY');
      }

      const cacheKey = `rate_cache:${provider.id}:${pickupPin}:${destPin}:${weightSlab}:${order.payment_mode}`;
      if (redis) {
        try {
          const cached = await redis.get(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            return {
              providerId: provider.id,
              displayName: provider.display_name,
              providerKey: provider.provider_key,
              adapterRates: parsed,
              cached: true,
            };
          }
        } catch (cacheErr) {
          // ignore cache read error and proceed to live fetch
        }
      }

      // Fetch decrypted credentials
      const fullProvider = await CourierProvider.scope('withCredentials').findByPk(provider.id);
      const credentials = providerCredentialService.decrypt(fullProvider.credentials_encrypted);
      const adapter = await ProviderFactory.getAdapter(provider.provider_key, credentials, provider.config || {}, provider.id);

      // Apply timeout ceiling to rate fetch
      const timeoutMs = config.shipment.rateComparisonTimeoutMs || 5000;

      const rateFetch = adapter.getRates({
        pickupPincode: order.pickupAddress ? order.pickupAddress.pincode : '110001',
        deliveryPincode: order.shipping_pincode,
        weight: order.weight_kg,
        dimensions: {
          length: order.length_cm,
          width: order.width_cm,
          height: order.height_cm,
        },
        paymentMode: order.payment_mode,
        codAmount: order.cod_amount ? parseFloat(order.cod_amount) : 0,
      });

      const response = await Promise.race([
        rateFetch,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)
        ),
      ]);

      if (!response.success) {
        throw response.error || new Error('FAILED');
      }

      if (redis && response.data && response.data.rates) {
        redis.set(cacheKey, JSON.stringify(response.data.rates), 'EX', 900).catch(() => {});
      }

      return {
        providerId: provider.id,
        displayName: provider.display_name,
        providerKey: provider.provider_key,
        logoUrl: provider.logo_url,
        adapterRates: response.data.rates,
      };
    })();

    ratePromises.push(promise);
  }

  const results = await Promise.allSettled(ratePromises);

  // 4. Process and persist rate quotes with Admin markup
  const quotesToInsert = [];

  for (let i = 0; i < results.length; i++) {
    const provider = activeProviders[i];
    const result = results[i];

    if (result.status === 'fulfilled') {
      const val = result.value;
      for (const r of val.adapterRates) {
        const quoteId = require('uuid').v4();

        // Resolve platform margin for this tenant+carrier combination
        const margin = await carrierMarginConfigService.resolveMargin(val.providerId, tenantId);
        const effectivePrice = carrierMarginConfigService.applyMargin(parseFloat(r.price), margin);

        quotesToInsert.push({
          id: quoteId,
          order_id: orderId,
          courier_provider_id: val.providerId,
          service_type: r.serviceType,
          price: effectivePrice,
          cod_charge: r.codCharge || 0.00,
          estimated_days: r.estimatedDays,
          quoted_at: new Date(),
          expires_at: quoteExpiresAt,
        });

        // Check if this courier matches the geo-routing allocation
        const isMatchedAllocation = (routingAllocation.isLocal && (val.providerKey === 'stcourier' || val.providerKey === 'local' || val.providerKey === 'mock')) ||
          (!routingAllocation.isLocal && (val.providerKey === 'shipway' || val.providerKey === 'delhivery' || val.providerKey === 'bluedart' || val.providerKey === 'xpressbees'));

        let displayName = val.displayName;
        if (val.providerKey === 'shipway' || (displayName && displayName.toLowerCase().includes('shipway'))) {
          displayName = sanitizeCourierDisplayName(r.courierName || r.carrierTitle || val.displayName, r.serviceType);
        }

        const logoUrl = resolveCleanCarrierLogo(displayName, r.serviceType, val.logoUrl || provider.logo_url);

        rates.push({
          courier_provider_id: val.providerId,
          display_name: displayName,
          logo_url: logoUrl,
          provider_key: val.providerKey,
          service_type: r.serviceType,
          price: effectivePrice, // User only sees this marked-up selling price!
          cod_charge: parseFloat(r.codCharge || 0.00),
          estimated_days: r.estimatedDays,
          zone: r.zone || routingAllocation.zoneName,
          is_allocated: isMatchedAllocation,
          allocation_badge: isMatchedAllocation ? 'Recommended by Routing' : null,
          routing_reason: isMatchedAllocation ? routingAllocation.routingReason : null,
        });
      }
    } else {
      const reason = result.reason;
      logger.warn(`Rate query failed for courier ${provider?.display_name}: ${reason?.message || reason}`);
      if (provider) {
        unavailableProviders.push({
          display_name: provider.display_name,
          reason: reason?.code || reason?.message || 'SERVICE_UNAVAILABLE',
        });
      }
    }
  }

  // Persist quotes in DB for audit trail and price tampering checks
  if (quotesToInsert.length > 0) {
    await ShipmentRateQuote.bulkCreate(quotesToInsert);
  }

  // Attach dynamic courier performance scores and badges
  const courierProviderService = require('./courierProvider.service');
  for (const rate of rates) {
    rate.rating_score = await courierProviderService.computeDynamicCourierScore(rate.courier_provider_id);
  }

  // Sort rates: Allocated courier first, then by price
  rates.sort((a, b) => {
    if (a.is_allocated && !b.is_allocated) return -1;
    if (!a.is_allocated && b.is_allocated) return 1;
    return a.price - b.price;
  });

  // Ensure ONLY the single optimal top-ranked courier is marked as allocated
  rates.forEach((r, idx) => {
    r.is_allocated = (idx === 0);
  });

  if (rates.length > 0) {
    const minPrice = Math.min(...rates.map(r => r.price));
    const minDays = Math.min(...rates.map(r => r.estimated_days || 99));
    const maxScore = Math.max(...rates.map(r => r.rating_score || 0));

    rates.forEach(r => {
      r.is_cheapest = r.price === minPrice;
      r.is_fastest = (r.estimated_days || 99) === minDays;
      r.is_best_rated = (r.rating_score || 0) === maxScore;
    });
  }

  // Log Audit trail safely
  if (userId) {
    try {
      await auditService.log({
        tenant_id: tenantId,
        user_id: userId,
        action: 'rates_compared',
        entity_type: 'Order',
        entity_id: orderId,
        metadata: {
          queried_count: activeProviders.length,
          success_count: rates.length,
          destination_pincode: order.shipping_pincode,
          routing_allocation: routingAllocation,
          failed_providers: unavailableProviders.map(p => p.display_name),
        },
      });
    } catch (auditErr) {
      logger.warn(`[RateComparison] Audit log skipped: ${auditErr.message}`);
    }
  }

  return {
    order_id: orderId,
    routing_allocation: routingAllocation,
    rates,
    quote_expires_at: quoteExpiresAt.toISOString(),
    unavailable_providers: unavailableProviders,
  };
};

module.exports = {
  compareRates,
};
