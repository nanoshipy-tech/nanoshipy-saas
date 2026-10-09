const { Tenant, User, Wallet, WalletTransaction, WalletAdjustment, SubscriptionPlan, TenantSubscription, Order, Shipment, PlatformAdmin, PickupAddress } = require('../models');
const walletService = require('../services/wallet.service');
const { success, error } = require('../utils/apiResponse');
const { v4: uuidv4 } = require('uuid');
const { logAdminAction } = require('../utils/adminAudit.helper');
const hashUtils = require('../utils/hash');

const updateTenantProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      company_name,
      legal_name,
      legal_business_name,
      support_email,
      company_email,
      support_phone,
      company_phone,
      gstin,
      gst_number,
      pan_number,
      state,
      kam_id,
      brand_name,
      business_type,
      status,
      is_booking_office,
    } = req.body;

    const tenant = await Tenant.findByPk(id);
    if (!tenant) {
      return error(res, { code: 'NOT_FOUND', message: 'Tenant merchant not found' }, 404);
    }

    const updates = {};
    if (company_name !== undefined) updates.company_name = company_name;
    if (legal_name !== undefined) updates.legal_name = legal_name;
    if (legal_business_name !== undefined) updates.legal_business_name = legal_business_name;
    if (support_email !== undefined) updates.support_email = support_email;
    if (company_email !== undefined) updates.company_email = company_email;
    if (support_phone !== undefined) updates.support_phone = support_phone;
    if (company_phone !== undefined) updates.company_phone = company_phone;
    if (gstin !== undefined) updates.gstin = gstin;
    if (gst_number !== undefined) updates.gst_number = gst_number;
    if (pan_number !== undefined) updates.pan_number = pan_number;
    if (state !== undefined) updates.state = state;
    if (kam_id !== undefined) updates.kam_id = kam_id || null;
    if (brand_name !== undefined) updates.brand_name = brand_name;
    if (business_type !== undefined) updates.business_type = business_type;
    if (is_booking_office !== undefined) updates.is_booking_office = Boolean(is_booking_office);
    if (status && ['active', 'suspended', 'pending'].includes(status)) updates.status = status;

    await tenant.update(updates);

    const { owner_name, owner_email, owner_phone } = req.body;
    if (owner_name || owner_email || owner_phone) {
      const owner = await User.findOne({ where: { tenant_id: id } });
      if (owner) {
        const ownerUpdates = {};
        if (owner_name) ownerUpdates.name = owner_name;
        if (owner_email) ownerUpdates.email = owner_email;
        if (owner_phone) ownerUpdates.phone = owner_phone;
        await owner.update(ownerUpdates);
      }
    }

    if (req.platformAdmin) {
      logAdminAction({
        adminId: req.platformAdmin.id,
        action: 'UPDATE_SELLER_PROFILE',
        entityType: 'tenant',
        entityId: tenant.id,
        details: { updates, owner_name, owner_email, owner_phone },
        ipAddress: req.ip,
      }).catch(() => {});
    }

    const refreshed = await Tenant.findByPk(id, {
      include: [
        { model: User, as: 'owner', attributes: ['id', 'name', 'email', 'phone'] },
        { model: Wallet, as: 'wallet', attributes: ['id', 'balance'] },
        { model: PlatformAdmin, as: 'kam', attributes: ['id', 'name', 'email'] },
      ],
    });

    return success(res, refreshed, 200);
  } catch (err) {
    next(err);
  }
};

const listSellers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const { count, rows } = await Tenant.findAndCountAll({
      attributes: [
        'id', 'company_name', 'subdomain', 'status', 'created_at',
        'kyc_status', 'plan_id', 'support_email', 'support_phone', 'gstin',
        'is_booking_office'
      ],
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'name', 'email', 'phone']
        },
        {
          model: Wallet,
          as: 'wallet',
          attributes: ['balance']
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset,
      distinct: true
    });

    const formattedRows = rows.map(t => {
      const tJson = t.toJSON();
      if (tJson.owner) {
        tJson.owner_email = tJson.owner.email;
        tJson.owner_name = tJson.owner.name;
        tJson.owner_phone = tJson.owner.phone;
      }
      return tJson;
    });

    return success(res, {
      rows: formattedRows,
      sellers: formattedRows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (err) {
    next(err);
  }
};

const getTenantDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    const tenant = await Tenant.findByPk(id, {
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'name', 'email', 'phone', 'status', 'created_at', 'last_login_at']
        },
        {
          model: Wallet,
          as: 'wallet',
          attributes: ['id', 'balance', 'held_balance', 'credit_limit', 'low_balance_threshold']
        },
        {
          model: PlatformAdmin,
          as: 'kam',
          attributes: ['id', 'name', 'email', 'role']
        }
      ]
    });

    if (!tenant) {
      return error(res, { code: 'NOT_FOUND', message: 'Tenant merchant not found' }, 404);
    }

    const tenantJson = tenant.toJSON();

    // Get order & shipment counts & warehouses
    const [orderCount, shipmentCount, warehouses] = await Promise.all([
      Order.count({ where: { tenant_id: id } }).catch(() => 0),
      Shipment.count({ where: { tenant_id: id } }).catch(() => 0),
      PickupAddress.findAll({
        where: { tenant_id: id, is_active: true },
        order: [['is_default', 'DESC'], ['created_at', 'ASC']],
      }).catch(() => []),
    ]);

    tenantJson.metrics = {
      total_orders: orderCount,
      total_shipments: shipmentCount,
    };
    tenantJson.warehouses = warehouses;

    // Get active subscription plan if available
    const subscription = await TenantSubscription.findOne({
      where: { tenant_id: id },
      include: [{ model: SubscriptionPlan, as: 'plan' }],
      order: [['created_at', 'DESC']]
    }).catch(() => null);

    tenantJson.subscription = subscription;

    return success(res, tenantJson);
  } catch (err) {
    next(err);
  }
};

const updateTenantStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, company_name, support_email, support_phone, business_type } = req.body;

    const tenant = await Tenant.findByPk(id);
    if (!tenant) {
      return error(res, { code: 'NOT_FOUND', message: 'Tenant not found' }, 404);
    }

    const updates = {};
    if (status && ['active', 'suspended', 'pending'].includes(status)) {
      updates.status = status;
    }
    if (company_name) updates.company_name = company_name;
    if (support_email) updates.support_email = support_email;
    if (support_phone) updates.support_phone = support_phone;
    if (business_type) updates.business_type = business_type;

    await tenant.update(updates);

    return success(res, {
      message: 'Tenant status updated successfully',
      tenant
    });
  } catch (err) {
    next(err);
  }
};

const updateTenantKyc = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { kyc_status, rejection_reason } = req.body;

    const tenant = await Tenant.findByPk(id);
    if (!tenant) {
      return error(res, { code: 'NOT_FOUND', message: 'Tenant not found' }, 404);
    }

    if (!['approved', 'pending', 'rejected', 'not_started', 'in_review'].includes(kyc_status)) {
      return error(res, { code: 'INVALID_INPUT', message: 'Invalid KYC status' }, 400);
    }

    const updates = {
      kyc_status,
      kyc_rejection_reason: kyc_status === 'rejected' ? (rejection_reason || 'Rejected by Administrator') : null,
      kyc_approved_at: kyc_status === 'approved' ? new Date() : null,
    };

    await tenant.update(updates);

    return success(res, {
      message: `Tenant KYC status updated to ${kyc_status}`,
      tenant
    });
  } catch (err) {
    next(err);
  }
};

const adjustWallet = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, reason, type, idempotency_key } = req.body;
    const idempotencyKey = idempotency_key || req.headers['idempotency-key'] || null;

    const numAmount = Math.abs(parseFloat(amount));
    if (isNaN(numAmount) || numAmount <= 0) {
      return error(res, { code: 'INVALID_INPUT', message: 'Valid positive amount is required' }, 400);
    }

    const tenant = await Tenant.findByPk(id);
    if (!tenant) {
      return error(res, { code: 'NOT_FOUND', message: 'Tenant not found' }, 404);
    }

    // Strict Idempotency check via WalletAdjustment model
    if (idempotencyKey) {
      const existingAdjustment = await WalletAdjustment.findOne({
        where: { tenant_id: id, idempotency_key: idempotencyKey },
      });
      if (existingAdjustment) {
        return success(res, {
          message: `Wallet ${existingAdjustment.type === 'debit' ? 'debited' : 'credited'} successfully (idempotent replay)`,
          new_balance: existingAdjustment.new_balance,
          adjustment_id: existingAdjustment.id,
        });
      }
    }

    const isDebit = (type === 'debit') || (parseFloat(amount) < 0);
    const adminId = req.platformAdmin?.id || req.user?.id || null;
    const referenceId = uuidv4();

    let newBalance;
    if (isDebit) {
      newBalance = await walletService.debit(
        id,
        numAmount,
        'manual_adjustment',
        referenceId,
        reason || 'Manual debit adjustment by admin',
        adminId
      );
    } else {
      newBalance = await walletService.credit(
        id,
        numAmount,
        'manual_adjustment',
        referenceId,
        reason || 'Manual credit adjustment by admin',
        adminId
      );
    }

    const finalBalance = typeof newBalance === 'object' ? newBalance.balance : newBalance;

    // Create persistent WalletAdjustment audit record
    const adjustment = await WalletAdjustment.create({
      tenant_id: id,
      admin_id: adminId,
      type: isDebit ? 'debit' : 'credit',
      amount: numAmount,
      reason: reason || `Manual ${isDebit ? 'debit' : 'credit'} adjustment by admin`,
      idempotency_key: idempotencyKey || null,
      reference_id: referenceId,
      new_balance: finalBalance,
    });

    // Record platform audit log
    await logAdminAction({
      adminId: adminId || '00000000-0000-0000-0000-000000000000',
      action: isDebit ? 'wallet_debit_adjustment' : 'wallet_credit_adjustment',
      targetTenantId: id,
      entityType: 'wallet_adjustment',
      entityId: adjustment.id,
      metadata: {
        amount: numAmount,
        type: isDebit ? 'debit' : 'credit',
        reason: reason || null,
        reference_id: referenceId,
        new_balance: finalBalance,
      },
      ipAddress: req.ip,
    });

    return success(res, {
      message: `Wallet ${isDebit ? 'debited' : 'credited'} successfully`,
      new_balance: finalBalance,
      adjustment_id: adjustment.id,
    });
  } catch (err) {
    if (err.message && (err.message.includes('Insufficient') || err.message.includes('insufficient'))) {
      return error(res, { code: 'BAD_REQUEST', message: 'Insufficient wallet balance for this debit adjustment.' }, 400);
    }
    next(err);
  }
};

const SellerPaymentService = require('../services/sellerPayment.service');
const PostpaidBillingService = require('../services/postpaidBilling.service');

const getPaymentTerms = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenant = await Tenant.findByPk(id);
    if (!tenant) return error(res, { code: 'NOT_FOUND', message: 'Seller not found' }, 404);

    const [profile, summary, history] = await Promise.all([
      SellerPaymentService.getPaymentProfile(id),
      PostpaidBillingService.getSellerBillingSummary(id),
      PostpaidBillingService.getTermsHistory(id),
    ]);

    return success(res, {
      profile,
      summary,
      history,
    });
  } catch (err) {
    next(err);
  }
};

const updatePaymentTerms = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { payment_mode, credit_limit, billing_cycle, payment_terms_days, status, reason } = req.body;
    const adminId = req.platformAdmin?.id || req.user?.id || null;

    const tenant = await Tenant.findByPk(id);
    if (!tenant) return error(res, { code: 'NOT_FOUND', message: 'Seller not found' }, 404);

    const profile = await SellerPaymentService.updatePaymentTerms({
      tenantId: id,
      paymentMode: payment_mode,
      creditLimit: credit_limit !== undefined ? parseFloat(credit_limit) : undefined,
      billingCycle: billing_cycle,
      paymentTermsDays: payment_terms_days !== undefined ? parseInt(payment_terms_days, 10) : undefined,
      status,
      reason,
      adminId,
    });

    await logAdminAction({
      adminId: adminId || '00000000-0000-0000-0000-000000000000',
      action: 'update_seller_payment_terms',
      targetTenantId: id,
      entityType: 'seller_payment_profile',
      entityId: profile.id,
      metadata: { payment_mode, credit_limit, billing_cycle, payment_terms_days, status, reason },
      ipAddress: req.ip,
    });

    return success(res, {
      message: 'Seller payment terms updated successfully',
      profile,
    });
  } catch (err) {
    next(err);
  }
};

const getPostpaidSummary = async (req, res, next) => {
  try {
    const { id } = req.params;
    const summary = await PostpaidBillingService.getSellerBillingSummary(id);
    return success(res, summary);
  } catch (err) {
    next(err);
  }
};

const listPostpaidInvoices = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await PostpaidBillingService.listInvoices({
      tenantId: id,
      status: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
    });
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

const listPostpaidLedger = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await PostpaidBillingService.listLedger({
      tenantId: id,
      page: req.query.page,
      limit: req.query.limit,
    });
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

const recordPostpaidPayment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { invoice_id, amount, payment_method, payment_reference, notes } = req.body;
    const adminId = req.platformAdmin?.id || req.user?.id || null;

    const result = await PostpaidBillingService.recordPayment({
      tenantId: id,
      invoiceId: invoice_id,
      amount,
      paymentMethod: payment_method,
      paymentReference: payment_reference,
      notes,
      adminId,
    });

    await logAdminAction({
      adminId: adminId || '00000000-0000-0000-0000-000000000000',
      action: 'record_postpaid_payment',
      targetTenantId: id,
      entityType: 'postpaid_payment',
      entityId: result.payment.id,
      metadata: { amount, payment_method, payment_reference, invoice_id },
      ipAddress: req.ip,
    });

    return success(res, {
      message: 'Postpaid payment recorded successfully',
      payment: result.payment,
      invoice: result.invoice,
    });
  } catch (err) {
    next(err);
  }
};

const updateSellerPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;

    if (!new_password || String(new_password).trim().length < 6) {
      return error(res, { code: 'INVALID_PASSWORD', message: 'Password must be at least 6 characters long' }, 400);
    }

    const owner = await User.findOne({ where: { tenant_id: id } });
    if (!owner) {
      return error(res, { code: 'NOT_FOUND', message: 'Seller owner account not found' }, 404);
    }

    const password_hash = await hashUtils.hashPassword(new_password.trim());
    const nextTokenVersion = (owner.token_version || 1) + 1;

    await owner.update({
      password_hash,
      token_version: nextTokenVersion,
    });

    if (req.platformAdmin) {
      logAdminAction({
        adminId: req.platformAdmin.id,
        action: 'UPDATE_SELLER_PASSWORD',
        entityType: 'tenant',
        entityId: id,
        details: { owner_email: owner.email },
        ipAddress: req.ip,
      }).catch(() => {});
    }

    return success(res, {
      message: 'Seller password updated successfully',
    }, 200);
  } catch (err) {
    next(err);
  }
};

const getSellerWarehouses = async (req, res, next) => {
  try {
    const { id } = req.params;
    const warehouses = await PickupAddress.findAll({
      where: { tenant_id: id, is_active: true },
      order: [['is_default', 'DESC'], ['created_at', 'ASC']],
    });
    return success(res, warehouses, 200);
  } catch (err) {
    next(err);
  }
};

const createSellerWarehouse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pickupAddressService = require('../services/pickupAddress.service');
    const created = await pickupAddressService.createAddress(id, req.body);
    return success(res, created, 201);
  } catch (err) {
    next(err);
  }
};

const updateSellerWarehouse = async (req, res, next) => {
  try {
    const { id, addressId } = req.params;
    const pickupAddressService = require('../services/pickupAddress.service');
    const updated = await pickupAddressService.updateAddress(id, addressId, req.body);
    return success(res, updated, 200);
  } catch (err) {
    next(err);
  }
};

const deleteSellerWarehouse = async (req, res, next) => {
  try {
    const { id, addressId } = req.params;
    const pickupAddressService = require('../services/pickupAddress.service');
    await pickupAddressService.deleteAddress(id, addressId);
    return success(res, { message: 'Warehouse address deleted successfully' }, 200);
  } catch (err) {
    next(err);
  }
};

/**
 * Pre-flight risk assessment and record counts before seller deletion
 */
const getPreDeleteCheck = async (req, res, next) => {
  try {
    const { id } = req.params;
    const sellerBackupService = require('../services/sellerBackup.service');
    const stats = await sellerBackupService.getPreDeleteStats(id);
    return success(res, stats, 200);
  } catch (err) {
    next(err);
  }
};

/**
 * Delete or archive seller account with automatic local disk backup
 */
const deleteSellerAccount = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { mode = 'purge', reason = 'Seller account deleted by platform admin' } = req.body;
    const sellerBackupService = require('../services/sellerBackup.service');

    const adminUser = req.platformAdmin || {
      id: req.user?.id || 'admin-root',
      email: req.user?.email || 'admin@nanoshipy.com',
      name: req.user?.name || 'Platform Admin',
    };

    const result = mode === 'archive'
      ? await sellerBackupService.archiveSeller(id, adminUser, reason)
      : await sellerBackupService.purgeSeller(id, adminUser, reason);

    return success(res, {
      message: result.message,
      mode: result.mode,
      backup: result.backup,
      backup_base64: result.buffer ? result.buffer.toString('base64') : null,
    }, 200);
  } catch (err) {
    next(err);
  }
};

/**
 * Download existing backup file from server local storage
 */
const downloadSellerBackup = async (req, res, next) => {
  try {
    const { filename } = req.query;
    if (!filename) {
      return res.status(400).json({ success: false, error: 'Backup filename is required' });
    }
    const sellerBackupService = require('../services/sellerBackup.service');
    const fileData = sellerBackupService.getBackupFile(filename);

    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileData.filename}"`);
    return res.send(fileData.buffer);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listSellers,
  getTenantDetails,
  updateTenantProfile,
  updateTenantStatus,
  updateTenantKyc,
  updateSellerPassword,
  getSellerWarehouses,
  createSellerWarehouse,
  updateSellerWarehouse,
  deleteSellerWarehouse,
  adjustWallet,
  getPaymentTerms,
  updatePaymentTerms,
  getPostpaidSummary,
  listPostpaidInvoices,
  listPostpaidLedger,
  recordPostpaidPayment,
  getPreDeleteCheck,
  deleteSellerAccount,
  downloadSellerBackup,
};

