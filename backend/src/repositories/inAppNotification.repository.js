'use strict';

const { InAppNotification } = require('../models');

async function listByUser(userId, isRead = null, limit = 20, offset = 0) {
  const where = { user_id: userId };
  if (isRead !== null) {
    where.is_read = isRead;
  }

  return InAppNotification.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });
}

async function markAsRead(id, userId) {
  const notif = await InAppNotification.findOne({ where: { id, user_id: userId } });
  if (notif) {
    await notif.update({ is_read: true });
  }
  return notif;
}

async function markAllAsRead(userId) {
  return InAppNotification.update(
    { is_read: true },
    { where: { user_id: userId, is_read: false } }
  );
}

module.exports = {
  listByUser,
  markAsRead,
  markAllAsRead,
};
