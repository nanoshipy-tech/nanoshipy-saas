'use strict';

const { 
  sequelize, 
  SupportTicket, 
  TicketMessage, 
  TicketAttachment, 
  Order, 
  Shipment,
  User,
  PlatformAdmin
} = require('../models');
const { 
  NotFoundError, 
  TicketNotFoundError,
  TicketClosedError, 
  TicketNotResolvedError, 
  CrossTenantReferenceError,
  ForbiddenError
} = require('../utils/errors');
const sequentialNumberUtil = require('../utils/sequentialNumber.util');
const ticketSlaService = require('./ticketSla.service');
const supportTicketRepository = require('../repositories/supportTicket.repository');
const eventBus = require('../events/eventBus');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

/**
 * Creates a support ticket from the tenant side.
 * Linked Shipment ID is mandatory. Supports lookup by internal UUID or AWB number.
 */
async function createTicket(tenantId, userId, payload) {
  const { 
    subject, 
    category, 
    priority = 'medium', 
    message, 
    related_shipment_id, 
    related_order_id: callerOrderId, 
    attachments = [] 
  } = payload;

  // 1. Shipment lookup — resolve by UUID or AWB number (optional for general/billing inquiries)
  let resolvedShipmentId = null;
  let resolvedOrderId = callerOrderId || null;
  let resolvedAwbNumber = null;

  if (related_shipment_id && related_shipment_id.trim()) {
    const shipmentRef = related_shipment_id.trim();
    const shipment = await Shipment.findOne({
      where: {
        [Op.or]: [
          { id: shipmentRef },
          { awb_number: shipmentRef },
        ],
        tenant_id: tenantId,
      },
    });

    if (shipment) {
      resolvedShipmentId = shipment.id;
      resolvedAwbNumber = shipment.awb_number || null;
      if (!resolvedOrderId) {
        resolvedOrderId = shipment.order_id || null;
      }
    } else if (category === 'shipment_issue') {
      throw new NotFoundError('Referenced shipment was not found for your account. Please check the Shipment ID or AWB number.');
    }
  }

  // 2. Validate cross-tenant order reference if caller provided one explicitly
  if (callerOrderId) {
    const order = await Order.findByPk(callerOrderId);
    if (!order || order.tenant_id !== tenantId) {
      throw new CrossTenantReferenceError('The referenced order does not belong to this tenant.');
    }
  }

  // 4. Transaction for locked sequence allocation
  return sequelize.transaction(async (transaction) => {
    const ticketNumber = await sequentialNumberUtil.generateNextSequence(
      'support_ticket', 
      'TKT', 
      6, 
      transaction
    );

    const slaDueAt = ticketSlaService.calculateSlaDueDate(priority);

    const ticket = await SupportTicket.create({
      tenant_id: tenantId,
      ticket_number: ticketNumber,
      subject,
      category,
      priority,
      status: 'open',
      related_shipment_id: resolvedShipmentId,
      related_order_id: resolvedOrderId,
      created_by: userId,
      sla_due_at: slaDueAt,
    }, { transaction });

    const ticketMessage = await TicketMessage.create({
      ticket_id: ticket.id,
      sender_type: 'tenant_user',
      sender_id: userId,
      message,
      is_internal_note: false,
    }, { transaction });

    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        await TicketAttachment.create({
          ticket_id: ticket.id,
          ticket_message_id: ticketMessage.id,
          file_name: att.file_name,
          file_url: att.file_url,
          file_size_bytes: att.file_size_bytes,
          uploaded_by: userId,
        }, { transaction });
      }
    }

    eventBus.emit('ticket.created', {
      tenant_id: tenantId,
      user_id: userId,
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_number,
      subject: ticket.subject,
      category: ticket.category,
      priority: ticket.priority,
      related_shipment_id: resolvedShipmentId,
      awb_number: resolvedAwbNumber,
      link_url: `/support/${ticket.id}`,
    });

    return ticket;
  });
}

/**
 * Replies to a ticket, updating statuses and SLA responses.
 */
async function replyToTicket(ticketId, senderType, senderId, payload) {
  const { message, isInternalNote = false, attachments = [], tenantId = null } = payload;

  const ticket = await SupportTicket.findByPk(ticketId);
  if (!ticket) {
    throw new TicketNotFoundError('Support ticket not found.');
  }

  // Tenant access verification
  if (tenantId && ticket.tenant_id !== tenantId) {
    throw new TicketNotFoundError('Support ticket not found.');
  }

  // Tenant reply cannot be internal note
  const actualInternalNote = tenantId ? false : isInternalNote;

  if (ticket.status === 'closed') {
    throw new TicketClosedError('Cannot reply to a closed support ticket.');
  }

  return sequelize.transaction(async (transaction) => {
    // 1. Create message
    const msg = await TicketMessage.create({
      ticket_id: ticketId,
      sender_type: senderType,
      sender_id: senderId,
      message,
      is_internal_note: actualInternalNote,
    }, { transaction });

    // 2. Add attachments
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        await TicketAttachment.create({
          ticket_id: ticketId,
          ticket_message_id: msg.id,
          file_name: att.file_name,
          file_url: att.file_url,
          file_size_bytes: att.file_size_bytes,
          uploaded_by: senderId,
        }, { transaction });
      }
    }

    // 3. Update parent ticket state machine
    const updates = {};
    if (senderType === 'tenant_user') {
      // Reopen ticket to in_progress if it was resolved
      if (ticket.status === 'resolved') {
        updates.status = 'in_progress';
        updates.resolved_at = null; // reset resolution
      }
    } else if (senderType === 'platform_admin') {
      if (!actualInternalNote) {
        // Set first_response_at on the first official response from platform support
        if (!ticket.first_response_at) {
          updates.first_response_at = new Date();
        }
        // Change status to in_progress or waiting_on_tenant on response
        if (ticket.status === 'open') {
          updates.status = 'in_progress';
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      await ticket.update(updates, { transaction });
    }

    // Emits reply notifications (only if non-internal note)
    if (!actualInternalNote) {
      eventBus.emit('ticket.replied', {
        tenant_id: ticket.tenant_id,
        user_id: ticket.created_by,
        ticket_id: ticket.id,
        ticket_number: ticket.ticket_number,
        sender_type: senderType,
        message: message.substring(0, 100),
        link_url: `/support/${ticket.id}`,
      });
    }

    return msg;
  });
}

/**
 * Marks ticket status to resolved (admin action).
 */
async function resolveTicket(ticketId, adminId) {
  const ticket = await SupportTicket.findByPk(ticketId);
  if (!ticket) {
    throw new TicketNotFoundError('Support ticket not found.');
  }

  await ticket.update({
    status: 'resolved',
    resolved_at: new Date(),
  });

  eventBus.emit('ticket.resolved', {
    tenant_id: ticket.tenant_id,
    user_id: ticket.created_by,
    ticket_id: ticket.id,
    ticket_number: ticket.ticket_number,
    subject: ticket.subject,
    link_url: `/support/${ticket.id}`,
  });

  return ticket;
}

/**
 * Closes the resolved support ticket (tenant action).
 */
async function closeTicket(ticketId, tenantId) {
  const ticket = await SupportTicket.findByPk(ticketId);
  if (!ticket || ticket.tenant_id !== tenantId) {
    throw new TicketNotFoundError('Support ticket not found.');
  }

  if (ticket.status === 'closed') {
    throw new TicketClosedError('Ticket is already closed.');
  }

  if (ticket.status !== 'resolved') {
    throw new TicketNotResolvedError('Only resolved support tickets can be closed by tenants.');
  }

  await ticket.update({
    status: 'closed',
  });

  return ticket;
}

/**
 * Assigns a support ticket to platform agent.
 */
async function assignTicket(ticketId, adminId) {
  const ticket = await SupportTicket.findByPk(ticketId);
  if (!ticket) {
    throw new TicketNotFoundError('Support ticket not found.');
  }

  const admin = await PlatformAdmin.findByPk(adminId);
  if (!admin) {
    throw new NotFoundError('Platform support admin not found.');
  }

  const updates = { assigned_to: adminId };
  if (ticket.status === 'open') {
    updates.status = 'in_progress';
  }

  await ticket.update(updates);
  return ticket;
}

/**
 * Directly change status or priority parameters (admin override).
 */
async function updateStatusOrPriority(ticketId, data) {
  const ticket = await SupportTicket.findByPk(ticketId);
  if (!ticket) {
    throw new TicketNotFoundError('Support ticket not found.');
  }

  const updates = {};
  if (data.status) {
    updates.status = data.status;
    if (data.status === 'resolved') {
      updates.resolved_at = new Date();
    }
  }
  if (data.priority) {
    updates.priority = data.priority;
  }

  await ticket.update(updates);
  return ticket;
}

async function createFromNdrEscalation(ndrRecord) {
  const { tenant_id, awb_number, order_id } = ndrRecord;

  return sequelize.transaction(async (transaction) => {
    const sequentialNumberUtil = require('../utils/sequentialNumber.util');
    const ticketNumber = await sequentialNumberUtil.generateNextSequence(
      'support_ticket', 
      'TKT', 
      6, 
      transaction
    );

    const slaDueAt = ticketSlaService.calculateSlaDueDate('high');

    const ticket = await SupportTicket.create({
      tenant_id,
      ticket_number: ticketNumber,
      subject: `NDR Escalation - AWB: ${awb_number}`,
      category: 'ndr',
      priority: 'high',
      status: 'open',
      related_shipment_id: null,
      related_order_id: order_id || null,
      sla_due_at: slaDueAt,
    }, { transaction });

    await TicketMessage.create({
      ticket_id: ticket.id,
      sender_type: 'tenant_user',
      sender_id: '00000000-0000-0000-0000-000000000000', // Auto system placeholder
      message: `This ticket was automatically generated due to an unresolved NDR escalation for Waybill: ${awb_number}.`,
      is_internal_note: false,
    }, { transaction });

    return ticket;
  });
}

module.exports = {
  createTicket,
  replyToTicket,
  resolveTicket,
  closeTicket,
  assignTicket,
  updateStatusOrPriority,
  createFromNdrEscalation,
};
