'use strict';

const supportTicketService = require('../services/supportTicket.service');
const supportTicketRepository = require('../repositories/supportTicket.repository');
const { success, error } = require('../utils/apiResponse');
const { TicketNotFoundError } = require('../utils/errors');
const { SupportTicket, sequelize } = require('../models');
const { Op } = require('sequelize');

const listTickets = async (req, res, next) => {
  try {
    const { tenant_id, status, priority, assigned_to, sla_breached, page, limit } = req.query;
    const data = await supportTicketRepository.findAll({
      tenantId: tenant_id,
      status,
      priority,
      assignedTo: assigned_to,
      slaBreached: sla_breached,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 50,
    });
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

const getTicketDetail = async (req, res, next) => {
  try {
    const ticket = await supportTicketRepository.findById(req.params.id, {
      excludeInternalNotes: false, // admins CAN view internal notes
    });

    if (!ticket) {
      throw new TicketNotFoundError('Support ticket not found.');
    }

    return success(res, ticket);
  } catch (err) {
    next(err);
  }
};

const replyToTicket = async (req, res, next) => {
  try {
    const msg = await supportTicketService.replyToTicket(
      req.params.id,
      'platform_admin',
      req.platformAdmin.id,
      {
        message: req.body.message,
        isInternalNote: false,
        attachments: req.body.attachments,
      }
    );

    // Audit log
    const platformAudit = require('../services/platformAudit.service');
    await platformAudit.log({
      platform_admin_id: req.platformAdmin.id,
      action: 'ticket_replied',
      entity_type: 'support_ticket',
      entity_id: req.params.id,
      metadata: { ticket_id: req.params.id, message_id: msg.id },
      ip_address: req.ip,
    });

    return success(res, msg, 201);
  } catch (err) {
    next(err);
  }
};

const addInternalNote = async (req, res, next) => {
  try {
    const msg = await supportTicketService.replyToTicket(
      req.params.id,
      'platform_admin',
      req.platformAdmin.id,
      {
        message: req.body.message,
        isInternalNote: true,
        attachments: req.body.attachments,
      }
    );

    // Audit log
    const platformAudit = require('../services/platformAudit.service');
    await platformAudit.log({
      platform_admin_id: req.platformAdmin.id,
      action: 'ticket_internal_note_added',
      entity_type: 'support_ticket',
      entity_id: req.params.id,
      metadata: { ticket_id: req.params.id, message_id: msg.id },
      ip_address: req.ip,
    });

    return success(res, msg, 201);
  } catch (err) {
    next(err);
  }
};

const assignTicket = async (req, res, next) => {
  try {
    const { assigned_to } = req.body;
    const ticket = await supportTicketService.assignTicket(req.params.id, assigned_to);

    // Audit log
    const platformAudit = require('../services/platformAudit.service');
    await platformAudit.log(
      req.platformAdmin.id,
      'ticket_assigned',
      { ticket_id: ticket.id, assigned_to },
      req
    );

    return success(res, ticket);
  } catch (err) {
    next(err);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const ticket = await supportTicketService.updateStatusOrPriority(req.params.id, req.body);

    // Audit log
    const platformAudit = require('../services/platformAudit.service');
    await platformAudit.log(
      req.platformAdmin.id,
      'ticket_status_changed',
      { ticket_id: ticket.id, status: req.body.status, priority: req.body.priority },
      req
    );

    return success(res, ticket);
  } catch (err) {
    next(err);
  }
};

const getSummary = async (req, res, next) => {
  try {
    const openCount = await SupportTicket.count({ where: { status: 'open' } });
    const inProgressCount = await SupportTicket.count({ where: { status: 'in_progress' } });
    const slaBreachedCount = await SupportTicket.count({
      where: {
        status: { [Op.notIn]: ['resolved', 'closed'] },
        sla_due_at: { [Op.lt]: new Date() }
      }
    });

    const avgExpr = process.env.USE_SQLITE === 'true' 
      ? sequelize.literal("0")
      : sequelize.fn('AVG', sequelize.literal("EXTRACT(EPOCH FROM (first_response_at - created_at))"));

    const avgResponseResult = await SupportTicket.findOne({
      attributes: [[avgExpr, 'avg_seconds']],
      where: {
        first_response_at: { [Op.ne]: null }
      },
      raw: true
    });

    const avgSeconds = parseFloat(avgResponseResult?.avg_seconds) || 0;
    const avg_first_response_hours = parseFloat((avgSeconds / 3600).toFixed(2));

    return success(res, {
      open: openCount,
      in_progress: inProgressCount,
      sla_breached: slaBreachedCount,
      avg_first_response_hours
    });
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
  replyToTicket,
  addInternalNote,
  assignTicket,
  updateStatus,
  getSummary,
  uploadAttachment,
};
