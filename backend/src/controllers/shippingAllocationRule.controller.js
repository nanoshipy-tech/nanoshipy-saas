'use strict';

const { ShippingAllocationRule, Tenant, PickupAddress } = require('../models');
const shippingRuleEvaluator = require('../services/shippingRuleEvaluator.service');
const { BadRequestError, NotFoundError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Controller for Managing Multi-Courier Shipping Allocation Rules
 */
class ShippingAllocationRuleController {
  /**
   * List all rules with filter options.
   */
  async listRules(req, res, next) {
    try {
      const { scope, tenant_id, pickup_address_id, is_active } = req.query;

      const where = {};
      if (scope) where.scope = scope;
      if (tenant_id) where.tenant_id = tenant_id;
      if (pickup_address_id) where.pickup_address_id = pickup_address_id;
      if (is_active !== undefined) where.is_active = is_active === 'true' || is_active === true;

      const rules = await ShippingAllocationRule.findAll({
        where,
        order: [['priority', 'ASC'], ['created_at', 'ASC']],
        include: [
          {
            model: Tenant,
            as: 'tenant',
            attributes: ['id', 'company_name', 'subdomain'],
            required: false,
          },
          {
            model: PickupAddress,
            as: 'pickupAddress',
            attributes: ['id', 'label', 'city', 'district', 'pincode', 'state'],
            required: false,
          },
        ],
      });

      return res.status(200).json({
        success: true,
        data: {
          rules,
          total: rules.length,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get single rule by ID.
   */
  async getRuleById(req, res, next) {
    try {
      const { id } = req.params;
      const rule = await ShippingAllocationRule.findByPk(id, {
        include: [
          {
            model: Tenant,
            as: 'tenant',
            attributes: ['id', 'company_name', 'subdomain'],
            required: false,
          },
          {
            model: PickupAddress,
            as: 'pickupAddress',
            attributes: ['id', 'label', 'city', 'district', 'pincode', 'state'],
            required: false,
          },
        ],
      });

      if (!rule) {
        throw new NotFoundError('Shipping allocation rule not found');
      }

      return res.status(200).json({
        success: true,
        data: rule,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Returns list of supported couriers (Shipway + ST Courier) for selection in rule builders.
   */
  async getAvailableCouriers(req, res, next) {
    try {
      const catalog = shippingRuleEvaluator.getAvailableCarrierCatalog();
      return res.status(200).json({
        success: true,
        data: catalog,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Create a new rule with up to 5 prioritized couriers.
   */
  async createRule(req, res, next) {
    try {
      const {
        name,
        priority = 1,
        is_active = true,
        scope = 'global',
        tenant_id,
        pickup_address_id,
        payment_mode = 'all',
        zone = 'all',
        min_weight_kg = 0.00,
        max_weight_kg = 999.00,
        min_order_value = 0.00,
        max_order_value = 999999.00,
        strategy = 'priority_fallback',
        courier_priorities = [],
      } = req.body;

      if (!name || String(name).trim() === '') {
        throw new BadRequestError('Rule name is required.');
      }

      if (!Array.isArray(courier_priorities) || courier_priorities.length === 0) {
        throw new BadRequestError('At least 1 courier must be allocated for this rule (up to 5 couriers max).');
      }

      if (courier_priorities.length > 5) {
        throw new BadRequestError('A maximum of 5 couriers can be configured per rule.');
      }

      // Format priorities cleanly
      const formattedPriorities = courier_priorities.map((item, idx) => ({
        priority: idx + 1,
        courier_key: String(item.courier_key || item.service_type || item.id || '').trim(),
        name: String(item.name || item.courier_name || 'Carrier Partner').trim(),
        service_type: String(item.courier_key || item.service_type || '').trim(),
      }));

      // Validate scope targets
      if (scope === 'seller' && !tenant_id) {
        throw new BadRequestError('Seller ID (tenant_id) is required when rule scope is "seller".');
      }
      if (scope === 'booking_office' && !pickup_address_id) {
        throw new BadRequestError('Pickup Address / Booking Office ID is required when rule scope is "booking_office".');
      }

      const rule = await ShippingAllocationRule.create({
        name: name.trim(),
        priority: parseInt(priority, 10) || 1,
        is_active: Boolean(is_active),
        scope,
        tenant_id: scope === 'seller' ? tenant_id : null,
        pickup_address_id: scope === 'booking_office' ? pickup_address_id : null,
        payment_mode,
        zone,
        min_weight_kg: parseFloat(min_weight_kg) || 0.00,
        max_weight_kg: parseFloat(max_weight_kg) || 999.00,
        min_order_value: parseFloat(min_order_value) || 0.00,
        max_order_value: parseFloat(max_order_value) || 999999.00,
        strategy,
        courier_priorities: formattedPriorities,
        created_by: req.user?.id || null,
      });

      return res.status(201).json({
        success: true,
        message: `Shipping rule "${rule.name}" created successfully with ${formattedPriorities.length} prioritized couriers.`,
        data: rule,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update an existing rule.
   */
  async updateRule(req, res, next) {
    try {
      const { id } = req.params;
      const rule = await ShippingAllocationRule.findByPk(id);

      if (!rule) {
        throw new NotFoundError('Shipping allocation rule not found');
      }

      const {
        name,
        priority,
        is_active,
        scope,
        tenant_id,
        pickup_address_id,
        payment_mode,
        zone,
        min_weight_kg,
        max_weight_kg,
        min_order_value,
        max_order_value,
        strategy,
        courier_priorities,
      } = req.body;

      if (name !== undefined) rule.name = name.trim();
      if (priority !== undefined) rule.priority = parseInt(priority, 10) || 1;
      if (is_active !== undefined) rule.is_active = Boolean(is_active);
      if (scope !== undefined) rule.scope = scope;
      if (tenant_id !== undefined) rule.tenant_id = scope === 'seller' ? tenant_id : null;
      if (pickup_address_id !== undefined) rule.pickup_address_id = scope === 'booking_office' ? pickup_address_id : null;
      if (payment_mode !== undefined) rule.payment_mode = payment_mode;
      if (zone !== undefined) rule.zone = zone;
      if (min_weight_kg !== undefined) rule.min_weight_kg = parseFloat(min_weight_kg) || 0.00;
      if (max_weight_kg !== undefined) rule.max_weight_kg = parseFloat(max_weight_kg) || 999.00;
      if (min_order_value !== undefined) rule.min_order_value = parseFloat(min_order_value) || 0.00;
      if (max_order_value !== undefined) rule.max_order_value = parseFloat(max_order_value) || 999999.00;
      if (strategy !== undefined) rule.strategy = strategy;

      if (Array.isArray(courier_priorities)) {
        if (courier_priorities.length === 0) {
          throw new BadRequestError('At least 1 courier must be allocated for this rule.');
        }
        if (courier_priorities.length > 5) {
          throw new BadRequestError('A maximum of 5 couriers can be configured per rule.');
        }
        rule.courier_priorities = courier_priorities.map((item, idx) => ({
          priority: idx + 1,
          courier_key: String(item.courier_key || item.service_type || item.id || '').trim(),
          name: String(item.name || item.courier_name || 'Carrier Partner').trim(),
          service_type: String(item.courier_key || item.service_type || '').trim(),
        }));
      }

      await rule.save();

      return res.status(200).json({
        success: true,
        message: `Shipping rule "${rule.name}" updated successfully.`,
        data: rule,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Delete a rule.
   */
  async deleteRule(req, res, next) {
    try {
      const { id } = req.params;
      const rule = await ShippingAllocationRule.findByPk(id);

      if (!rule) {
        throw new NotFoundError('Shipping allocation rule not found');
      }

      const ruleName = rule.name;
      await rule.destroy();

      return res.status(200).json({
        success: true,
        message: `Shipping rule "${ruleName}" deleted successfully.`,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Toggle rule active status.
   */
  async toggleRuleStatus(req, res, next) {
    try {
      const { id } = req.params;
      const rule = await ShippingAllocationRule.findByPk(id);

      if (!rule) {
        throw new NotFoundError('Shipping allocation rule not found');
      }

      rule.is_active = !rule.is_active;
      await rule.save();

      return res.status(200).json({
        success: true,
        message: `Shipping rule is now ${rule.is_active ? 'ENABLED' : 'DISABLED'}.`,
        data: {
          id: rule.id,
          is_active: rule.is_active,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Reorder priority of multiple rules.
   */
  async reorderRules(req, res, next) {
    try {
      const { rule_ids } = req.body;

      if (!Array.isArray(rule_ids) || rule_ids.length === 0) {
        throw new BadRequestError('rule_ids must be a non-empty array of rule IDs in priority sequence.');
      }

      await Promise.all(
        rule_ids.map((id, index) =>
          ShippingAllocationRule.update(
            { priority: index + 1 },
            { where: { id } }
          )
        )
      );

      return res.status(200).json({
        success: true,
        message: 'Shipping rules priority reordered successfully.',
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ShippingAllocationRuleController();
