'use strict';

const { NotificationTemplate } = require('../models');
const { NotFoundError } = require('../utils/errors');

async function listTemplates(filters = {}) {
  const where = {};
  if (filters.channel) where.channel = filters.channel;
  if (filters.event_key) where.event_key = filters.event_key;

  return NotificationTemplate.findAll({
    where,
    order: [['event_key', 'ASC'], ['channel', 'ASC']],
  });
}

async function updateTemplate(id, data) {
  const template = await NotificationTemplate.findByPk(id);
  if (!template) {
    throw new NotFoundError('Notification template not found');
  }

  // Restrict keys that can be updated
  const { subject, body_template, is_active, meta_template_name } = data;
  await template.update({
    subject,
    body_template,
    is_active,
    meta_template_name,
    version: template.version + 1,
  });

  return template;
}

module.exports = {
  listTemplates,
  updateTemplate,
};
