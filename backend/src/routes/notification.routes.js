'use strict';

const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');

router.get('/notifications', authenticate, notificationController.listUserNotifications);
router.get('/notifications/unread-count', authenticate, notificationController.getUnreadBadgeCount);
router.put('/notifications/mark-all-read', authenticate, notificationController.markAllNotificationsAsRead);
router.put('/notifications/:id/read', authenticate, notificationController.markNotificationAsRead);

// Platform oversight templates mapping config endpoints
router.get('/platform/notification-templates', isPlatformAdmin, notificationController.listTemplates);
router.put('/platform/notification-templates/:id', isPlatformAdmin, notificationController.updateTemplate);

module.exports = router;
