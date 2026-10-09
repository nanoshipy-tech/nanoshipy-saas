const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const config = require('./config/env');
const routes = require('./routes/index.routes');
const errorHandler = require('./middlewares/errorHandler.middleware');
const requestLogger = require('./middlewares/requestLogger.middleware');
const { tenantScopeMiddleware } = require('./middlewares/tenantScope.middleware');
const { globalLimiter } = require('./middlewares/rateLimiter.middleware');

const app = express();

// Trust proxy for Nginx reverse proxy
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

const allowedOrigins = [
  config.frontendUrl,
  config.platformAdminFrontendUrl,
  'https://app.nanoshipy.com',
  'https://admin.nanoshipy.com',
  'https://nanoshipy.com',
  'https://www.nanoshipy.com',
  ...(process.env.NODE_ENV !== 'production'
    ? [
        'http://app.nanoshipy.com',
        'http://admin.nanoshipy.com',
        'http://nanoshipy.com',
        'http://www.nanoshipy.com',
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:3002',
      ]
    : []),
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
}));

// Inbound webhook receivers (mounted before global body parsers to preserve raw binary stream for HMAC verification)
app.use('/api/webhooks/razorpay', require('./routes/razorpayWebhook.routes'));
app.use('/api/webhooks', require('./routes/storefrontWebhookReceiver.routes'));
app.use('/api/integrations/shopify/webhooks/orders', express.raw({ type: '*/*' }), (req, res, next) => {
  const shopifyIntegrationController = require('./controllers/shopifyIntegration.controller');
  return shopifyIntegrationController.handleOrdersWebhook(req, res, next);
});

// Body parsing with rawBody retention for downstream HMAC verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Compression
app.use(compression());

// Request tracking & logging
app.use(requestLogger);

// Global rate limiting
app.use(globalLimiter);

// Tenant Scope Initialization
app.use(tenantScopeMiddleware);

// API Routes
app.use('/api/v1', routes);
app.use('/orders', (req, res, next) => {
  req.url = '/orders' + req.url;
  routes(req, res, next);
});
app.use('/api/integrations/shopify', require('./routes/shopifyIntegration.routes'));
app.use('/api/admin/dashboard', require('./routes/adminDashboard.routes'));
app.use('/api/admin/reports', require('./routes/adminReports.routes'));
app.use('/api/v1/platform/my-dreams-sms', require('./routes/myDreamsSms.routes'));

// Health checks
app.get(['/health', '/api/health', '/api/v1/health'], (req, res) => {
  res.status(200).json({ success: true, status: 'ok', uptime: process.uptime(), timestamp: new Date() });
});

// Static uploads serving
const path = require('path');
const uploadsRoot = path.join(__dirname, '..', config.storage.uploadDir);

// 1. Protected documents (KYC, PAN, Aadhaar, Cheques) - requires valid merchant or admin session token
app.use(`/${config.storage.uploadDir}/company/documents`, (req, res, next) => {
  // Allow CSV error reports to be downloaded directly
  if (req.path.endsWith('.csv') || req.path.includes('import-errors')) {
    return express.static(path.join(uploadsRoot, 'company', 'documents'))(req, res, next);
  }
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.query.token || req.cookies?.accessToken;
  if (!token) {
    return res.status(401).json({ success: false, data: null, error: { code: 'UNAUTHORIZED', message: 'Authentication required to access documents' } });
  }
  try {
    const { verifyAccessToken } = require('./services/token.service');
    verifyAccessToken(token);
    return express.static(path.join(uploadsRoot, 'company', 'documents'))(req, res, next);
  } catch (err) {
    return res.status(403).json({ success: false, data: null, error: { code: 'FORBIDDEN', message: 'Invalid or expired document access token' } });
  }
});

// 2. Public static assets (branding, public labels, bulk labels, orders, invoices, reports, tickets)
const setCrossOriginHeaders = (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
};

app.use(`/${config.storage.uploadDir}/company/logos`, setCrossOriginHeaders, express.static(path.join(uploadsRoot, 'company', 'logos')));
app.use(`/${config.storage.uploadDir}/shipments`, setCrossOriginHeaders, express.static(path.join(uploadsRoot, 'shipments')));
app.use(`/${config.storage.uploadDir}/orders`, setCrossOriginHeaders, express.static(path.join(uploadsRoot, 'orders')));
app.use(`/${config.storage.uploadDir}/billing/invoices`, setCrossOriginHeaders, express.static(path.join(uploadsRoot, 'billing', 'invoices')));
app.use(`/${config.storage.uploadDir}/reports`, setCrossOriginHeaders, express.static(path.join(uploadsRoot, 'reports')));
app.use(`/${config.storage.uploadDir}/tickets`, setCrossOriginHeaders, express.static(path.join(uploadsRoot, 'tickets')));
app.use(`/${config.storage.uploadDir}/blogs`, setCrossOriginHeaders, express.static(path.join(uploadsRoot, 'blogs')));
app.use(`/${config.storage.uploadDir}/banners`, setCrossOriginHeaders, express.static(path.join(uploadsRoot, 'banners')));
app.use(`/${config.storage.uploadDir}/couriers`, setCrossOriginHeaders, express.static(path.join(uploadsRoot, 'couriers')));

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;
