'use strict';

/**
 * RBAC Permission Catalog for Platform Admin and Tenant User Panels
 * Defines all available functional modules, display names, navigation groups, and action keys.
 */

const ADMIN_MODULES = [
  {
    moduleKey: 'admin.dashboard',
    label: 'Dashboard Overview',
    group: 'Overview',
    description: 'Platform overview metrics, live throughput, and executive summaries',
    actions: ['view', 'export'],
  },
  {
    moduleKey: 'admin.sellers',
    label: 'Sellers & Merchants',
    group: 'Platform & Sellers',
    description: 'Seller list, business details, KYC status, and merchant suspension/activation',
    actions: ['view', 'edit', 'approve', 'export'],
  },
  {
    moduleKey: 'admin.plans',
    label: 'Subscription Plans',
    group: 'Platform & Sellers',
    description: 'SaaS tier plans, billing intervals, feature gates, and plan pricing',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    moduleKey: 'admin.booking_office',
    label: 'Booking Office',
    group: 'Platform & Sellers',
    description: 'Walk-in booking counter operations, cashier reconciliations, and walk-in shipments',
    actions: ['view', 'create', 'edit', 'approve'],
  },
  {
    moduleKey: 'admin.shipments',
    label: 'Shipments',
    group: 'Logistics & Couriers',
    description: 'Live consignments, manifest generation, shipping labels, and carrier status logs',
    actions: ['view', 'edit', 'delete', 'export'],
  },
  {
    moduleKey: 'admin.couriers',
    label: 'Courier Configuration',
    group: 'Logistics & Couriers',
    description: 'Carrier credentials, API gateways, courier priority, and status mappings',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    moduleKey: 'admin.rate_cards',
    label: 'Rate Cards',
    group: 'Logistics & Couriers',
    description: 'Weight slabs, zone pricing matrices, carrier cost cards, and markup formulas',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    moduleKey: 'admin.pincodes',
    label: 'Serviceable Pincodes',
    group: 'Logistics & Couriers',
    description: 'Nationwide pincode serviceability matrix, ODA areas, and courier routing rules',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    moduleKey: 'admin.st_rates',
    label: 'ST District Rates',
    group: 'Logistics & Couriers',
    description: 'ST Courier intra-district and inter-district rate card tables',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    moduleKey: 'admin.orders',
    label: 'Orders Monitor',
    group: 'Operations',
    description: 'Consolidated order pool, bulk assignments, order cancellations, and item details',
    actions: ['view', 'edit', 'delete', 'export'],
  },
  {
    moduleKey: 'admin.ndr',
    label: 'NDR Queue',
    group: 'Operations',
    description: 'Non-delivery reports, reattempt scheduling, customer feedback, and RTO escalations',
    actions: ['view', 'edit', 'approve'],
  },
  {
    moduleKey: 'admin.rto',
    label: 'Returns & RTO',
    group: 'Operations',
    description: 'Return-to-origin consignments, reverse logistics tracking, and warehouse check-in',
    actions: ['view', 'edit', 'approve'],
  },
  {
    moduleKey: 'admin.weight_disputes',
    label: 'Weight Disputes',
    group: 'Operations',
    description: 'Carrier weight discrepancy claims, photographic evidence audits, and charge dispute resolutions',
    actions: ['view', 'edit', 'approve'],
  },
  {
    moduleKey: 'admin.support',
    label: 'Support Tickets',
    group: 'Operations',
    description: 'Merchant support ticket desk, agent assignments, live replies, and status resolution',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    moduleKey: 'admin.kyc',
    label: 'KYC Approvals',
    group: 'Approvals & Compliance',
    description: 'PAN, Aadhaar, GSTIN document verification and compliance sign-offs',
    actions: ['view', 'approve'],
  },
  {
    moduleKey: 'admin.remittance',
    label: 'COD Remittances',
    group: 'Finance & Remittance',
    description: 'COD payment cycles, bank batch payouts, remittance reconciliation, and credit advices',
    actions: ['view', 'create', 'approve', 'export'],
  },
  {
    moduleKey: 'admin.invoices',
    label: 'Platform Invoices',
    group: 'Finance & Remittance',
    description: 'B2B platform tax invoices, GST breakdowns, credit notes, and statement downloads',
    actions: ['view', 'create', 'export'],
  },
  {
    moduleKey: 'admin.wallet_adjust',
    label: 'Wallet Adjustments',
    group: 'Finance & Remittance',
    description: 'Manual wallet credits, debits, dispute refunds, and bonus ledger entries',
    actions: ['view', 'create', 'approve'],
  },
  {
    moduleKey: 'admin.coupons',
    label: 'Platform Coupons',
    group: 'Finance & Remittance',
    description: 'Promotional discount coupons, merchant referral codes, and validity rules',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    moduleKey: 'admin.reports',
    label: 'Reports & Analytics',
    group: 'Reports & Analytics',
    description: 'Seller overdue aging reports, amount received ledgers, and operational district breakdown',
    actions: ['view', 'export'],
  },
  {
    moduleKey: 'admin.integrations',
    label: 'Gateways & Integrations',
    group: 'Integrations & API Settings',
    description: 'Google Maps API, OAuth, SMS gateways, WhatsApp BSP bots, SMTP email, and Payment Gateways',
    actions: ['view', 'edit'],
  },
  {
    moduleKey: 'admin.pricing',
    label: 'Pricing Engine',
    group: 'System & Configuration',
    description: 'Markup calculators, cost rate imports, RTO/COD markup rules, and margin matrices',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    moduleKey: 'admin.banners',
    label: 'Banner Manager',
    group: 'System & Configuration',
    description: 'Homepage and user dashboard promo banners, announcements, and click-through links',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    moduleKey: 'admin.blogs',
    label: 'Blogs & News',
    group: 'System & Configuration',
    description: 'E-commerce logistics blog studio, SEO metadata, rich text publishing, and article deletion',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    moduleKey: 'admin.team',
    label: 'Team & RBAC',
    group: 'System & Configuration',
    description: 'Platform staff accounts, custom roles, permission matrix assignments, and password resets',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    moduleKey: 'admin.activity_log',
    label: 'Audit Logs',
    group: 'System & Configuration',
    description: 'Platform admin audit trails, IP logs, critical setting change histories, and security logs',
    actions: ['view', 'export'],
  },
  {
    moduleKey: 'admin.settings',
    label: 'Platform Settings',
    group: 'System & Configuration',
    description: 'Global system configurations, maintenance mode, system notification banners, and app metadata',
    actions: ['view', 'edit'],
  },
];

const USER_MODULES = [
  {
    moduleKey: 'user.dashboard',
    label: 'Dashboard Overview',
    group: 'Main Menu',
    description: 'Real-time shipments overview, order pipeline status, and quick stats',
    actions: ['view'],
  },
  {
    moduleKey: 'user.shipments',
    label: 'Shipments',
    group: 'Main Menu',
    description: 'Shipment tracking, label printing, manifest creation, and courier waybill management',
    actions: ['view', 'create', 'edit', 'delete', 'export'],
  },
  {
    moduleKey: 'user.orders',
    label: 'Orders Management',
    group: 'Main Menu',
    description: 'Single and bulk order upload, courier allocation, order cancellation, and packing slips',
    actions: ['view', 'create', 'edit', 'delete', 'export'],
  },
  {
    moduleKey: 'user.walkin',
    label: 'Walk-in Booking',
    group: 'Main Menu',
    description: 'Counter booking orders and instant label generation (Booking Office accounts)',
    actions: ['view', 'create', 'edit'],
  },
  {
    moduleKey: 'user.ndr',
    label: 'Delivery Issues (NDR)',
    group: 'Main Menu',
    description: 'Customer delivery exception responses, address adjustments, and delivery reattempts',
    actions: ['view', 'edit'],
  },
  {
    moduleKey: 'user.rto',
    label: 'Returns & RTO',
    group: 'Main Menu',
    description: 'Track returned packages, undelivered consignment check-ins, and return metrics',
    actions: ['view', 'edit'],
  },
  {
    moduleKey: 'user.couriers',
    label: 'Rate Calculator & Couriers',
    group: 'Main Menu',
    description: 'Compare shipping rates across available carriers (Delhivery, Blue Dart, Ekart, etc.)',
    actions: ['view'],
  },
  {
    moduleKey: 'user.billing',
    label: 'Billing & Invoices',
    group: 'Main Menu',
    description: 'Monthly freight invoices, credit notes, and payment receipts',
    actions: ['view', 'export'],
  },
  {
    moduleKey: 'user.reports',
    label: 'Reports & Analytics',
    group: 'Main Menu',
    description: 'COD vs Prepaid split, courier performance analytics, and zone distribution maps',
    actions: ['view', 'export'],
  },
  {
    moduleKey: 'user.channels',
    label: 'Stores & Channels',
    group: 'Main Menu',
    description: 'Shopify, WooCommerce, webhooks, and REST developer API key management',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    moduleKey: 'user.support',
    label: 'Support Tickets',
    group: 'Main Menu',
    description: 'Create and track support tickets with the Nanoshipy logistics support desk',
    actions: ['view', 'create', 'edit'],
  },
  {
    moduleKey: 'user.wallet',
    label: 'Wallet & Payments',
    group: 'Main Menu',
    description: 'Recharge wallet balance, view debit history, and inspect COD remittances',
    actions: ['view', 'create', 'export'],
  },
  {
    moduleKey: 'user.addresses',
    label: 'Pickup Addresses',
    group: 'Settings',
    description: 'Warehouse and merchant pickup address book',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    moduleKey: 'user.company',
    label: 'Company & KYC',
    group: 'Settings',
    description: 'Legal entity details, GSTIN, and identity verification documents',
    actions: ['view', 'edit'],
  },
  {
    moduleKey: 'user.labels',
    label: 'Label Customization',
    group: 'Settings',
    description: 'Thermal vs standard shipping label layout, branding logo, and return address preferences',
    actions: ['view', 'edit'],
  },
  {
    moduleKey: 'user.team',
    label: 'Team & Staff Roles',
    group: 'Settings',
    description: 'Staff accounts, role creation, and permission configuration for team members',
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    moduleKey: 'user.activity_log',
    label: 'Activity Log',
    group: 'Settings',
    description: 'Audit log of actions performed by team members under this account',
    actions: ['view', 'export'],
  },
];

/**
 * Returns a flat array of all permission keys for admin panel.
 * E.g., ['admin.dashboard.view', 'admin.dashboard.export', ...]
 */
function getAllAdminPermissionKeys() {
  const keys = [];
  ADMIN_MODULES.forEach(mod => {
    mod.actions.forEach(action => {
      keys.push(`${mod.moduleKey}.${action}`);
    });
  });
  return keys;
}

/**
 * Returns a flat array of all permission keys for user tenant panel.
 * E.g., ['user.orders.view', 'user.orders.create', ...]
 */
function getAllUserPermissionKeys() {
  const keys = [];
  USER_MODULES.forEach(mod => {
    mod.actions.forEach(action => {
      keys.push(`${mod.moduleKey}.${action}`);
    });
  });
  return keys;
}

module.exports = {
  ADMIN_MODULES,
  USER_MODULES,
  getAllAdminPermissionKeys,
  getAllUserPermissionKeys,
};
