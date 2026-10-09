'use strict';

const { Op } = require('sequelize');

/**
 * Format date in Indian Standard Time (IST) UTC+05:30.
 */
function formatISTDate(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatDateOnly(dateVal) {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatCurrency(val) {
  if (val === null || val === undefined || isNaN(Number(val))) return '0.00';
  return Number(val).toFixed(2);
}

function formatStatus(val) {
  if (!val) return '';
  return String(val)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Neutralizes Excel formula injection:
 * Prepends a single quote if the value starts with =, +, -, @, \t, or \r.
 */
function sanitizeCellValue(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (val instanceof Date) return formatISTDate(val);

  const str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

const FORMATTERS = {
  currency: formatCurrency,
  datetime: formatISTDate,
  date: formatDateOnly,
  status: formatStatus,
  sanitize: sanitizeCellValue,
};

/**
 * Config-driven Export Registry
 */
const EXPORT_REGISTRY = {
  orders: {
    key: 'orders',
    label: 'Orders',
    modelName: 'Order',
    allowedFilters: ['status', 'payment_mode', 'from', 'to', 'date_from', 'date_to', 'search', 'tenant_id'],
    requiredPermission: 'order.view',
    columns: [
      { header: 'Order Reference', key: 'order_reference', width: 22 },
      { header: 'External Order ID', key: 'external_order_id', width: 22 },
      { header: 'Customer Name', key: 'customer_name', width: 24 },
      { header: 'Customer Phone', key: 'customer_phone', width: 16 },
      { header: 'Customer Email', key: 'customer_email', width: 26 },
      { header: 'Shipping City', key: 'shipping_city', width: 18 },
      { header: 'Shipping State', key: 'shipping_state', width: 18 },
      { header: 'Pincode', key: 'shipping_pincode', width: 12 },
      { header: 'Payment Mode', key: 'payment_mode', width: 15, formatter: 'status' },
      { header: 'Order Value (INR)', key: 'order_value', width: 18, formatter: 'currency' },
      { header: 'Status', key: 'status', width: 16, formatter: 'status' },
      { header: 'Created At (IST)', key: 'created_at', width: 22, formatter: 'datetime' },
    ],
    buildWhere: (tenantId, filters = {}) => {
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (filters.status) where.status = filters.status;
      if (filters.payment_mode) where.payment_mode = filters.payment_mode;

      const from = filters.from || filters.date_from;
      const to = filters.to || filters.date_to;
      if (from || to) {
        where.created_at = {};
        if (from) where.created_at[Op.gte] = new Date(`${from} 00:00:00.000`);
        if (to) where.created_at[Op.lte] = new Date(`${to} 23:59:59.999`);
      }

      if (filters.search) {
        where[Op.or] = [
          { order_reference: { [Op.like]: `%${filters.search}%` } },
          { external_order_id: { [Op.like]: `%${filters.search}%` } },
          { customer_name: { [Op.like]: `%${filters.search}%` } },
          { customer_phone: { [Op.like]: `%${filters.search}%` } },
        ];
      }
      return where;
    },
  },

  shipments: {
    key: 'shipments',
    label: 'Shipments',
    modelName: 'Shipment',
    allowedFilters: ['status', 'courier_provider_id', 'payment_mode', 'from', 'to', 'date_from', 'date_to', 'search', 'tenant_id'],
    requiredPermission: 'shipment.view',
    columns: [
      { header: 'AWB Number', key: 'awb_number', width: 22 },
      { header: 'Courier Shipment ID', key: 'courier_shipment_id', width: 22 },
      { header: 'Status', key: 'status', width: 18, formatter: 'status' },
      { header: 'Weight (KG)', key: 'weight_kg', width: 14 },
      { header: 'Charged Weight (KG)', key: 'charged_weight_kg', width: 18 },
      { header: 'Payment Mode', key: 'payment_mode', width: 15, formatter: 'status' },
      { header: 'Collectable Amount', key: 'collectable_amount', width: 18, formatter: 'currency' },
      { header: 'Freight Charge', key: 'applied_freight_charge', width: 16, formatter: 'currency' },
      { header: 'COD Charge', key: 'cod_charge', width: 14, formatter: 'currency' },
      { header: 'Origin Pincode', key: 'origin_pincode', width: 14 },
      { header: 'Destination Pincode', key: 'destination_pincode', width: 18 },
      { header: 'Created At (IST)', key: 'created_at', width: 22, formatter: 'datetime' },
    ],
    buildWhere: (tenantId, filters = {}) => {
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (filters.status) where.status = filters.status;
      if (filters.courier_provider_id) where.courier_provider_id = filters.courier_provider_id;
      if (filters.payment_mode) where.payment_mode = filters.payment_mode;

      const from = filters.from || filters.date_from;
      const to = filters.to || filters.date_to;
      if (from || to) {
        where.created_at = {};
        if (from) where.created_at[Op.gte] = new Date(`${from} 00:00:00.000`);
        if (to) where.created_at[Op.lte] = new Date(`${to} 23:59:59.999`);
      }

      if (filters.search) {
        where[Op.or] = [
          { awb_number: { [Op.like]: `%${filters.search}%` } },
          { courier_shipment_id: { [Op.like]: `%${filters.search}%` } },
        ];
      }
      return where;
    },
  },

  ndr: {
    key: 'ndr',
    label: 'NDR Exceptions',
    modelName: 'NdrEvent',
    allowedFilters: ['status', 'action_status', 'reason', 'from', 'to', 'date_from', 'date_to', 'tenant_id'],
    requiredPermission: 'ndr.view',
    columns: [
      { header: 'AWB Number', key: 'awb_number', width: 22 },
      { header: 'NDR Reason', key: 'reason', width: 30 },
      { header: 'Action Status', key: 'action_status', width: 18, formatter: 'status' },
      { header: 'Reattempts', key: 'reattempt_count', width: 14 },
      { header: 'Next Attempt Date', key: 'next_attempt_date', width: 18, formatter: 'date' },
      { header: 'Status', key: 'status', width: 16, formatter: 'status' },
      { header: 'Created At (IST)', key: 'created_at', width: 22, formatter: 'datetime' },
    ],
    buildWhere: (tenantId, filters = {}) => {
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (filters.status) where.status = filters.status;
      if (filters.action_status) where.action_status = filters.action_status;
      if (filters.reason) where.reason = { [Op.like]: `%${filters.reason}%` };

      const from = filters.from || filters.date_from;
      const to = filters.to || filters.date_to;
      if (from || to) {
        where.created_at = {};
        if (from) where.created_at[Op.gte] = new Date(`${from} 00:00:00.000`);
        if (to) where.created_at[Op.lte] = new Date(`${to} 23:59:59.999`);
      }
      return where;
    },
  },

  cod_remittances: {
    key: 'cod_remittances',
    label: 'COD Remittances',
    modelName: 'CodRemittance',
    allowedFilters: ['status', 'from', 'to', 'date_from', 'date_to', 'tenant_id'],
    requiredPermission: 'remittance.view',
    columns: [
      { header: 'Remittance Reference', key: 'remittance_reference', width: 24 },
      { header: 'Total Amount (INR)', key: 'total_amount', width: 18, formatter: 'currency' },
      { header: 'Bank Account Number', key: 'bank_account_number', width: 22 },
      { header: 'Bank IFSC', key: 'bank_ifsc', width: 16 },
      { header: 'UTR Number', key: 'utr_number', width: 24 },
      { header: 'Status', key: 'status', width: 16, formatter: 'status' },
      { header: 'Remitted At (IST)', key: 'remitted_at', width: 22, formatter: 'datetime' },
      { header: 'Created At (IST)', key: 'created_at', width: 22, formatter: 'datetime' },
    ],
    buildWhere: (tenantId, filters = {}) => {
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (filters.status) where.status = filters.status;

      const from = filters.from || filters.date_from;
      const to = filters.to || filters.date_to;
      if (from || to) {
        where.created_at = {};
        if (from) where.created_at[Op.gte] = new Date(`${from} 00:00:00.000`);
        if (to) where.created_at[Op.lte] = new Date(`${to} 23:59:59.999`);
      }
      return where;
    },
  },

  wallet_transactions: {
    key: 'wallet_transactions',
    label: 'Wallet Transactions',
    modelName: 'WalletTransaction',
    allowedFilters: ['type', 'reference_type', 'from', 'to', 'date_from', 'date_to', 'tenant_id'],
    requiredPermission: 'wallet.view',
    columns: [
      { header: 'Transaction Type', key: 'type', width: 16, formatter: 'status' },
      { header: 'Amount (INR)', key: 'amount', width: 16, formatter: 'currency' },
      { header: 'Balance Before', key: 'balance_before', width: 16, formatter: 'currency' },
      { header: 'Balance After', key: 'balance_after', width: 16, formatter: 'currency' },
      { header: 'Reference Type', key: 'reference_type', width: 18 },
      { header: 'Reference ID', key: 'reference_id', width: 24 },
      { header: 'Description', key: 'description', width: 32 },
      { header: 'Created At (IST)', key: 'created_at', width: 22, formatter: 'datetime' },
    ],
    buildWhere: (tenantId, filters = {}) => {
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (filters.type) where.type = filters.type;
      if (filters.reference_type) where.reference_type = filters.reference_type;

      const from = filters.from || filters.date_from;
      const to = filters.to || filters.date_to;
      if (from || to) {
        where.created_at = {};
        if (from) where.created_at[Op.gte] = new Date(`${from} 00:00:00.000`);
        if (to) where.created_at[Op.lte] = new Date(`${to} 23:59:59.999`);
      }
      return where;
    },
  },

  customers: {
    key: 'customers',
    label: 'Customers / Sellers',
    modelName: 'Tenant',
    allowedFilters: ['status', 'kyc_status', 'search', 'from', 'to', 'date_from', 'date_to'],
    requiredPermission: 'tenant.view',
    columns: [
      { header: 'Company Name', key: 'company_name', width: 26 },
      { header: 'Contact Person', key: 'contact_name', width: 22 },
      { header: 'Contact Email', key: 'contact_email', width: 28 },
      { header: 'Contact Phone', key: 'contact_phone', width: 18 },
      { header: 'GSTIN', key: 'gstin', width: 18 },
      { header: 'PAN Number', key: 'pan_number', width: 16 },
      { header: 'Account Status', key: 'status', width: 16, formatter: 'status' },
      { header: 'KYC Status', key: 'kyc_status', width: 16, formatter: 'status' },
      { header: 'Created At (IST)', key: 'created_at', width: 22, formatter: 'datetime' },
    ],
    buildWhere: (_tenantId, filters = {}) => {
      const where = {};
      if (filters.status) where.status = filters.status;
      if (filters.kyc_status) where.kyc_status = filters.kyc_status;

      const from = filters.from || filters.date_from;
      const to = filters.to || filters.date_to;
      if (from || to) {
        where.created_at = {};
        if (from) where.created_at[Op.gte] = new Date(`${from} 00:00:00.000`);
        if (to) where.created_at[Op.lte] = new Date(`${to} 23:59:59.999`);
      }

      if (filters.search) {
        where[Op.or] = [
          { company_name: { [Op.like]: `%${filters.search}%` } },
          { contact_name: { [Op.like]: `%${filters.search}%` } },
          { contact_email: { [Op.like]: `%${filters.search}%` } },
          { contact_phone: { [Op.like]: `%${filters.search}%` } },
        ];
      }
      return where;
    },
  },

  support_tickets: {
    key: 'support_tickets',
    label: 'Support Tickets',
    modelName: 'SupportTicket',
    allowedFilters: ['status', 'priority', 'category', 'from', 'to', 'date_from', 'date_to', 'tenant_id'],
    requiredPermission: 'support.view',
    columns: [
      { header: 'Ticket Number', key: 'ticket_number', width: 18 },
      { header: 'Subject', key: 'subject', width: 32 },
      { header: 'Category', key: 'category', width: 18, formatter: 'status' },
      { header: 'Priority', key: 'priority', width: 14, formatter: 'status' },
      { header: 'Status', key: 'status', width: 16, formatter: 'status' },
      { header: 'Linked Shipment ID', key: 'shipment_id', width: 24 },
      { header: 'Created At (IST)', key: 'created_at', width: 22, formatter: 'datetime' },
    ],
    buildWhere: (tenantId, filters = {}) => {
      const where = {};
      if (tenantId) where.tenant_id = tenantId;
      if (filters.status) where.status = filters.status;
      if (filters.priority) where.priority = filters.priority;
      if (filters.category) where.category = filters.category;

      const from = filters.from || filters.date_from;
      const to = filters.to || filters.date_to;
      if (from || to) {
        where.created_at = {};
        if (from) where.created_at[Op.gte] = new Date(`${from} 00:00:00.000`);
        if (to) where.created_at[Op.lte] = new Date(`${to} 23:59:59.999`);
      }
      return where;
    },
  },
};

/**
 * Get entity configuration by key
 */
function getEntityConfig(entityKey) {
  if (!entityKey) return null;
  return EXPORT_REGISTRY[entityKey.toLowerCase()] || null;
}

/**
 * List all exportable entities metadata
 */
function listExportableEntities() {
  return Object.values(EXPORT_REGISTRY).map((cfg) => ({
    key: cfg.key,
    label: cfg.label,
    allowedFilters: cfg.allowedFilters,
    requiredPermission: cfg.requiredPermission,
    columns: cfg.columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width,
    })),
  }));
}

/**
 * Validates requested filters against the whitelist.
 * Returns only allowed filter key-values.
 */
function sanitizeFilters(entityKey, rawFilters = {}) {
  const cfg = getEntityConfig(entityKey);
  if (!cfg) return {};
  const clean = {};
  for (const [k, v] of Object.entries(rawFilters)) {
    if (cfg.allowedFilters.includes(k) && v !== undefined && v !== null && v !== '') {
      clean[k] = v;
    }
  }
  return clean;
}

/**
 * Validates and selects requested column subset.
 * If no columns specified, returns all columns for the entity.
 */
function resolveColumns(entityKey, requestedColumnKeys = null) {
  const cfg = getEntityConfig(entityKey);
  if (!cfg) return [];
  if (!Array.isArray(requestedColumnKeys) || requestedColumnKeys.length === 0) {
    return cfg.columns;
  }
  const set = new Set(requestedColumnKeys);
  const matched = cfg.columns.filter((c) => set.has(c.key));
  return matched.length > 0 ? matched : cfg.columns;
}

module.exports = {
  EXPORT_REGISTRY,
  exportRegistry: EXPORT_REGISTRY,
  FORMATTERS,
  formatISTDate,
  sanitizeCellValue,
  getEntityConfig,
  listExportableEntities,
  sanitizeFilters,
  resolveColumns,
};

