'use strict';

const { success } = require('../utils/apiResponse');
const { WebhookLog, CourierProvider } = require('../models');
const { Op } = require('sequelize');

/**
 * GET /api/v1/platform/webhook-logs
 * Platform admin — list all webhook logs with filtering and pagination.
 */
const listWebhookLogs = async (req, res, next) => {
  try {
    const {
      courier_provider_id,
      processed,
      signature_valid,
      date_from,
      date_to,
      page = 1,
      limit = 30,
    } = req.query;

    const where = {};

    if (courier_provider_id) {
      where.courier_provider_id = courier_provider_id;
    }

    if (processed !== undefined) {
      where.processed = processed === 'true';
    }

    if (signature_valid !== undefined) {
      where.signature_valid = signature_valid === 'true';
    }

    if (date_from || date_to) {
      where.received_at = {};
      if (date_from) where.received_at[Op.gte] = new Date(date_from);
      if (date_to) where.received_at[Op.lte] = new Date(date_to);
    }

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const { count, rows } = await WebhookLog.findAndCountAll({
      where,
      include: [
        {
          model: CourierProvider,
          as: 'provider',
          attributes: ['id', 'provider_key', 'display_name'],
        },
      ],
      order: [['received_at', 'DESC']],
      limit: parseInt(limit, 10),
      offset,
    });

    return success(res, {
      rows,
      pagination: {
        total: count,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(count / parseInt(limit, 10)),
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { listWebhookLogs };
