'use strict';

const { SupportTicket } = require('../models');
const { Op } = require('sequelize');
const eventBus = require('../events/eventBus');
const logger = require('../utils/logger');

/**
 * Calculates due date based on ticket priority and env thresholds.
 */
function calculateSlaDueDate(priority) {
  const now = new Date();
  let hours = 24; // fallback

  switch (priority) {
    case 'urgent':
      hours = parseInt(process.env.TICKET_SLA_URGENT_HOURS, 10) || 2;
      break;
    case 'high':
      hours = parseInt(process.env.TICKET_SLA_HIGH_HOURS, 10) || 8;
      break;
    case 'medium':
      hours = parseInt(process.env.TICKET_SLA_MEDIUM_HOURS, 10) || 24;
      break;
    case 'low':
      hours = parseInt(process.env.TICKET_SLA_LOW_HOURS, 10) || 72;
      break;
    default:
      hours = 24;
  }

  now.setHours(now.getHours() + hours);
  return now;
}

/**
 * Periodically searches for SLA breached tickets and fires alerts.
 */
async function checkSlaBreaches() {
  logger.info('[TicketSlaService] Executing ticket SLA breach audit...');
  
  try {
    const breachedTickets = await SupportTicket.findAll({
      where: {
        status: {
          [Op.notIn]: ['resolved', 'closed'],
        },
        sla_due_at: {
          [Op.lt]: new Date(),
        },
        sla_breached: false,
      },
    });

    logger.info(`[TicketSlaService] Found ${breachedTickets.length} new SLA-breached tickets.`);

    for (const ticket of breachedTickets) {
      await ticket.update({ sla_breached: true });

      eventBus.emit('ticket.sla_breach_warning', {
        tenant_id: ticket.tenant_id,
        ticket_id: ticket.id,
        ticket_number: ticket.ticket_number,
        priority: ticket.priority,
        sla_due_at: ticket.sla_due_at,
      });
    }

    return breachedTickets;
  } catch (err) {
    logger.error(`[TicketSlaService] SLA breach check failed: ${err.message}`, err);
    throw err;
  }
}

module.exports = {
  calculateSlaDueDate,
  checkSlaBreaches,
};
