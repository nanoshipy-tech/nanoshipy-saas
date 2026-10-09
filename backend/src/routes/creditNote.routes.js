'use strict';

const express = require('express');
const router = express.Router();
const creditNoteController = require('../controllers/creditNote.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const can = require('../middlewares/can.middleware');

router.get('/credit-notes', authenticate, can('billing.view'), creditNoteController.listCreditNotes);
router.get('/credit-notes/:id', authenticate, can('billing.view'), creditNoteController.getCreditNoteDetail);
router.get('/credit-notes/:id/pdf', authenticate, can('billing.view'), creditNoteController.getCreditNotePdfStream);

module.exports = router;
