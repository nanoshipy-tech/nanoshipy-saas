'use strict';

const inAppNotificationRepository = require('../repositories/inAppNotification.repository');
const notificationTemplateService = require('../services/notificationTemplate.service');
const { success } = require('../utils/apiResponse');
const { NotFoundError } = require('../utils/errors');
const { InAppNotification } = require('../models');

/**
 * List paginated in-app notifications for authenticated user.
 */
async function listUserNotifications(req, res, next) {
  try {
    const userId = req.user.id;
    const { is_read, page = 1, limit = 20 } = req.query;

    const parsedLimit = parseInt(limit, 10);
    const parsedOffset = (parseInt(page, 10) - 1) * parsedLimit;
    const isReadBool = is_read !== undefined ? is_read === 'true' : null;

    const { count, rows } = await inAppNotificationRepository.listByUser(
      userId,
      isReadBool,
      parsedLimit,
      parsedOffset
    );

    return success(res, {
      notifications: rows,
      pagination: {
        total: count,
        page: parseInt(page, 10),
        limit: parsedLimit,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Mark a single in-app notification as read.
 */
async function markNotificationAsRead(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notif = await inAppNotificationRepository.markAsRead(id, userId);
    if (!notif) {
      throw new NotFoundError('In-app notification not found or access denied');
    }

    return success(res, { id, is_read: true });
  } catch (err) {
    next(err);
  }
}

/**
 * Mark all unread notifications as read.
 */
async function markAllNotificationsAsRead(req, res, next) {
  try {
    const userId = req.user.id;
    await inAppNotificationRepository.markAllAsRead(userId);
    return success(res, { message: 'All in-app alerts marked as read' });
  } catch (err) {
    next(err);
  }
}

/**
 * Get unread badge count.
 */
async function getUnreadBadgeCount(req, res, next) {
  try {
    const userId = req.user.id;
    const unread_count = await InAppNotification.count({
      where: { user_id: userId, is_read: false },
    });

    return success(res, { unread_count });
  } catch (err) {
    next(err);
  }
}

/**
 * Platform Admin - List template catalogue.
 */
async function listTemplates(req, res, next) {
  try {
    const { channel, event_key } = req.query;
    const templates = await notificationTemplateService.listTemplates({ channel, event_key });
    return success(res, templates);
  } catch (err) {
    next(err);
  }
}

/**
 * Platform Admin - Edit template body placeholder rules.
 */
async function updateTemplate(req, res, next) {
  try {
    const { id } = req.params;
    const template = await notificationTemplateService.updateTemplate(id, req.body);
    return success(res, template);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadBadgeCount,
  listTemplates,
  updateTemplate,
};
