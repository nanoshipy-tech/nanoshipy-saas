'use strict';

const { TicketMessage, TicketAttachment } = require('../models');

/**
 * Creates a ticket message.
 */
const createMessage = async (data, transaction) => {
  return TicketMessage.create(data, { transaction });
};

/**
 * Creates a ticket attachment.
 */
const createAttachment = async (data, transaction) => {
  return TicketAttachment.create(data, { transaction });
};

module.exports = {
  createMessage,
  createAttachment,
};
