const express = require('express');
const razorpayWebhookController = require('../controllers/razorpayWebhook.controller');

const router = express.Router();

// Raw body needed for HMAC verification — do NOT use express.json() before this
router.post('/', express.raw({ type: 'application/json' }), (req, res, next) => {
  req.rawBody = req.body; // Buffer from express.raw()
  next();
}, razorpayWebhookController.handleWebhook);

module.exports = router;
