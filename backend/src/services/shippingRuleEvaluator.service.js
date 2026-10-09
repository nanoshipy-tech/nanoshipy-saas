'use strict';

const { ShippingAllocationRule } = require('../models');
const logger = require('../utils/logger');

/**
 * Normalizes zone identifier to match rule configurations.
 * Handles: 'intra_state', 'regional', 'metro', 'rest_of_india', 'special',
 * 'Zone A', 'Zone B', 'Zone C', 'Zone D', 'Zone E', 'A', 'B', 'C', 'D', 'E'
 */
function normalizeZoneKey(zone) {
  if (!zone) return 'all';
  const z = String(zone).toLowerCase().trim();
  if (z.includes('intra') || z === 'a' || z === 'zone a') return 'intra_state';
  if (z.includes('reg') || z === 'b' || z === 'zone b') return 'regional';
  if (z.includes('met') || z === 'c' || z === 'zone c') return 'metro';
  if (z.includes('roi') || z.includes('rest') || z === 'd' || z === 'zone d') return 'rest_of_india';
  if (z.includes('spec') || z === 'e' || z === 'zone e') return 'special';
  return z;
}

/**
 * Checks if a courier from a rule matches a rate item returned by the carrier/provider.
 */
function matchesCourier(rateItem, targetCourierKey, targetCourierName) {
  if (!rateItem) return false;

  const serviceType = String(rateItem.service_type || rateItem.serviceType || rateItem.carrierId || '').trim();
  const targetKey = String(targetCourierKey || '').trim();

  // 1. Direct ID / ServiceType match (e.g., '80622', '80734', '7613', '7377', 'stcourier')
  if (serviceType && targetKey && serviceType.toLowerCase() === targetKey.toLowerCase()) {
    return true;
  }

  // 2. ST Courier match
  if (targetKey === 'stcourier' || targetKey === 'st_courier_surface') {
    if (rateItem.provider_key === 'stcourier' || serviceType === 'st_courier_surface') {
      return true;
    }
  }

  // 3. Name/Brand matching
  const rateDisplayName = String(rateItem.display_name || rateItem.courierName || rateItem.carrierTitle || '').toLowerCase();
  const targetName = String(targetCourierName || '').toLowerCase();

  if (targetName && rateDisplayName.includes(targetName)) {
    return true;
  }

  // Common aliases and weight slab lookups
  if (targetKey === '80622' && (rateDisplayName.includes('delhivery') && rateDisplayName.includes('surface'))) return true;
  if (targetKey === '80734' && (rateDisplayName.includes('delhivery') && (rateDisplayName.includes('1kg') || rateDisplayName.includes('1 kg') || rateDisplayName.includes('surface')))) return true;
  if (targetKey === '80977' && (rateDisplayName.includes('delhivery') && (rateDisplayName.includes('2kg') || rateDisplayName.includes('2 kg') || rateDisplayName.includes('surface')))) return true;
  if (targetKey === '7613' && (rateDisplayName.includes('delhivery') && (rateDisplayName.includes('5kg') || rateDisplayName.includes('5 kg') || rateDisplayName.includes('surface')))) return true;
  if (targetKey === '7666' && (rateDisplayName.includes('delhivery') && (rateDisplayName.includes('10kg') || rateDisplayName.includes('10 kg') || rateDisplayName.includes('surface')))) return true;
  if (targetKey === '7442' && (rateDisplayName.includes('delhivery') && (rateDisplayName.includes('express') || rateDisplayName.includes('air')))) return true;
  if (targetKey === '81769' && (rateDisplayName.includes('bluedart') || rateDisplayName.includes('blue dart')) && rateDisplayName.includes('surface')) return true;
  if (targetKey === '7377' && (rateDisplayName.includes('bluedart') || rateDisplayName.includes('blue dart')) && (rateDisplayName.includes('express') || rateDisplayName.includes('air'))) return true;
  if (targetKey === '80593' && rateDisplayName.includes('xpressbees') && rateDisplayName.includes('surface')) return true;
  if (targetKey === '80652' && rateDisplayName.includes('xpressbees') && (rateDisplayName.includes('air') || rateDisplayName.includes('priority'))) return true;
  if (targetKey === '79681' && rateDisplayName.includes('shadowfax')) return true;
  if (targetKey === '79930' && rateDisplayName.includes('shadowfax')) return true;
  if ((targetKey === '71468' || targetKey === '80275' || targetKey === '80063' || targetKey === '80064' || targetKey === '82861') && rateDisplayName.includes('ekart')) return true;
  if (targetKey === '81514' && rateDisplayName.includes('ekart') && (rateDisplayName.includes('air') || rateDisplayName.includes('express'))) return true;
  if (targetKey === '19339' && rateDisplayName.includes('amazon')) return true;
  if (targetKey === '80800' && rateDisplayName.includes('dtdc')) return true;
  if (targetKey === 'smartr' && rateDisplayName.includes('smartr')) return true;

  return false;
}

class ShippingRuleEvaluatorService {
  /**
   * Evaluates active shipping rules against order attributes and available serviceable rates.
   *
   * @param {Object} params
   * @param {string} params.tenantId - Seller/Tenant UUID
   * @param {string} [params.pickupAddressId] - Booking office / pickup warehouse UUID
   * @param {number} params.weightKg - Billable package weight in kg
   * @param {boolean} params.isCod - Whether order is COD
   * @param {string} [params.paymentMode] - 'prepaid', 'cod', 'to_pay'
   * @param {string} [params.zone] - Destination zone
   * @param {string} [params.deliveryPincode] - Destination pincode
   * @param {Array<Object>} params.availableRates - List of serviceable rates returned by carriers
   * @param {boolean} [params.isLocalTn=false] - Whether route is Intra-Tamil Nadu
   * @returns {Promise<{ allocatedRate: Object, matchedRule: Object|null, priorityRank: number|null, allocationBadge: string, routingReason: string, evaluatedRulesCount: number }>}
   */
  async evaluateOptimalCourier({
    tenantId,
    pickupAddressId = null,
    weightKg = 0.5,
    isCod = false,
    paymentMode = 'prepaid',
    zone = 'all',
    deliveryPincode = '',
    availableRates = [],
    isLocalTn = false,
  }) {
    if (!Array.isArray(availableRates) || availableRates.length === 0) {
      return {
        allocatedRate: null,
        matchedRule: null,
        priorityRank: null,
        allocationBadge: 'No Active Rates',
        routingReason: 'No serviceable courier partners available for this delivery route',
        evaluatedRulesCount: 0,
      };
    }

    const normWeight = Math.max(0.01, parseFloat(weightKg) || 0.5);
    const normPayment = isCod ? 'cod' : (paymentMode === 'to_pay' ? 'to_pay' : 'prepaid');
    const normZone = normalizeZoneKey(zone);

    // 1. Fetch all active shipping allocation rules ordered by priority ASC (1 is highest priority)
    let allRules = [];
    try {
      allRules = await ShippingAllocationRule.findAll({
        where: { is_active: true },
        order: [['priority', 'ASC'], ['created_at', 'ASC']],
      });
    } catch (err) {
      logger.warn(`[ShippingRuleEvaluator] Failed to query rules: ${err.message}. Falling back to default routing.`);
    }

    // 2. Separate into scope priority tiers:
    //    Tier 1: Specific Booking Office (Branch Hub)
    //    Tier 2: Specific Seller (Tenant)
    //    Tier 3: Global Rules (Platform Default)
    const officeRules = pickupAddressId
      ? allRules.filter(r => r.scope === 'booking_office' && r.pickup_address_id === pickupAddressId)
      : [];
    const sellerRules = tenantId
      ? allRules.filter(r => r.scope === 'seller' && r.tenant_id === tenantId)
      : [];
    const globalRules = allRules.filter(r => r.scope === 'global');

    // Combine candidate rules in strict specificity order
    const candidateRules = [...officeRules, ...sellerRules, ...globalRules];

    // 3. Evaluate each candidate rule in priority order
    for (const rule of candidateRules) {
      // Condition 1: Payment Mode Match
      if (rule.payment_mode && rule.payment_mode !== 'all') {
        const rulePay = rule.payment_mode.toLowerCase();
        if (rulePay === 'cod' && !isCod) continue;
        if (rulePay === 'prepaid' && isCod) continue;
        if (rulePay === 'to_pay' && normPayment !== 'to_pay') continue;
      }

      // Condition 2: Weight Range Match
      const minW = parseFloat(rule.min_weight_kg || 0);
      const maxW = parseFloat(rule.max_weight_kg || 999);
      if (normWeight < minW || normWeight > maxW) {
        continue;
      }

      // Condition 3: Zone Match
      if (rule.zone && rule.zone !== 'all') {
        const ruleZoneNorm = normalizeZoneKey(rule.zone);
        if (ruleZoneNorm !== normZone && rule.zone.toLowerCase() !== zone.toLowerCase()) {
          continue;
        }
      }

      // RULE MATCHED! Now check the up to 5 prioritized couriers in fallback order
      const courierPriorities = Array.isArray(rule.courier_priorities) ? rule.courier_priorities : [];

      if (courierPriorities.length === 0) {
        // Rule has no explicit courier list -> skip to next
        continue;
      }

      const bypassedCouriers = [];

      for (const cp of courierPriorities) {
        const priorityNumber = cp.priority || (courierPriorities.indexOf(cp) + 1);
        const targetKey = cp.courier_key || cp.service_type || cp.id;
        const targetName = cp.name || cp.courier_name || cp.courierName || '';

        // Check if this prioritized courier is serviceable in the available rates list
        const matchedRate = availableRates.find(r => matchesCourier(r, targetKey, targetName));

        if (matchedRate) {
          // Found highest-priority serviceable courier!
          const bypassNote = bypassedCouriers.length > 0
            ? ` (Unserviceable higher priorities bypassed: ${bypassedCouriers.join(', ')})`
            : '';

          const scopeBadge = rule.scope === 'booking_office'
            ? '🏢 Booking Office Rule'
            : (rule.scope === 'seller' ? '🏷️ Seller Rule' : '🌐 Global Shipping Rule');

          return {
            allocatedRate: matchedRate,
            matchedRule: rule,
            priorityRank: priorityNumber,
            allocationBadge: `⚡ Auto-Allocated: ${rule.name} (Priority ${priorityNumber})`,
            routingReason: `Allocated via ${scopeBadge} "${rule.name}" [Priority ${priorityNumber}: ${targetName || matchedRate.display_name}]${bypassNote}`,
            evaluatedRulesCount: candidateRules.length,
          };
        } else {
          // This priority courier is not serviceable for this route -> track and fall back to next priority
          bypassedCouriers.push(`P${priorityNumber} (${targetName || targetKey})`);
        }
      }

      // If all couriers in this rule were unserviceable, loop continues to next matching rule
      logger.info(`[ShippingRuleEvaluator] Rule "${rule.name}" matched but none of its ${courierPriorities.length} couriers were serviceable for pincode ${deliveryPincode}. Checking next rule.`);
    }

    // 4. Fallback if no rule matched or all configured couriers were unserviceable
    //    Preserve existing behavior: pick cheapest serviceable carrier (or ST Courier for TN)
    const fallbackRate = availableRates[0];
    const defaultBadge = isLocalTn
      ? '⚡ Auto-Allocated (ST Courier TN Network)'
      : '⚡ Auto-Allocated (Default Network Routing)';

    return {
      allocatedRate: fallbackRate,
      matchedRule: null,
      priorityRank: null,
      allocationBadge: defaultBadge,
      routingReason: isLocalTn
        ? 'Intra-Tamil Nadu shipment allocated to ST Courier network'
        : 'Allocated to optimal carrier by platform standard routing (No custom priority rule matched)',
      evaluatedRulesCount: candidateRules.length,
    };
  }

  /**
   * Returns list of supported carrier options for rule configuration UI in Admin Panel.
   * Merges Shipway carrier catalog + ST Courier.
   */
  getAvailableCarrierCatalog() {
    return [
      // Tamil Nadu Local Network
      {
        courier_key: 'stcourier',
        name: 'ST Courier Tamil Nadu Express',
        weight_slab: 'District Slabs & Bulk',
        category: 'Intra-Tamil Nadu Local Network',
        mode: 'Surface',
        provider_key: 'stcourier',
      },

      // Delhivery Weight-Wise Services
      {
        courier_key: '80622',
        name: 'Delhivery Surface 500g',
        weight_slab: '500g Base Slab',
        category: 'Pan-India Surface (0.5 kg)',
        mode: 'Surface',
        provider_key: 'shipway',
      },
      {
        courier_key: '80734',
        name: 'Delhivery Surface 1kg',
        weight_slab: '1kg Heavy Slab',
        category: 'Pan-India Surface (1 kg)',
        mode: 'Surface',
        provider_key: 'shipway',
      },
      {
        courier_key: '80977',
        name: 'Delhivery Surface 2kg',
        weight_slab: '2kg Heavy Slab',
        category: 'Pan-India Surface (2 kg)',
        mode: 'Surface',
        provider_key: 'shipway',
      },
      {
        courier_key: '7613',
        name: 'Delhivery Surface 5kg',
        weight_slab: '5kg Bulk Slab',
        category: 'Pan-India Heavy Surface (5 kg)',
        mode: 'Surface',
        provider_key: 'shipway',
      },
      {
        courier_key: '7666',
        name: 'Delhivery Surface 10kg',
        weight_slab: '10kg Bulk Slab',
        category: 'Pan-India Heavy Surface (10 kg)',
        mode: 'Surface',
        provider_key: 'shipway',
      },
      {
        courier_key: '7442',
        name: 'Delhivery Air Express',
        weight_slab: 'Air Express Priority',
        category: 'Pan-India Air Network',
        mode: 'Air',
        provider_key: 'shipway',
      },

      // Blue Dart Services
      {
        courier_key: '7377',
        name: 'Blue Dart Express Air',
        weight_slab: 'Express Air (500g)',
        category: 'Pan-India Express Air Network',
        mode: 'Air',
        provider_key: 'shipway',
      },
      {
        courier_key: '81769',
        name: 'Blue Dart Surface',
        weight_slab: 'Premium Surface (500g)',
        category: 'Pan-India Premium Surface',
        mode: 'Surface',
        provider_key: 'shipway',
      },

      // Shadowfax Weight-Wise Services
      {
        courier_key: '79681',
        name: 'Shadowfax Surface 500g',
        weight_slab: '500g Base Slab',
        category: 'Pan-India E-commerce Surface (0.5 kg)',
        mode: 'Surface',
        provider_key: 'shipway',
      },
      {
        courier_key: '79930',
        name: 'Shadowfax Surface 1kg',
        weight_slab: '1kg Slab',
        category: 'Pan-India E-commerce Surface (1 kg)',
        mode: 'Surface',
        provider_key: 'shipway',
      },

      // Ekart Weight-Wise Services
      {
        courier_key: '71468',
        name: 'Ekart Surface 500g',
        weight_slab: '500g Base Slab',
        category: 'Pan-India Ground Logistics (0.5 kg)',
        mode: 'Surface',
        provider_key: 'shipway',
      },
      {
        courier_key: '80275',
        name: 'Ekart Surface 1kg',
        weight_slab: '1kg Heavy Slab',
        category: 'Pan-India Ground Logistics (1 kg)',
        mode: 'Surface',
        provider_key: 'shipway',
      },
      {
        courier_key: '80063',
        name: 'Ekart Surface 5kg',
        weight_slab: '5kg Bulk Slab',
        category: 'Pan-India Heavy Logistics (5 kg)',
        mode: 'Surface',
        provider_key: 'shipway',
      },
      {
        courier_key: '80064',
        name: 'Ekart Surface 10kg',
        weight_slab: '10kg Bulk Slab',
        category: 'Pan-India Heavy Logistics (10 kg)',
        mode: 'Surface',
        provider_key: 'shipway',
      },
      {
        courier_key: '81514',
        name: 'Ekart Express Air',
        weight_slab: 'Express Air Priority',
        category: 'Pan-India Express Air Network',
        mode: 'Air',
        provider_key: 'shipway',
      },
      {
        courier_key: '82861',
        name: 'Ekart Logistics Ground',
        weight_slab: 'Standard Ground',
        category: 'Pan-India Standard Ground Logistics',
        mode: 'Surface',
        provider_key: 'shipway',
      },

      // XpressBees Services
      {
        courier_key: '80593',
        name: 'XpressBees Surface 500g',
        weight_slab: '500g Base Slab',
        category: 'Pan-India Standard Surface',
        mode: 'Surface',
        provider_key: 'shipway',
      },
      {
        courier_key: '80652',
        name: 'XpressBees Air Priority',
        weight_slab: 'Air Priority',
        category: 'Express Air Priority',
        mode: 'Air',
        provider_key: 'shipway',
      },

      // DTDC Express & Amazon Shipping
      {
        courier_key: '80800',
        name: 'DTDC Express 500g',
        weight_slab: '500g Base Slab',
        category: 'Economy Express Surface',
        mode: 'Surface',
        provider_key: 'shipway',
      },
      {
        courier_key: '19339',
        name: 'Amazon Shipping Standard',
        weight_slab: 'Standard Ground',
        category: 'Amazon Transportation Services',
        mode: 'Surface',
        provider_key: 'shipway',
      },
      {
        courier_key: 'smartr',
        name: 'Smartr Logistics Air',
        weight_slab: 'Air Express',
        category: 'Premium Express Air',
        mode: 'Air',
        provider_key: 'shipway',
      },
    ];
  }
}

module.exports = new ShippingRuleEvaluatorService();
