'use strict';

const { 
  SupportTicket, 
  TicketMessage, 
  TicketAttachment, 
  User, 
  PlatformAdmin, 
  Order, 
  Shipment,
  sequelize
} = require('../models');
const { Op } = require('sequelize');

/**
 * Find a support ticket by ID, with optional tenant scoping and internal notes filtering.
 */
const findById = async (id, { tenantId = null, excludeInternalNotes = false } = {}) => {
  const where = { id };
  if (tenantId) where.tenant_id = tenantId;

  const messageWhere = {};
  if (excludeInternalNotes) {
    messageWhere.is_internal_note = false;
  }

  return SupportTicket.findOne({
    where,
    include: [
      {
        model: TicketMessage,
        as: 'messages',
        where: messageWhere,
        required: false,
        include: [
          {
            model: TicketAttachment,
            as: 'attachments',
          }
        ]
      },
      {
        model: TicketAttachment,
        as: 'attachments',
        where: { ticket_message_id: null },
        required: false,
      },
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'name', 'email'],
      },
      {
        model: PlatformAdmin,
        as: 'assignee',
        attributes: ['id', 'name', 'email'],
      },
      {
        model: Order,
        as: 'order',
        attributes: ['id', 'order_reference', 'tenant_id'],
      },
      {
        model: Shipment,
        as: 'shipment',
        attributes: ['id', 'awb_number', 'tenant_id'],
      }
    ],
    order: [
      [{ model: TicketMessage, as: 'messages' }, 'created_at', 'ASC']
    ]
  });
};

/**
 * List support tickets with search, filtering, and pagination.
 */
const findAll = async ({
  tenantId = null,
  status = null,
  category = null,
  priority = null,
  assignedTo = null,
  slaBreached = null,
  page = 1,
  limit = 20,
  sort = 'created_at',
  order = 'DESC'
}) => {
  const where = {};
  
  if (tenantId) where.tenant_id = tenantId;
  if (status) where.status = status;
  if (category) where.category = category;
  if (priority) where.priority = priority;
  if (assignedTo) where.assigned_to = assignedTo;

  if (slaBreached === 'true' || slaBreached === true) {
    where.status = { [Op.notIn]: ['resolved', 'closed'] };
    where.sla_due_at = { [Op.lt]: new Date() };
  }

  const offset = (page - 1) * limit;

  const { count, rows } = await SupportTicket.findAndCountAll({
    where,
    limit: parseInt(limit, 10),
    offset: parseInt(offset, 10),
    order: [[sort, order]],
    include: [
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'name', 'email'],
      },
      {
        model: PlatformAdmin,
        as: 'assignee',
        attributes: ['id', 'name', 'email'],
      },
      {
        model: Order,
        as: 'order',
        attributes: ['id', 'order_reference'],
      },
      {
        model: Shipment,
        as: 'shipment',
        attributes: ['id', 'awb_number'],
      }
    ]
  });

  return {
    total: count,
    pages: Math.ceil(count / limit),
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    tickets: rows
  };
};

module.exports = {
  findById,
  findAll,
};
