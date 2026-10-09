'use strict';

const express = require('express');
const platformTicketController = require('../controllers/platformTicket.controller');
const { isPlatformAdmin } = require('../middlewares/platformAuth.middleware');
const { canPlatform } = require('../middlewares/canPlatform.middleware');
const validate = require('../middlewares/validate.middleware');
const { 
  replyTicketSchema, 
  assignTicketSchema, 
  updateStatusSchema 
} = require('../validators/supportTicket.validator');
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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TICKET_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Disallowed file type. Allowed formats: JPG, PNG, WEBP, PDF, CSV, Excel, TXT'));
    }
  },
});

const router = express.Router();

router.use(isPlatformAdmin);

router.post('/tickets/upload', upload.single('file'), platformTicketController.uploadAttachment);
router.get('/tickets', canPlatform('ticket.view'), platformTicketController.listTickets);
router.get('/tickets/summary', canPlatform('ticket.view'), platformTicketController.getSummary);
router.get('/tickets/:id', canPlatform('ticket.view'), platformTicketController.getTicketDetail);

router.post('/tickets/:id/reply', canPlatform('ticket.manage'), validate(replyTicketSchema), platformTicketController.replyToTicket);
router.post('/tickets/:id/internal-note', canPlatform('ticket.manage'), validate(replyTicketSchema), platformTicketController.addInternalNote);
router.put('/tickets/:id/assign', canPlatform('ticket.manage'), validate(assignTicketSchema), platformTicketController.assignTicket);
router.put('/tickets/:id/status', canPlatform('ticket.manage'), validate(updateStatusSchema), platformTicketController.updateStatus);

module.exports = router;
