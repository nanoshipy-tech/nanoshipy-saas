'use strict';

const supportTicketService = require('../services/supportTicket.service');
const supportTicketRepository = require('../repositories/supportTicket.repository');
const { success, error } = require('../utils/apiResponse');
const { TicketNotFoundError } = require('../utils/errors');

const listTickets = async (req, res, next) => {
  try {
    const { status, category, priority, page, limit } = req.query;
    const data = await supportTicketRepository.findAll({
      tenantId: req.user.tenant_id,
      status,
      category,
      priority,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 20,
    });
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const getTicketDetail = async (req, res, next) => {
  try {
    const ticket = await supportTicketRepository.findById(req.params.id, {
      tenantId: req.user.tenant_id,
      excludeInternalNotes: true, // critical security control
    });

    if (!ticket) {
      throw new TicketNotFoundError('Support ticket not found.');
    }

    return success(res, ticket);
  } catch (err) {
    next(err);
  }
};

const createTicket = async (req, res, next) => {
  try {
    const ticket = await supportTicketService.createTicket(
      req.user.tenant_id,
      req.user.id,
      req.body
    );

    // Audit log
    const auditService = require('../services/audit.service');
    await auditService.log({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: 'ticket_created',
      entity_type: 'support_ticket',
      entity_id: ticket.id,
      metadata: { ticket_id: ticket.id, ticket_number: ticket.ticket_number, related_shipment_id: ticket.related_shipment_id },
      req,
    });

    return success(res, {
      id: ticket.id,
      ticket_number: ticket.ticket_number,
      status: ticket.status
    }, 201);
  } catch (err) {
    next(err);
  }
};

const replyToTicket = async (req, res, next) => {
  try {
    const msg = await supportTicketService.replyToTicket(
      req.params.id,
      'tenant_user',
      req.user.id,
      {
        message: req.body.message,
        attachments: req.body.attachments,
        tenantId: req.user.tenant_id // enforces tenant scoping
      }
    );

    // Audit log
    const auditService = require('../services/audit.service');
    await auditService.log({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: 'ticket_replied',
      entity_type: 'support_ticket',
      entity_id: req.params.id,
      metadata: { ticket_id: req.params.id, message_id: msg.id },
      req,
    });

    return success(res, msg, 201);
  } catch (err) {
    next(err);
  }
};

const closeTicket = async (req, res, next) => {
  try {
    const ticket = await supportTicketService.closeTicket(req.params.id, req.user.tenant_id);

    // Audit log
    const auditService = require('../services/audit.service');
    await auditService.log({
      tenant_id: req.user.tenant_id,
      user_id: req.user.id,
      action: 'ticket_status_changed',
      entity_type: 'support_ticket',
      entity_id: ticket.id,
      metadata: { ticket_id: ticket.id, status: 'closed' },
      req,
    });

    return success(res, ticket);
  } catch (err) {
    next(err);
  }
};

const uploadAttachment = async (req, res, next) => {
  try {
    if (!req.file) {
      return error(res, { code: 'INVALID_INPUT', message: 'No file uploaded' }, 400);
    }
    
    // For local dev, we simulate upload and return the local path or a mock URL.
    // In production, this would go to S3.
    const fileUrl = `/uploads/tickets/${req.file.filename}`;
    
    return success(res, {
      file_name: req.file.originalname,
      file_url: fileUrl,
      file_size_bytes: req.file.size
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listTickets,
  getTicketDetail,
  createTicket,
  replyToTicket,
  closeTicket,
  uploadAttachment,
};
