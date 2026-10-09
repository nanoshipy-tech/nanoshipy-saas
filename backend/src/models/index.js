const sequelize = require('../config/db.config');

const Tenant = require('./tenant.model');
const Role = require('./role.model');
const Permission = require('./permission.model');
const User = require('./user.model');
const RefreshToken = require('./refreshToken.model');
const AuditLog = require('./auditLog.model');
const PasswordResetToken = require('./passwordResetToken.model');
const PickupAddress = require('./pickupAddress.model');
const CompanyDocument = require('./companyDocument.model');
const Order = require('./order.model');
const OrderItem = require('./orderItem.model');
const OrderStatusHistory = require('./orderStatusHistory.model');
const OrderImport = require('./orderImport.model');
const CourierProvider = require('./courierProvider.model');
const TenantCourierAccess = require('./tenantCourierAccess.model');
const ProviderHealthLog = require('./providerHealthLog.model');
const Shipment = require('./shipment.model');
const ShipmentRateQuote = require('./shipmentRateQuote.model');
const ShipmentStatusHistory = require('./shipmentStatusHistory.model');
const TrackingEvent = require('./trackingEvent.model');
const WebhookLog = require('./webhookLog.model');
const NdrEvent = require('./ndrEvent.model');
const NdrAction = require('./ndrAction.model');
const RtoRecord = require('./rtoRecord.model');
const Wallet = require('./wallet.model');
const WalletTransaction = require('./walletTransaction.model');
const RechargeOrder = require('./rechargeOrder.model');
const Invoice = require('./invoice.model');
const InvoiceLineItem = require('./invoiceLineItem.model');
const CreditNote = require('./creditNote.model');
const InvoiceSequence = require('./invoiceSequence.model');
const SubscriptionPlan = require('./subscriptionPlan.model');
const TenantSubscription = require('./tenantSubscription.model');
const PlanUsageTracking = require('./planUsageTracking.model');
const PlanChangeHistory = require('./planChangeHistory.model');
const NotificationTemplate = require('./notificationTemplate.model');
const NotificationPreference = require('./notificationPreference.model');
const NotificationLog = require('./notificationLog.model');
const InAppNotification = require('./inAppNotification.model');
const ApiKey = require('./apiKey.model');
const ApiKeyUsageLog = require('./apiKeyUsageLog.model');
const TenantWebhook = require('./tenantWebhook.model');
const WebhookDelivery = require('./webhookDelivery.model');
const AnalyticsDailySnapshot = require('./analyticsDailySnapshot.model');
const SystemSequence = require('./systemSequence.model');
const SupportTicket = require('./supportTicket.model');
const TicketMessage = require('./ticketMessage.model');
const TicketAttachment = require('./ticketAttachment.model');

// Module 18 — Settings & Activity Logs
const TenantSetting = require('./tenantSetting.model');
const PlatformSetting = require('./platformSetting.model');
const SettingsChangeHistory = require('./settingsChangeHistory.model');

// Module 19 — SOW Gap Closure Models
const KycDocument = require('./kycDocument.model');
const WhatsappTemplate = require('./whatsappTemplate.model');
const CodRemittance = require('./codRemittance.model');
const WeightDiscrepancyDispute = require('./weightDiscrepancyDispute.model');
const SubUser = require('./subUser.model');
const CarrierMarginConfig = require('./carrierMarginConfig.model');

// Module 21 — Payment Gateways & Wallet Recharge
const PaymentGateway = require('./paymentGateway.model');
const WalletRechargeTransaction = require('./walletRechargeTransaction.model');

// Blog & Banner Platform Models
const BlogPost = require('./blogPost.model');
const Banner = require('./banner.model');

// Module 21 v2 — Markup-Based Pricing & Cost Margin Layer
const RateCard = require('./rateCard.model');
const RateCardUploadLog = require('./rateCardUploadLog.model');
const CostRateSnapshot = require('./costRateSnapshot.model');
const CourierCostRate = require('./courierCostRate.model');
const MarkupConfig = require('./markupConfig.model');
const CodMarkupConfig = require('./codMarkupConfig.model');
const RtoMarkupConfig = require('./rtoMarkupConfig.model');
const ShippingAllocationRule = require('./shippingAllocationRule.model');

// Module 23 — Pincode Master & Address Lookup Audit Log
const PincodeMaster = require('./pincodeMaster.model');
const AddressLookupAuditLog = require('./addressLookupAuditLog.model');

// Storefront Integration Models
const StorefrontConnection = require('./storefrontConnection.model')(sequelize);
const StorefrontSyncLog = require('./storefrontSyncLog.model')(sequelize);
const ShopifyConnection = require('./shopifyConnection.model');

// Webhook Idempotency Registry
const WebhookIdempotency = require('./webhookIdempotency.model');

// Manifest Model
const Manifest = require('./manifest.model');

// Website Visitor Telemetry Model
const WebsiteVisitorEvent = require('./websiteVisitorEvent.model');

// Export Jobs & Webhook Endpoints
const ExportJob = require('./exportJob.model');
const WebhookEndpoint = require('./webhookEndpoint.model');

// Platform Models
const PlatformAdmin = require('./platformAdmin.model');
const PlatformRole = require('./platformRole.model');
const PlatformPermission = require('./platformPermission.model');
const PlatformRolePermission = require('./platformRolePermission.model');
const PlatformAuditLog = require('./platformAuditLog.model');
const ImpersonationSession = require('./impersonationSession.model');
const PlatformRefreshToken = require('./platformRefreshToken.model');
const WalletAdjustment = require('./walletAdjustment.model');
const WhatsappBspConfig = require('./whatsappBspConfig.model')(sequelize);

// Postpaid & Seller Payment Models
const SellerPaymentProfile = require('./sellerPaymentProfile.model');
const SellerPaymentTermsHistory = require('./sellerPaymentTermsHistory.model');
const PostpaidInvoice = require('./postpaidInvoice.model');
const PostpaidTransaction = require('./postpaidTransaction.model');
const PostpaidPayment = require('./postpaidPayment.model');

// ST Courier AWB Inventory Model
const StCourierAwbInventory = require('./stCourierAwbInventory.model');

// ST Courier District-Wise Rate Card Model
const StCourierDistrictRate = require('./stCourierDistrictRate.model');

// ST Courier Serviceable Pincodes Model
const StCourierServiceablePincode = require('./stCourierServiceablePincode.model');

// Wallet Coupon Models
const Coupon = require('./coupon.model');
const CouponUsage = require('./couponUsage.model');

// Register Associations for KAM and WalletAdjustment
Tenant.belongsTo(PlatformAdmin, { foreignKey: 'kam_id', as: 'kam' });
PlatformAdmin.hasMany(Tenant, { foreignKey: 'kam_id', as: 'assignedTenants' });

Tenant.hasMany(WalletAdjustment, { foreignKey: 'tenant_id', as: 'walletAdjustments', onDelete: 'CASCADE' });
WalletAdjustment.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
WalletAdjustment.belongsTo(PlatformAdmin, { foreignKey: 'admin_id', as: 'admin' });

// Register Associations for Postpaid and Payment Terms
Tenant.hasOne(SellerPaymentProfile, { foreignKey: 'tenant_id', as: 'paymentProfile', onDelete: 'CASCADE' });
SellerPaymentProfile.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(SellerPaymentTermsHistory, { foreignKey: 'tenant_id', as: 'paymentTermsHistory', onDelete: 'CASCADE' });
SellerPaymentTermsHistory.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
SellerPaymentTermsHistory.belongsTo(PlatformAdmin, { foreignKey: 'changed_by', as: 'admin' });

Tenant.hasMany(PostpaidInvoice, { foreignKey: 'tenant_id', as: 'postpaidInvoices', onDelete: 'CASCADE' });
PostpaidInvoice.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(PostpaidTransaction, { foreignKey: 'tenant_id', as: 'postpaidTransactions', onDelete: 'CASCADE' });
PostpaidTransaction.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
PostpaidTransaction.belongsTo(Shipment, { foreignKey: 'shipment_id', as: 'shipment' });
PostpaidTransaction.belongsTo(PostpaidInvoice, { foreignKey: 'invoice_id', as: 'invoice' });

Tenant.hasMany(PostpaidPayment, { foreignKey: 'tenant_id', as: 'postpaidPayments', onDelete: 'CASCADE' });
PostpaidPayment.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
PostpaidPayment.belongsTo(PostpaidInvoice, { foreignKey: 'invoice_id', as: 'invoice' });
PostpaidPayment.belongsTo(PlatformAdmin, { foreignKey: 'recorded_by', as: 'admin' });

// Register Associations for WalletRechargeTransaction
Tenant.hasMany(WalletRechargeTransaction, { foreignKey: 'tenant_id', as: 'rechargeTransactions', onDelete: 'CASCADE' });
WalletRechargeTransaction.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

User.hasMany(WalletRechargeTransaction, { foreignKey: 'user_id', as: 'rechargeTransactions', onDelete: 'CASCADE' });
WalletRechargeTransaction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

PaymentGateway.hasMany(WalletRechargeTransaction, { foreignKey: 'gateway_id', as: 'transactions' });
WalletRechargeTransaction.belongsTo(PaymentGateway, { foreignKey: 'gateway_id', as: 'gateway' });

// --- Associations ---

// Tenant - User
Tenant.hasMany(User, { foreignKey: 'tenant_id', as: 'users' });
Tenant.hasOne(User, { foreignKey: 'tenant_id', as: 'owner' }); // Alias for the first/primary user
User.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

Tenant.hasMany(AnalyticsDailySnapshot, { foreignKey: 'tenant_id', as: 'dailySnapshots' });
AnalyticsDailySnapshot.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

// Tenant - SupportTicket
Tenant.hasMany(SupportTicket, { foreignKey: 'tenant_id', as: 'tickets', onDelete: 'CASCADE' });
SupportTicket.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

// SupportTicket - User (Creator)
User.hasMany(SupportTicket, { foreignKey: 'created_by', as: 'tickets', onDelete: 'CASCADE' });
SupportTicket.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// SupportTicket - PlatformAdmin (Assignee)
PlatformAdmin.hasMany(SupportTicket, { foreignKey: 'assigned_to', as: 'assignedTickets', onDelete: 'SET NULL' });
SupportTicket.belongsTo(PlatformAdmin, { foreignKey: 'assigned_to', as: 'assignee' });

// SupportTicket - Order
Order.hasMany(SupportTicket, { foreignKey: 'related_order_id', as: 'tickets', onDelete: 'SET NULL' });
SupportTicket.belongsTo(Order, { foreignKey: 'related_order_id', as: 'order' });

// SupportTicket - Shipment
Shipment.hasMany(SupportTicket, { foreignKey: 'related_shipment_id', as: 'tickets', onDelete: 'SET NULL' });
SupportTicket.belongsTo(Shipment, { foreignKey: 'related_shipment_id', as: 'shipment' });

// SupportTicket - TicketMessage
SupportTicket.hasMany(TicketMessage, { foreignKey: 'ticket_id', as: 'messages', onDelete: 'CASCADE' });
TicketMessage.belongsTo(SupportTicket, { foreignKey: 'ticket_id', as: 'ticket' });

// SupportTicket - TicketAttachment
SupportTicket.hasMany(TicketAttachment, { foreignKey: 'ticket_id', as: 'attachments', onDelete: 'CASCADE' });
TicketAttachment.belongsTo(SupportTicket, { foreignKey: 'ticket_id', as: 'ticket' });

// TicketMessage - TicketAttachment
TicketMessage.hasMany(TicketAttachment, { foreignKey: 'ticket_message_id', as: 'attachments', onDelete: 'CASCADE' });
TicketAttachment.belongsTo(TicketMessage, { foreignKey: 'ticket_message_id', as: 'message' });

// Tenant - Role (tenant-specific roles)
Tenant.hasMany(Role, { foreignKey: 'tenant_id', as: 'roles' });
Role.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

// Role - User
Role.hasMany(User, { foreignKey: 'role_id', as: 'users' });
User.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });

// Role - Permission (Many-to-Many via role_permissions table)
const { DataTypes } = require('sequelize');
const RolePermission = sequelize.define('RolePermission', {
  role_id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
  },
  permission_id: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
  },
}, {
  tableName: 'role_permissions',
  timestamps: false,
  underscored: true,
});

Role.belongsToMany(Permission, { through: RolePermission, foreignKey: 'role_id', as: 'permissions' });
Permission.belongsToMany(Role, { through: RolePermission, foreignKey: 'permission_id', as: 'roles' });

// User - RefreshToken
User.hasMany(RefreshToken, { foreignKey: 'user_id', as: 'refreshTokens' });
RefreshToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User - PasswordResetToken
User.hasMany(PasswordResetToken, { foreignKey: 'user_id', as: 'passwordResetTokens' });
PasswordResetToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Tenant/User - AuditLog
Tenant.hasMany(AuditLog, { foreignKey: 'tenant_id', as: 'auditLogs' });
AuditLog.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

User.hasMany(AuditLog, { foreignKey: 'user_id', as: 'auditLogs' });
AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'actor' });

// PlatformAdmin - PlatformAuditLog
PlatformAdmin.hasMany(PlatformAuditLog, { foreignKey: 'platform_admin_id', as: 'auditLogs' });
PlatformAuditLog.belongsTo(PlatformAdmin, { foreignKey: 'platform_admin_id', as: 'admin' });

// PlatformAdmin - PlatformRole
PlatformAdmin.belongsTo(PlatformRole, { foreignKey: 'custom_role_id', as: 'customRole' });
PlatformRole.hasMany(PlatformAdmin, { foreignKey: 'custom_role_id', as: 'admins' });

// PlatformRole - PlatformPermission (Many-to-Many via platform_role_permissions)
PlatformRole.belongsToMany(PlatformPermission, {
  through: PlatformRolePermission,
  foreignKey: 'role',
  sourceKey: 'name',
  targetKey: 'id',
  otherKey: 'permission_id',
  as: 'permissions',
});
PlatformPermission.belongsToMany(PlatformRole, {
  through: PlatformRolePermission,
  foreignKey: 'permission_id',
  sourceKey: 'id',
  targetKey: 'name',
  otherKey: 'role',
  as: 'roles',
});

// Tenant - PlatformAuditLog
Tenant.hasMany(PlatformAuditLog, { foreignKey: 'target_tenant_id', as: 'platformAuditLogs' });
PlatformAuditLog.belongsTo(Tenant, { foreignKey: 'target_tenant_id', as: 'tenant' });

// PlatformAdmin - ImpersonationSession
PlatformAdmin.hasMany(ImpersonationSession, { foreignKey: 'platform_admin_id', as: 'impersonationSessions' });
ImpersonationSession.belongsTo(PlatformAdmin, { foreignKey: 'platform_admin_id', as: 'admin' });

// PlatformAdmin - PlatformRefreshToken
PlatformAdmin.hasMany(PlatformRefreshToken, { foreignKey: 'admin_id', as: 'refreshTokens' });
PlatformRefreshToken.belongsTo(PlatformAdmin, { foreignKey: 'admin_id', as: 'admin' });

// Tenant - ImpersonationSession
Tenant.hasMany(ImpersonationSession, { foreignKey: 'target_tenant_id', as: 'impersonationSessions' });
ImpersonationSession.belongsTo(Tenant, { foreignKey: 'target_tenant_id', as: 'tenant' });

// User - ImpersonationSession
User.hasMany(ImpersonationSession, { foreignKey: 'target_user_id', as: 'impersonationSessions' });
ImpersonationSession.belongsTo(User, { foreignKey: 'target_user_id', as: 'user' });

// Tenant - Order
Tenant.hasMany(Order, { foreignKey: 'tenant_id', as: 'orders' });
Order.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

// Order - OrderItem
Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'items', onDelete: 'CASCADE' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// Order - PickupAddress
PickupAddress.hasMany(Order, { foreignKey: 'pickup_address_id', as: 'orders' });
Order.belongsTo(PickupAddress, { foreignKey: 'pickup_address_id', as: 'pickupAddress' });

// Order - OrderStatusHistory
Order.hasMany(OrderStatusHistory, { foreignKey: 'order_id', as: 'statusHistory', onDelete: 'CASCADE' });
OrderStatusHistory.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// User - Order/OrderStatusHistory/OrderImport
User.hasMany(Order, { foreignKey: 'created_by', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

User.hasMany(OrderStatusHistory, { foreignKey: 'changed_by', as: 'orderStatusHistories' });
OrderStatusHistory.belongsTo(User, { foreignKey: 'changed_by', as: 'changedByUser' });

// Tenant - OrderImport
Tenant.hasMany(OrderImport, { foreignKey: 'tenant_id', as: 'orderImports' });
OrderImport.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

User.hasMany(OrderImport, { foreignKey: 'uploaded_by', as: 'orderImports' });
OrderImport.belongsTo(User, { foreignKey: 'uploaded_by', as: 'uploader' });

// CourierProvider - TenantCourierAccess
CourierProvider.hasMany(TenantCourierAccess, { foreignKey: 'courier_provider_id', as: 'tenantAccesses', onDelete: 'CASCADE' });
TenantCourierAccess.belongsTo(CourierProvider, { foreignKey: 'courier_provider_id', as: 'provider' });

// Tenant - TenantCourierAccess
Tenant.hasMany(TenantCourierAccess, { foreignKey: 'tenant_id', as: 'courierAccesses', onDelete: 'CASCADE' });
TenantCourierAccess.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

// CourierProvider - ProviderHealthLog
CourierProvider.hasMany(ProviderHealthLog, { foreignKey: 'courier_provider_id', as: 'healthLogs', onDelete: 'CASCADE' });
ProviderHealthLog.belongsTo(CourierProvider, { foreignKey: 'courier_provider_id', as: 'provider' });

// PlatformAdmin - CourierProvider
PlatformAdmin.hasMany(CourierProvider, { foreignKey: 'created_by', as: 'createdProviders' });
CourierProvider.belongsTo(PlatformAdmin, { foreignKey: 'created_by', as: 'creator' });

// Order - Shipment (One-to-Many: Forward, RTO, Reverse-pickup legs)
Order.hasMany(Shipment, { foreignKey: 'order_id', as: 'shipments', onDelete: 'CASCADE' });
Shipment.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// Self-referencing Parent-Child Shipment (For RTO and Reverse Pickup Legs)
Shipment.hasMany(Shipment, { foreignKey: 'parent_shipment_id', as: 'childShipments', onDelete: 'SET NULL' });
Shipment.belongsTo(Shipment, { foreignKey: 'parent_shipment_id', as: 'parentShipment' });

// Tenant - Shipment
Tenant.hasMany(Shipment, { foreignKey: 'tenant_id', as: 'shipments', onDelete: 'CASCADE' });
Shipment.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

// CourierProvider - Shipment
CourierProvider.hasMany(Shipment, { foreignKey: 'courier_provider_id', as: 'shipments', onDelete: 'RESTRICT' });
Shipment.belongsTo(CourierProvider, { foreignKey: 'courier_provider_id', as: 'provider' });

// PickupAddress - Shipment
PickupAddress.hasMany(Shipment, { foreignKey: 'pickup_address_id', as: 'shipments', onDelete: 'RESTRICT' });
Shipment.belongsTo(PickupAddress, { foreignKey: 'pickup_address_id', as: 'pickupAddress' });

// User - Shipment
User.hasMany(Shipment, { foreignKey: 'created_by', as: 'createdShipments', onDelete: 'RESTRICT' });
Shipment.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// Manifest - Shipment
Manifest.hasMany(Shipment, { foreignKey: 'manifest_id', as: 'shipments', onDelete: 'SET NULL' });
Shipment.belongsTo(Manifest, { foreignKey: 'manifest_id', as: 'manifest' });
Manifest.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
Manifest.belongsTo(CourierProvider, { foreignKey: 'courier_provider_id', as: 'courierProvider' });
Manifest.belongsTo(PickupAddress, { foreignKey: 'pickup_address_id', as: 'pickupAddress' });

// Shipment - ShipmentStatusHistory
Shipment.hasMany(ShipmentStatusHistory, { foreignKey: 'shipment_id', as: 'statusHistory', onDelete: 'CASCADE' });
ShipmentStatusHistory.belongsTo(Shipment, { foreignKey: 'shipment_id', as: 'shipment' });

// Order - ShipmentRateQuote
Order.hasMany(ShipmentRateQuote, { foreignKey: 'order_id', as: 'rateQuotes', onDelete: 'CASCADE' });
ShipmentRateQuote.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// CourierProvider - ShipmentRateQuote
CourierProvider.hasMany(ShipmentRateQuote, { foreignKey: 'courier_provider_id', as: 'rateQuotes', onDelete: 'CASCADE' });
ShipmentRateQuote.belongsTo(CourierProvider, { foreignKey: 'courier_provider_id', as: 'provider' });

// Shipment - TrackingEvent
Shipment.hasMany(TrackingEvent, { foreignKey: 'shipment_id', as: 'trackingEvents', onDelete: 'CASCADE' });
TrackingEvent.belongsTo(Shipment, { foreignKey: 'shipment_id', as: 'shipment' });

// CourierProvider - WebhookLog
CourierProvider.hasMany(WebhookLog, { foreignKey: 'courier_provider_id', as: 'webhookLogs', onDelete: 'SET NULL' });
WebhookLog.belongsTo(CourierProvider, { foreignKey: 'courier_provider_id', as: 'provider' });

// Tenant - NdrEvent
Tenant.hasMany(NdrEvent, { foreignKey: 'tenant_id', as: 'ndrEvents', onDelete: 'CASCADE' });
NdrEvent.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

// Shipment - NdrEvent
Shipment.hasMany(NdrEvent, { foreignKey: 'shipment_id', as: 'ndrEvents', onDelete: 'CASCADE' });
NdrEvent.belongsTo(Shipment, { foreignKey: 'shipment_id', as: 'shipment' });

// TrackingEvent - NdrEvent
TrackingEvent.hasMany(NdrEvent, { foreignKey: 'tracking_event_id', as: 'ndrEvents', onDelete: 'SET NULL' });
NdrEvent.belongsTo(TrackingEvent, { foreignKey: 'tracking_event_id', as: 'trackingEvent' });

// NdrEvent - NdrAction
NdrEvent.hasMany(NdrAction, { foreignKey: 'ndr_event_id', as: 'actions', onDelete: 'CASCADE' });
NdrAction.belongsTo(NdrEvent, { foreignKey: 'ndr_event_id', as: 'ndrEvent' });

// User - NdrAction
User.hasMany(NdrAction, { foreignKey: 'performed_by', as: 'ndrActions', onDelete: 'RESTRICT' });
NdrAction.belongsTo(User, { foreignKey: 'performed_by', as: 'performer' });

// Tenant - RtoRecord
Tenant.hasMany(RtoRecord, { foreignKey: 'tenant_id', as: 'rtoRecords', onDelete: 'CASCADE' });
RtoRecord.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

// Shipment - RtoRecord
Shipment.hasOne(RtoRecord, { foreignKey: 'shipment_id', as: 'rtoRecord', onDelete: 'CASCADE' });
RtoRecord.belongsTo(Shipment, { foreignKey: 'shipment_id', as: 'shipment' });

// Tenant - Wallet
Tenant.hasOne(Wallet, { foreignKey: 'tenant_id', as: 'wallet', onDelete: 'CASCADE' });
Wallet.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

// Wallet - WalletTransaction
Wallet.hasMany(WalletTransaction, { foreignKey: 'wallet_id', as: 'transactions', onDelete: 'CASCADE' });
WalletTransaction.belongsTo(Wallet, { foreignKey: 'wallet_id', as: 'wallet' });

// Tenant - WalletTransaction
Tenant.hasMany(WalletTransaction, { foreignKey: 'tenant_id', as: 'walletTransactions', onDelete: 'CASCADE' });
WalletTransaction.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

// User - WalletTransaction
User.hasMany(WalletTransaction, { foreignKey: 'performed_by', as: 'walletTransactions', onDelete: 'SET NULL' });
WalletTransaction.belongsTo(User, { foreignKey: 'performed_by', as: 'performer' });

// Tenant - RechargeOrder
Tenant.hasMany(RechargeOrder, { foreignKey: 'tenant_id', as: 'rechargeOrders', onDelete: 'CASCADE' });
RechargeOrder.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

// Wallet - RechargeOrder
Wallet.hasMany(RechargeOrder, { foreignKey: 'wallet_id', as: 'rechargeOrders', onDelete: 'CASCADE' });
RechargeOrder.belongsTo(Wallet, { foreignKey: 'wallet_id', as: 'wallet' });

// User - RechargeOrder
User.hasMany(RechargeOrder, { foreignKey: 'initiated_by', as: 'rechargeOrders', onDelete: 'RESTRICT' });
RechargeOrder.belongsTo(User, { foreignKey: 'initiated_by', as: 'initiator' });

// Tenant - Invoice
Tenant.hasMany(Invoice, { foreignKey: 'tenant_id', as: 'invoices', onDelete: 'CASCADE' });
Invoice.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

// Invoice - InvoiceLineItem
Invoice.hasMany(InvoiceLineItem, { foreignKey: 'invoice_id', as: 'lineItems', onDelete: 'CASCADE' });
InvoiceLineItem.belongsTo(Invoice, { foreignKey: 'invoice_id', as: 'invoice' });

// Tenant - CreditNote
Tenant.hasMany(CreditNote, { foreignKey: 'tenant_id', as: 'creditNotes', onDelete: 'CASCADE' });
CreditNote.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

// Invoice - CreditNote
Invoice.hasOne(CreditNote, { foreignKey: 'original_invoice_id', as: 'creditNote', onDelete: 'RESTRICT' });
CreditNote.belongsTo(Invoice, { foreignKey: 'original_invoice_id', as: 'originalInvoice' });

// Tenant - TenantSubscription
Tenant.hasOne(TenantSubscription, { foreignKey: 'tenant_id', as: 'subscription', onDelete: 'CASCADE' });
TenantSubscription.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

// SubscriptionPlan - TenantSubscription
SubscriptionPlan.hasMany(TenantSubscription, { foreignKey: 'plan_id', as: 'subscriptions', onDelete: 'RESTRICT' });
TenantSubscription.belongsTo(SubscriptionPlan, { foreignKey: 'plan_id', as: 'plan' });
TenantSubscription.belongsTo(SubscriptionPlan, { foreignKey: 'pending_plan_id', as: 'pendingPlan' });

// Tenant - PlanUsageTracking
Tenant.hasMany(PlanUsageTracking, { foreignKey: 'tenant_id', as: 'usages', onDelete: 'CASCADE' });
PlanUsageTracking.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

// Tenant - PlanChangeHistory
Tenant.hasMany(PlanChangeHistory, { foreignKey: 'tenant_id', as: 'subscriptionChanges', onDelete: 'CASCADE' });
PlanChangeHistory.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

// Tenant - NotificationPreference
Tenant.hasMany(NotificationPreference, { foreignKey: 'tenant_id', as: 'notificationPreferences', onDelete: 'CASCADE' });
NotificationPreference.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

// User - NotificationPreference
User.hasMany(NotificationPreference, { foreignKey: 'user_id', as: 'notificationPreferences', onDelete: 'CASCADE' });
NotificationPreference.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Tenant - NotificationLog
Tenant.hasMany(NotificationLog, { foreignKey: 'tenant_id', as: 'notificationLogs', onDelete: 'CASCADE' });
NotificationLog.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

// Tenant - InAppNotification
Tenant.hasMany(InAppNotification, { foreignKey: 'tenant_id', as: 'inAppNotifications', onDelete: 'CASCADE' });
InAppNotification.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

// User - InAppNotification
User.hasMany(InAppNotification, { foreignKey: 'user_id', as: 'inAppNotifications', onDelete: 'CASCADE' });
InAppNotification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Tenant - ApiKey
Tenant.hasMany(ApiKey, { foreignKey: 'tenant_id', as: 'apiKeys', onDelete: 'CASCADE' });
ApiKey.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

// User - ApiKey
User.hasMany(ApiKey, { foreignKey: 'created_by', as: 'createdApiKeys', onDelete: 'CASCADE' });
ApiKey.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// ApiKey - ApiKeyUsageLog
ApiKey.hasMany(ApiKeyUsageLog, { foreignKey: 'api_key_id', as: 'usageLogs', onDelete: 'CASCADE' });
ApiKeyUsageLog.belongsTo(ApiKey, { foreignKey: 'api_key_id', as: 'apiKey' });

// Tenant - TenantWebhook
Tenant.hasMany(TenantWebhook, { foreignKey: 'tenant_id', as: 'webhooks', onDelete: 'CASCADE' });
TenantWebhook.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

// User - TenantWebhook
User.hasMany(TenantWebhook, { foreignKey: 'created_by', as: 'createdWebhooks', onDelete: 'CASCADE' });
TenantWebhook.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// TenantWebhook - WebhookDelivery
TenantWebhook.hasMany(WebhookDelivery, { foreignKey: 'tenant_webhook_id', as: 'deliveries', onDelete: 'CASCADE' });
WebhookDelivery.belongsTo(TenantWebhook, { foreignKey: 'tenant_webhook_id', as: 'webhook' });

// Module 18 — Tenant Settings
Tenant.hasOne(TenantSetting, { foreignKey: 'tenant_id', as: 'settings', onDelete: 'CASCADE' });
TenantSetting.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

User.hasMany(TenantSetting, { foreignKey: 'updated_by', as: 'settingUpdates' });
TenantSetting.belongsTo(User, { foreignKey: 'updated_by', as: 'updatedByUser' });

// Module 18 — Platform Settings
PlatformAdmin.hasMany(PlatformSetting, { foreignKey: 'updated_by', as: 'settingUpdates' });
PlatformSetting.belongsTo(PlatformAdmin, { foreignKey: 'updated_by', as: 'updatedByAdmin' });

// Module 19 — Associations
Tenant.hasMany(KycDocument, { foreignKey: 'seller_id', as: 'kycDocuments', onDelete: 'CASCADE' });
KycDocument.belongsTo(Tenant, { foreignKey: 'seller_id', as: 'seller' });

PlatformAdmin.hasMany(KycDocument, { foreignKey: 'reviewed_by', as: 'reviewedKycDocuments' });
KycDocument.belongsTo(PlatformAdmin, { foreignKey: 'reviewed_by', as: 'reviewer' });

PlatformAdmin.hasMany(WhatsappTemplate, { foreignKey: 'created_by', as: 'whatsappTemplates' });
WhatsappTemplate.belongsTo(PlatformAdmin, { foreignKey: 'created_by', as: 'creator' });

Tenant.hasMany(CodRemittance, { foreignKey: 'seller_id', as: 'codRemittances', onDelete: 'CASCADE' });
CodRemittance.belongsTo(Tenant, { foreignKey: 'seller_id', as: 'seller' });

Tenant.hasMany(WeightDiscrepancyDispute, { foreignKey: 'seller_id', as: 'weightDisputes', onDelete: 'CASCADE' });
WeightDiscrepancyDispute.belongsTo(Tenant, { foreignKey: 'seller_id', as: 'seller' });

Shipment.hasOne(WeightDiscrepancyDispute, { foreignKey: 'shipment_id', as: 'weightDispute', onDelete: 'CASCADE' });
WeightDiscrepancyDispute.belongsTo(Shipment, { foreignKey: 'shipment_id', as: 'shipment' });

PlatformAdmin.hasMany(WeightDiscrepancyDispute, { foreignKey: 'resolved_by', as: 'resolvedWeightDisputes' });
WeightDiscrepancyDispute.belongsTo(PlatformAdmin, { foreignKey: 'resolved_by', as: 'resolver' });

Tenant.hasMany(SubUser, { foreignKey: 'seller_id', as: 'subUsers', onDelete: 'CASCADE' });
SubUser.belongsTo(Tenant, { foreignKey: 'seller_id', as: 'seller' });

CourierProvider.hasMany(CarrierMarginConfig, { foreignKey: 'carrier_id', as: 'margins', onDelete: 'CASCADE' });
CarrierMarginConfig.belongsTo(CourierProvider, { foreignKey: 'carrier_id', as: 'carrier' });

Tenant.hasMany(CarrierMarginConfig, { foreignKey: 'seller_id', as: 'margins', onDelete: 'CASCADE' });
CarrierMarginConfig.belongsTo(Tenant, { foreignKey: 'seller_id', as: 'seller' });

PlatformAdmin.hasMany(CarrierMarginConfig, { foreignKey: 'created_by', as: 'createdMargins' });
CarrierMarginConfig.belongsTo(PlatformAdmin, { foreignKey: 'created_by', as: 'creator' });

// Module 20 — Platform Integrations
const PlatformIntegration = require('./platformIntegration.model');
const TenantIntegrationConfig = require('./tenantIntegrationConfig.model');

// Register Associations for Platform Integrations
PlatformIntegration.hasMany(TenantIntegrationConfig, { foreignKey: 'platform_integration_id', as: 'tenantConfigs', onDelete: 'CASCADE' });
TenantIntegrationConfig.belongsTo(PlatformIntegration, { foreignKey: 'platform_integration_id', as: 'integration' });

Tenant.hasMany(TenantIntegrationConfig, { foreignKey: 'tenant_id', as: 'integrations', onDelete: 'CASCADE' });
TenantIntegrationConfig.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });

// CostRateSnapshot associations
CostRateSnapshot.belongsTo(CourierProvider, { foreignKey: 'courier_provider_id', as: 'provider' });
CourierProvider.hasMany(CostRateSnapshot, { foreignKey: 'courier_provider_id', as: 'costSnapshots' });

CostRateSnapshot.belongsTo(Shipment, { foreignKey: 'shipment_id', as: 'shipment' });
Shipment.hasMany(CostRateSnapshot, { foreignKey: 'shipment_id', as: 'costSnapshots' });

module.exports = {
  sequelize,
  Tenant,
  Role,
  Permission,
  User,
  RefreshToken,
  AuditLog,
  PasswordResetToken,
  PlatformAdmin,
  PlatformRole,
  PlatformPermission,
  PlatformRolePermission,
  PlatformAuditLog,
  ImpersonationSession,
  PlatformRefreshToken,
  PickupAddress,
  CompanyDocument,
  Order,
  OrderItem,
  OrderStatusHistory,
  OrderImport,
  CourierProvider,
  TenantCourierAccess,
  ProviderHealthLog,
  Shipment,
  ShipmentRateQuote,
  ShipmentStatusHistory,
  TrackingEvent,
  WebhookLog,
  NdrEvent,
  NdrAction,
  RtoRecord,
  Wallet,
  WalletTransaction,
  RechargeOrder,
  Invoice,
  InvoiceLineItem,
  CreditNote,
  InvoiceSequence,
  SubscriptionPlan,
  TenantSubscription,
  PlanUsageTracking,
  PlanChangeHistory,
  NotificationTemplate,
  NotificationPreference,
  NotificationLog,
  InAppNotification,
  ApiKey,
  ApiKeyUsageLog,
  TenantWebhook,
  WebhookDelivery,
  AnalyticsDailySnapshot,
  SystemSequence,
  SupportTicket,
  TicketMessage,
  TicketAttachment,
  TenantSetting,
  PlatformSetting,
  SettingsChangeHistory,
  KycDocument,
  WhatsappTemplate,
  CodRemittance,
  WeightDiscrepancyDispute,
  SubUser,
  CarrierMarginConfig,
  PaymentGateway,
  WalletRechargeTransaction,
  PlatformIntegration,
  TenantIntegrationConfig,
  RateCard,
  RateCardUploadLog,
  CostRateSnapshot,
  CourierCostRate,
  MarkupConfig,
  CodMarkupConfig,
  RtoMarkupConfig,
  PincodeMaster,
  AddressLookupAuditLog,
  StorefrontConnection,
  StorefrontSyncLog,
  ShopifyConnection,
  RolePermission,
  WebhookIdempotency,
  Manifest,
  WebsiteVisitorEvent,
  PlatformAdmin,
  WalletAdjustment,
  WhatsappBspConfig,
  SellerPaymentProfile,
  SellerPaymentTermsHistory,
  PostpaidInvoice,
  PostpaidTransaction,
  PostpaidPayment,
  StCourierAwbInventory,
  StCourierDistrictRate,
  StCourierServiceablePincode,
  Coupon,
  CouponUsage,
  BlogPost,
  Banner,
  ShippingAllocationRule,
  ExportJob,
  WebhookEndpoint,
};

// ExportJob & WebhookEndpoint Associations
ExportJob.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
Tenant.hasMany(ExportJob, { foreignKey: 'tenant_id', as: 'exportJobs' });

WebhookEndpoint.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
Tenant.hasMany(WebhookEndpoint, { foreignKey: 'tenant_id', as: 'webhookEndpoints' });

WebhookEndpoint.hasMany(WebhookDelivery, { foreignKey: 'endpoint_id', as: 'deliveries' });
WebhookDelivery.belongsTo(WebhookEndpoint, { foreignKey: 'endpoint_id', as: 'endpoint' });

// ShippingAllocationRule Associations
ShippingAllocationRule.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
ShippingAllocationRule.belongsTo(PickupAddress, { foreignKey: 'pickup_address_id', as: 'pickupAddress' });
Tenant.hasMany(ShippingAllocationRule, { foreignKey: 'tenant_id', as: 'shippingRules' });

// Wallet Coupon Associations
Coupon.hasMany(CouponUsage, { foreignKey: 'coupon_id', as: 'usages' });
CouponUsage.belongsTo(Coupon, { foreignKey: 'coupon_id', as: 'coupon' });
CouponUsage.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
CouponUsage.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
CouponUsage.belongsTo(WalletRechargeTransaction, { foreignKey: 'recharge_id', as: 'rechargeTransaction' });

// ST Courier AWB Inventory Associations
Shipment.hasOne(StCourierAwbInventory, { foreignKey: 'shipment_id', as: 'stCourierAwb' });
StCourierAwbInventory.belongsTo(Shipment, { foreignKey: 'shipment_id', as: 'shipment' });

// MarkupConfig Associations
MarkupConfig.belongsTo(Tenant, { foreignKey: 'seller_id', as: 'seller' });
MarkupConfig.belongsTo(Tenant, { foreignKey: 'booking_office_id', as: 'booking_office' });
MarkupConfig.belongsTo(CourierProvider, { foreignKey: 'courier_provider_id', as: 'courier_provider' });
Tenant.hasMany(MarkupConfig, { foreignKey: 'seller_id', as: 'sellerMarkupConfigs' });
Tenant.hasMany(MarkupConfig, { foreignKey: 'booking_office_id', as: 'bookingOfficeMarkupConfigs' });

// ShopifyConnection Associations
ShopifyConnection.belongsTo(Tenant, { foreignKey: 'tenant_id', as: 'tenant' });
Tenant.hasMany(ShopifyConnection, { foreignKey: 'tenant_id', as: 'shopifyConnections' });

// Install global tenant isolation query hooks
const { attachTenantScopeHooks } = require('../middlewares/tenantScope.middleware');
attachTenantScopeHooks(sequelize);

