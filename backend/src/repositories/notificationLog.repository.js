'use strict';

const { NotificationLog } = require('../models');

async function logDelivery(logId, status, providerResponse = null, errorMessage = null) {
  const log = await NotificationLog.findByPk(logId);
  if (log) {
    await log.update({
      status,
      provider_response: providerResponse,
      error_message: errorMessage,
      sent_at: status === 'sent' || status === 'delivered' ? new Date() : null,
    });
  }
  return log;
}

module.exports = {
  logDelivery,
};
