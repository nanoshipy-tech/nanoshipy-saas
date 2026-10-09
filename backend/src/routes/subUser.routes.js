'use strict';

const express = require('express');
const router = express.Router();
const subUserController = require('../controllers/subUser.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// Public invite acceptance (no auth required)
router.post('/accept-invite', subUserController.acceptInvite);

// Seller authenticated routes
router.post('/', authenticate, subUserController.inviteSubUser);
router.get('/', authenticate, subUserController.listSubUsers);
router.get('/:id', authenticate, subUserController.getSubUser);
router.put('/:id/permissions', authenticate, subUserController.updatePermissions);
router.delete('/:id', authenticate, subUserController.revokeSubUser);

module.exports = router;
