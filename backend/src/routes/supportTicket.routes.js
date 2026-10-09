'use strict';

const express = require('express');
const supportTicketController = require('../controllers/supportTicket.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const can = require('../middlewares/can.middleware');
const validate = require('../middlewares/validate.middleware');
const { createTicketSchema, replyTicketSchema } = require('../validators/supportTicket.validator');
const multer = require('multer');
const path = require('path');
const os = require('os');

const ALLOWED_TICKET_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/plain',
];

const fs = require('fs');
const uploadTicketsDir = path.join(__dirname, '../../uploads/tickets');
if (!fs.existsSync(uploadTicketsDir)) {
  fs.mkdirSync(uploadTicketsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadTicketsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `ticket_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max per file (Fix #33)
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TICKET_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Disallowed file type. Allowed formats: JPG, PNG, WEBP, PDF, CSV, Excel, TXT'));
    }
  },
});

const router = express.Router();

router.use(authenticate);

router.post('/tickets/upload', upload.single('file'), supportTicketController.uploadAttachment);
router.get('/tickets', supportTicketController.listTickets);
router.get('/tickets/:id', supportTicketController.getTicketDetail);
router.post('/tickets', validate(createTicketSchema), supportTicketController.createTicket);
router.post('/tickets/:id/reply', validate(replyTicketSchema), supportTicketController.replyToTicket);
router.put('/tickets/:id/close', supportTicketController.closeTicket);

module.exports = router;
