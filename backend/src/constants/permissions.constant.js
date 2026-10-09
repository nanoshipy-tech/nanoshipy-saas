const PERMISSIONS = [
  // Auth & System
  { key: 'auth.manage', module_name: 'auth', description: 'Manage authentication settings' },
  { key: 'settings.manage', module_name: 'settings', description: 'Manage system settings' },
  { key: 'webhook.view', module_name: 'webhook', description: 'View webhooks' },
  { key: 'webhook.manage', module_name: 'webhook', description: 'Manage webhooks' },
  { key: 'apikey.view', module_name: 'apikey', description: 'View API keys' },
  { key: 'apikey.manage', module_name: 'apikey', description: 'Manage API keys' },

  // User & Roles
  { key: 'user.view', module_name: 'user', description: 'View users' },
  { key: 'user.create', module_name: 'user', description: 'Create users' },
  { key: 'user.update', module_name: 'user', description: 'Update users' },
  { key: 'user.delete', module_name: 'user', description: 'Delete users' },
  { key: 'role.view', module_name: 'role', description: 'View roles' },
  { key: 'role.create', module_name: 'role', description: 'Create roles' },
  { key: 'role.update', module_name: 'role', description: 'Update roles' },
  { key: 'role.delete', module_name: 'role', description: 'Delete roles' },

  // Company / Tenant
  { key: 'company.view', module_name: 'company', description: 'View company profile' },
  { key: 'company.update', module_name: 'company', description: 'Update company profile' },
  { key: 'address.view', module_name: 'address', description: 'View addresses' },
  { key: 'address.create', module_name: 'address', description: 'Create addresses' },
  { key: 'address.update', module_name: 'address', description: 'Update addresses' },
  { key: 'address.delete', module_name: 'address', description: 'Delete addresses' },

  // Order & Shipments
  { key: 'order.view', module_name: 'order', description: 'View orders' },
  { key: 'order.create', module_name: 'order', description: 'Create orders' },
  { key: 'order.update', module_name: 'order', description: 'Update orders' },
  { key: 'order.delete', module_name: 'order', description: 'Delete orders' },
  { key: 'order.bulk_upload', module_name: 'order', description: 'Bulk upload orders' },
  
  { key: 'shipment.view', module_name: 'shipment', description: 'View shipments' },
  { key: 'shipment.create', module_name: 'shipment', description: 'Create shipments' },
  { key: 'shipment.cancel', module_name: 'shipment', description: 'Cancel shipments' },
  { key: 'shipment.label_generate', module_name: 'shipment', description: 'Generate labels' },

  // Tracking & Post-Shipment
  { key: 'tracking.view', module_name: 'tracking', description: 'View tracking' },
  { key: 'ndr.view', module_name: 'ndr', description: 'View NDRs' },
  { key: 'ndr.action', module_name: 'ndr', description: 'Action NDRs' },
  { key: 'rto.view', module_name: 'rto', description: 'View RTOs' },
  { key: 'rto.action', module_name: 'rto', description: 'Action RTOs' },

  // Courier & Partners
  { key: 'courier.view', module_name: 'courier', description: 'View couriers' },
  { key: 'courier.manage', module_name: 'courier', description: 'Manage couriers (Platform Admin)' },

  // Billing & Subscription
  { key: 'wallet.view', module_name: 'wallet', description: 'View wallet' },
  { key: 'wallet.recharge', module_name: 'wallet', description: 'Recharge wallet' },
  { key: 'billing.view', module_name: 'billing', description: 'View billing' },
  { key: 'billing.manage', module_name: 'billing', description: 'Manage billing' },
  { key: 'subscription.view', module_name: 'subscription', description: 'View subscription' },
  { key: 'subscription.manage', module_name: 'subscription', description: 'Manage subscription (Platform Admin)' },

  // Notifications & Support & Reports
  { key: 'notification.view', module_name: 'notification', description: 'View notifications' },
  { key: 'notification.manage', module_name: 'notification', description: 'Manage notifications' },
  { key: 'report.view', module_name: 'report', description: 'View reports' },
  { key: 'support.view', module_name: 'support', description: 'View support tickets' },
  { key: 'support.create', module_name: 'support', description: 'Create support tickets' },
  { key: 'support.manage', module_name: 'support', description: 'Manage support tickets' },
];

const RESERVED_PERMISSIONS = ['courier.manage', 'subscription.manage'];

module.exports = {
  PERMISSIONS,
  RESERVED_PERMISSIONS,
};
