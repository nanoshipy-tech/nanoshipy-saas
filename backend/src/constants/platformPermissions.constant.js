const PLATFORM_PERMISSIONS = [
  { key: 'tenant.view', module_name: 'tenant', description: 'View tenants' },
  { key: 'tenant.suspend', module_name: 'tenant', description: 'Suspend tenants' },
  { key: 'tenant.activate', module_name: 'tenant', description: 'Activate tenants' },
  { key: 'tenant.impersonate', module_name: 'tenant', description: 'Impersonate a tenant' },
  
  { key: 'courier.view', module_name: 'courier', description: 'View couriers' },
  { key: 'courier.manage', module_name: 'courier', description: 'Manage couriers' },
  
  { key: 'plan.view', module_name: 'subscription', description: 'View subscription plans' },
  { key: 'plan.manage', module_name: 'subscription', description: 'Manage subscription plans' },
  
  { key: 'revenue.view', module_name: 'revenue', description: 'View platform revenue' },
  
  { key: 'invoice.view', module_name: 'billing', description: 'View billing invoices' },
  { key: 'invoice.manage', module_name: 'billing', description: 'Manage billing invoices' },
  { key: 'finance.manage', module_name: 'finance', description: 'Manage wallet adjustments and financial operations' },
  
  { key: 'ticket.view', module_name: 'support', description: 'View support tickets' },
  { key: 'ticket.manage', module_name: 'support', description: 'Manage support tickets' },
  
  { key: 'admin.view', module_name: 'platform_admin', description: 'View platform admins' },
  { key: 'admin.manage', module_name: 'platform_admin', description: 'Manage platform admins' },
  
  { key: 'report.view', module_name: 'report', description: 'View platform reports' },
  
  { key: 'platform_settings.manage', module_name: 'settings', description: 'Manage platform settings' },
  
  { key: 'rate_card.view', module_name: 'rate_card', description: 'View platform rate cards' },
  { key: 'rate_card.manage', module_name: 'rate_card', description: 'Manage platform rate cards' },
  
  { key: 'pricing.view', module_name: 'pricing', description: 'View pricing markups and cost rates' },
  { key: 'pricing.manage', module_name: 'pricing', description: 'Manage pricing markups and cost rates' },
  
  { key: 'pincode.view', module_name: 'pincode', description: 'View serviceable pincodes' },
  { key: 'pincode.manage', module_name: 'pincode', description: 'Manage serviceable pincodes' },
  
  { key: 'kyc.view', module_name: 'kyc', description: 'View merchant KYC submissions' },
  { key: 'kyc.manage', module_name: 'kyc', description: 'Approve or reject merchant KYC submissions' },
];

const PLATFORM_ROLES = {
  super_admin: PLATFORM_PERMISSIONS.map(p => p.key), // Gets everything
  platform_staff: [
    'tenant.view', 'tenant.suspend', 'tenant.activate', 'tenant.impersonate',
    'courier.view', 'plan.view', 'revenue.view', 'invoice.view', 'ticket.view', 'ticket.manage', 'report.view'
  ],
  finance: [
    'tenant.view', 'plan.view', 'plan.manage', 'revenue.view', 'invoice.view', 'invoice.manage', 'finance.manage', 'report.view'
  ],
  key_account_manager: [
    'tenant.view', 'report.view', 'ticket.view', 'ticket.manage'
  ],
  support_agent: [
    'tenant.view', 'tenant.impersonate', 'ticket.view', 'ticket.manage'
  ]
};

module.exports = {
  PLATFORM_PERMISSIONS,
  PLATFORM_ROLES,
};
