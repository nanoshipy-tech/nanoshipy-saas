# Nanoshipy Logistics SaaS — Admin Excel Exports & Webhooks

## 1. Overview
The **Export to Excel** system allows administrators and merchants to export large datasets (`orders`, `shipments`, `ndr`, `cod_remittances`, `wallet_transactions`, `customers`, and `support_tickets`) to styled `.xlsx` workbooks with zero server memory bloat via keyset pagination and `ExcelJS` streaming. 

When exports complete or fail, outward webhooks are dispatched with SSRF protection, HMAC-SHA256 signatures, and an automatic exponential backoff retry mechanism (1m, 5m, 30m, 2h, 6h).

---

## 2. Environment Configuration
Add the following variables to your `.env` file (see `.env.example`):

```bash
# Maximum rows returned synchronously before switching to background processing
EXPORT_SYNC_ROW_LIMIT=5000

# Maximum rows allowed in a single export request
EXPORT_MAX_ROWS=50000

# Maximum concurrent active export jobs per tenant
EXPORT_MAX_CONCURRENT_PER_TENANT=3

# Number of hours before generated export files are automatically cleaned up
EXPORT_FILE_TTL_HOURS=24

# Batch size for keyset-paginated database queries
EXPORT_BATCH_SIZE=1000

# Webhook request timeout in milliseconds
WEBHOOK_TIMEOUT_MS=10000

# Maximum delivery retry attempts
WEBHOOK_MAX_ATTEMPTS=5

# Automatic disabling threshold for consecutive delivery failures
WEBHOOK_DISABLE_AFTER_FAILURES=10
```

---

## 3. Webhook Specification

Every webhook request sent by Nanoshipy contains the following HTTP headers:

| Header | Description |
|---|---|
| `Content-Type` | `application/json` |
| `X-Nanoshipy-Event` | Event name (e.g. `export.completed`, `export.failed`) |
| `X-Nanoshipy-Event-Id` | Unique UUID for the delivery attempt (idempotency key) |
| `X-Nanoshipy-Timestamp` | ISO 8601 timestamp string of the dispatch time |
| `X-Nanoshipy-Signature` | Hex-encoded HMAC-SHA256 signature |

The signature is computed as:
```
HMAC-SHA256(secret, `${timestamp}.${rawBody}`)
```

### Event Payload Example (`export.completed`)
```json
{
  "id": "c1f73b88-15a4-44bf-8899-73d8ab812f01",
  "event": "export.completed",
  "created_at": "2026-10-08T10:00:00.000Z",
  "tenant_id": "d9b7367c-9b78-43bf-9226-c22cb9a6e111",
  "data": {
    "export_id": "787c89f5-4422-4ef5-b664-d7ca1918a002",
    "entity": "orders",
    "total_rows": 1250,
    "file_size": 84520,
    "download_url": "https://api.nanoshipy.com/api/v1/admin/exports/787c89f5-4422-4ef5-b664-d7ca1918a002/download",
    "expires_at": "2026-10-09T10:00:00.000Z"
  }
}
```

---

## 4. Sample Webhook Receiver (Node.js + Express)

Here is a complete, production-ready receiver that verifies the signature using `crypto.timingSafeEqual` and rejects any payload with a timestamp older than 5 minutes to prevent replay attacks:

```javascript
const express = require('express');
const crypto = require('crypto');

const app = express();

// IMPORTANT: Parse raw body as buffer or raw string to verify HMAC exactly
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));

const WEBHOOK_SECRET = process.env.NANOSHIPY_WEBHOOK_SECRET || 'whsec_your_secret_here';
const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

function verifyNanoshipySignature(secret, rawBody, timestamp, signatureHeader) {
  if (!secret || !rawBody || !timestamp || !signatureHeader) {
    return false;
  }

  // 1. Replay attack protection: Reject timestamps older than 5 minutes
  const eventTime = new Date(timestamp).getTime();
  const currentTime = Date.now();
  if (isNaN(eventTime) || Math.abs(currentTime - eventTime) > MAX_AGE_MS) {
    console.warn(`[Webhook Receiver] Rejected stale timestamp: ${timestamp}`);
    return false;
  }

  // 2. Compute expected HMAC-SHA256 signature
  const dataToSign = `${timestamp}.${rawBody}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(dataToSign)
    .digest('hex');

  // Strip optional 'sha256=' prefix if provided
  const cleanedSignature = signatureHeader.replace(/^sha256=/i, '');

  // 3. Timing-safe comparison to prevent timing attacks
  const a = Buffer.from(cleanedSignature, 'hex');
  const b = Buffer.from(expectedSignature, 'hex');
  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}

app.post('/api/webhooks/nanoshipy', (req, res) => {
  const timestamp = req.headers['x-nanoshipy-timestamp'];
  const signature = req.headers['x-nanoshipy-signature'];
  const event = req.headers['x-nanoshipy-event'];
  const eventId = req.headers['x-nanoshipy-event-id'];

  // Verify HMAC signature
  const isValid = verifyNanoshipySignature(
    WEBHOOK_SECRET,
    req.rawBody,
    timestamp,
    signature
  );

  if (!isValid) {
    console.error(`[Webhook Receiver] Invalid signature or expired timestamp for event: ${event}`);
    return res.status(401).json({ error: 'Invalid webhook signature or stale timestamp' });
  }

  console.log(`[Webhook Receiver] Verified event received: ${event} (ID: ${eventId})`);

  // Handle Event
  switch (event) {
    case 'export.completed':
      console.log(`Export ${req.body.data.export_id} completed: ${req.body.data.total_rows} rows.`);
      console.log(`Download file: ${req.body.data.download_url}`);
      break;

    case 'export.failed':
      console.error(`Export ${req.body.data.export_id} failed:`, req.body.data.error);
      break;

    default:
      console.log(`Unhandled event: ${event}`);
  }

  // Respond 2xx to acknowledge receipt
  return res.status(200).json({ received: true });
});

app.listen(3000, () => {
  console.log('Webhook receiver listening on port 3000');
});
```

---

## 5. Running Tests
```bash
# Run unit and integration tests
npm test -- tests/unit/adminExportAndWebhooks.test.js tests/integration/exportWorkflow.test.js
```
