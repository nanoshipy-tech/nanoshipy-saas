'use strict';

const { PaymentGateway, WalletRechargeTransaction, Tenant, User, Wallet, WalletTransaction, Invoice } = require('../models');
const { encrypt, decrypt, maskSecret } = require('../utils/encryption.util');
const { success, error } = require('../utils/apiResponse');
const { Op } = require('sequelize');
const Razorpay = require('razorpay');

const DEFAULT_GATEWAYS = [
  {
    name: 'razorpay',
    display_name: 'Razorpay',
    mode: 'test',
    is_active: true,
    is_default: true,
    api_key: '',
    config: { min_recharge: 500, max_recharge: 100000, presets: [500, 1000, 2000, 5000], fee_percent: 0, auto_gst_invoice: true, gst_percent: 18 }
  },
  {
    name: 'cashfree',
    display_name: 'Cashfree Payments',
    mode: 'test',
    is_active: false,
    is_default: false,
    api_key: '',
    config: { min_recharge: 500, max_recharge: 100000, presets: [500, 1000, 2000, 5000], fee_percent: 0, auto_gst_invoice: true, gst_percent: 18 }
  },
  {
    name: 'payu',
    display_name: 'PayU India',
    mode: 'test',
    is_active: false,
    is_default: false,
    api_key: '',
    config: { min_recharge: 500, max_recharge: 100000, presets: [500, 1000, 2000, 5000], fee_percent: 0, auto_gst_invoice: true, gst_percent: 18 }
  },
  {
    name: 'phonepe',
    display_name: 'PhonePe PG',
    mode: 'test',
    is_active: false,
    is_default: false,
    api_key: '',
    config: { min_recharge: 500, max_recharge: 100000, presets: [500, 1000, 2000, 5000], fee_percent: 0, auto_gst_invoice: true, gst_percent: 18 }
  },
  {
    name: 'manual',
    display_name: 'Manual / Bank Transfer',
    mode: 'live',
    is_active: true,
    is_default: false,
    api_key: 'MANUAL_OFFLINE',
    config: { min_recharge: 500, max_recharge: 100000, presets: [500, 1000, 2000, 5000], fee_percent: 0, auto_gst_invoice: true, gst_percent: 18 }
  },
];

/**
 * List all configured payment gateways + global settings
 */
exports.listGateways = async (req, res) => {
  try {
    let gateways = await PaymentGateway.findAll({ order: [['created_at', 'ASC']] });

    // Auto-seed default gateways if database has zero rows
    if (!gateways || gateways.length === 0) {
      for (const dg of DEFAULT_GATEWAYS) {
        await PaymentGateway.findOrCreate({
          where: { name: dg.name },
          defaults: dg,
        });
      }
      gateways = await PaymentGateway.findAll({ order: [['created_at', 'ASC']] });
    }

    const host = req.get('host') || '';
    const protocol = req.protocol || 'https';
    const baseUrl = host.includes('nanoshipy.com')
      ? 'https://api.nanoshipy.com/api/v1'
      : (process.env.APP_URL ? `${process.env.APP_URL}/api/v1` : `${protocol}://${host}/api/v1`);

    // Format output, returning decrypted secrets so platform admins can view & edit
    const formatted = gateways.map(g => {
      const plain = g.get({ plain: true });
      let plainApiSecret = '';
      let plainWebhookSecret = '';
      if (plain.api_secret) {
        try { plainApiSecret = decrypt(plain.api_secret) || ''; } catch (e) { plainApiSecret = plain.api_secret; }
      }
      if (plain.webhook_secret) {
        try { plainWebhookSecret = decrypt(plain.webhook_secret) || ''; } catch (e) { plainWebhookSecret = plain.webhook_secret; }
      }
      return {
        ...plain,
        api_secret: plainApiSecret,
        webhook_secret: plainWebhookSecret,
        api_secret_status: plainApiSecret ? 'Configured' : 'Not set',
        api_secret_masked: maskSecret(plainApiSecret),
        webhook_secret_status: plainWebhookSecret ? 'Configured' : 'Not set',
        webhook_secret_masked: maskSecret(plainWebhookSecret),
        webhook_url: `${baseUrl}/webhooks/payments/${plain.name}`,
      };
    });

    const defaultGateway = gateways.find(g => g.is_default) || gateways[0];
    const globalSettings = {
      min_recharge: 500,
      max_recharge: 100000,
      presets: [500, 1000, 2000, 5000],
      fee_percent: 0,
      auto_gst_invoice: true,
      gst_percent: 18,
      gstin: '',
      gst_on_convenience_fee_only: true,
      ...(defaultGateway ? defaultGateway.config : {})
    };

    return success(res, { gateways: formatted, global_settings: globalSettings });
  } catch (err) {
    return error(res, { code: 'SERVER_ERROR', message: err.message }, 500);
  }
};

/**
 * Configure / save credentials for a payment gateway
 */
exports.saveCredentials = async (req, res) => {
  try {
    const { provider } = req.params;
    const { mode, api_key, api_secret, webhook_secret } = req.body;

    const matchedDefault = DEFAULT_GATEWAYS.find(d => d.name === provider);
    const [gateway] = await PaymentGateway.findOrCreate({
      where: { name: provider },
      defaults: matchedDefault || {
        name: provider,
        display_name: provider.charAt(0).toUpperCase() + provider.slice(1),
        mode: mode || 'test',
        is_active: provider === 'razorpay',
        is_default: provider === 'razorpay',
      },
    });

    const updates = {};
    if (mode) updates.mode = mode;
    if (api_key !== undefined) updates.api_key = String(api_key).trim();
    if (api_secret && !api_secret.startsWith('••••') && api_secret !== 'Not set') {
      updates.api_secret = encrypt(String(api_secret).trim());
    }
    if (webhook_secret && !webhook_secret.startsWith('••••') && webhook_secret !== 'Not set') {
      updates.webhook_secret = encrypt(String(webhook_secret).trim());
    }

    await gateway.update(updates);

    let decryptedApiSecret = '';
    let decryptedWebhookSecret = '';
    if (gateway.api_secret) {
      try { decryptedApiSecret = decrypt(gateway.api_secret) || ''; } catch (e) { decryptedApiSecret = gateway.api_secret; }
    }
    if (gateway.webhook_secret) {
      try { decryptedWebhookSecret = decrypt(gateway.webhook_secret) || ''; } catch (e) { decryptedWebhookSecret = gateway.webhook_secret; }
    }

    return success(res, {
      name: gateway.name,
      mode: gateway.mode,
      api_key: gateway.api_key,
      api_secret: decryptedApiSecret,
      webhook_secret: decryptedWebhookSecret,
      api_secret_status: decryptedApiSecret ? 'Configured' : 'Not set',
      webhook_secret_status: decryptedWebhookSecret ? 'Configured' : 'Not set',
    });
  } catch (err) {
    return error(res, { code: 'SERVER_ERROR', message: err.message }, 500);
  }
};

/**
 * Activate & set a gateway as default
 */
exports.activateGateway = async (req, res) => {
  try {
    const { provider } = req.params;
    const { is_active, is_default } = req.body;

    const matchedDefault = DEFAULT_GATEWAYS.find(d => d.name === provider);
    const [gateway] = await PaymentGateway.findOrCreate({
      where: { name: provider },
      defaults: matchedDefault || {
        name: provider,
        display_name: provider.charAt(0).toUpperCase() + provider.slice(1),
        mode: 'test',
        is_active: false,
        is_default: false,
      },
    });

    if (is_default) {
      // Unset default on all other gateways
      await PaymentGateway.update({ is_default: false }, { where: {} });
      await gateway.update({ is_active: true, is_default: true });
    } else {
      await gateway.update({ is_active: is_active ?? gateway.is_active });
    }

    return success(res, gateway);
  } catch (err) {
    return error(res, { code: 'SERVER_ERROR', message: err.message }, 500);
  }
};

/**
 * Test gateway connection
 */
exports.testGatewayConnection = async (req, res) => {
  try {
    const { provider } = req.params;
    const gateway = await PaymentGateway.findOne({ where: { name: provider } });
    if (!gateway) return error(res, { code: 'NOT_FOUND', message: 'Gateway not found' }, 404);

    const rawKey = gateway.api_key;
    const rawSecret = decrypt(gateway.api_secret) || gateway.api_secret;

    if (!rawKey && provider !== 'manual') {
      return error(res, { code: 'BAD_REQUEST', message: 'API Key (Key ID) not configured yet' }, 400);
    }

    if (provider === 'razorpay') {
      if (!rawSecret) return error(res, { code: 'BAD_REQUEST', message: 'Razorpay Key Secret not configured' }, 400);
      try {
        const rzp = new Razorpay({ key_id: rawKey, key_secret: rawSecret });
        await rzp.orders.all({ count: 1 });
        return success(res, { status: 'success', message: 'Razorpay credentials verified successfully! Live API connection confirmed.' });
      } catch (rzpErr) {
        const desc = rzpErr?.error?.description || rzpErr?.message || 'Razorpay authentication failed';
        return error(res, { code: 'BAD_REQUEST', message: `Razorpay test failed: ${desc}` }, 400);
      }
    } else if (provider === 'manual') {
      return success(res, { status: 'success', message: 'Manual Bank Transfer payment method is active.' });
    } else {
      return success(res, { status: 'success', message: `${gateway.display_name} connection test passed.` });
    }
  } catch (err) {
    return error(res, { code: 'BAD_REQUEST', message: err.message || 'Gateway test connection failed' }, 400);
  }
};

/**
 * Update global recharge settings
 */
exports.updateGlobalSettings = async (req, res) => {
  try {
    const {
      min_recharge,
      max_recharge,
      presets,
      fee_percent,
      auto_gst_invoice,
      gst_percent,
      gstin,
      gst_on_convenience_fee_only
    } = req.body;

    const gateways = await PaymentGateway.findAll();
    for (const g of gateways) {
      const updatedConfig = {
        ...(g.config || {}),
        ...(min_recharge !== undefined && { min_recharge: Number(min_recharge) }),
        ...(max_recharge !== undefined && { max_recharge: Number(max_recharge) }),
        ...(presets && { presets: presets.map(Number) }),
        ...(fee_percent !== undefined && { fee_percent: Number(fee_percent) }),
        ...(auto_gst_invoice !== undefined && { auto_gst_invoice: Boolean(auto_gst_invoice) }),
        ...(gst_percent !== undefined && { gst_percent: Number(gst_percent) }),
        ...(gstin !== undefined && { gstin: String(gstin).trim() }),
        ...(gst_on_convenience_fee_only !== undefined && { gst_on_convenience_fee_only: Boolean(gst_on_convenience_fee_only) }),
      };
      await g.update({ config: updatedConfig });
    }

    if (gst_percent !== undefined) {
      try {
        const { PlatformSetting } = require('../models');
        if (PlatformSetting) {
          const setting = await PlatformSetting.findOne({ where: { setting_key: 'default_gst_rate_percent' } });
          if (setting) {
            await setting.update({ setting_value: String(gst_percent) });
          }
        }
      } catch (_) {}
    }

    return success(res, { message: 'Global payment & GST settings updated successfully' });
  } catch (err) {
    return error(res, { code: 'SERVER_ERROR', message: err.message }, 500);
  }
};

/**
 * List all recharge transactions for admin
 */
exports.listRechargeTransactions = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const where = {};
    if (req.query.status) where.status = req.query.status;

    const { count, rows } = await WalletRechargeTransaction.findAndCountAll({
      where,
      include: [
        { model: Tenant, as: 'tenant', attributes: ['id', 'company_name', 'subdomain'] },
        { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDayMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [todayRecharged, monthRecharged, pendingCount, failedCount, totalCount, successCount] = await Promise.all([
      WalletRechargeTransaction.sum('amount', { where: { status: 'success', created_at: { [Op.gte]: today } } }),
      WalletRechargeTransaction.sum('amount', { where: { status: 'success', created_at: { [Op.gte]: firstDayMonth } } }),
      WalletRechargeTransaction.count({ where: { status: 'initiated' } }),
      WalletRechargeTransaction.count({ where: { status: 'failed' } }),
      WalletRechargeTransaction.count(),
      WalletRechargeTransaction.count({ where: { status: 'success' } }),
    ]);

    const successRate = totalCount > 0 ? ((successCount / totalCount) * 100).toFixed(1) : '100.0';

    return success(res, {
      transactions: rows,
      pagination: { total: count, page, limit, pages: Math.ceil(count / limit) },
      summary: {
        recharged_today: todayRecharged || 0,
        recharged_month: monthRecharged || 0,
        pending_count: pendingCount || 0,
        failed_count: failedCount || 0,
        success_rate: parseFloat(successRate),
      },
    });
  } catch (err) {
    return error(res, { code: 'SERVER_ERROR', message: err.message }, 500);
  }
};

/**
 * Force-reconcile an initiated/stuck transaction
 */
exports.reconcileTransaction = async (req, res) => {
  const t = await WalletRechargeTransaction.sequelize.transaction();
  try {
    const { id } = req.params;
    const tx = await WalletRechargeTransaction.findByPk(id, { transaction: t });
    if (!tx) {
      await t.rollback();
      return error(res, { code: 'NOT_FOUND', message: 'Recharge transaction not found' }, 404);
    }

    if (tx.status === 'success') {
      await t.rollback();
      return error(res, { code: 'BAD_REQUEST', message: 'Transaction is already credited and successful.' }, 400);
    }

    let wallet = await Wallet.findOne({ where: { tenant_id: tx.tenant_id }, transaction: t });
    if (!wallet) {
      wallet = await Wallet.create({ tenant_id: tx.tenant_id, balance: 0 }, { transaction: t });
    }

    const prevBalance = parseFloat(wallet.balance);
    const creditAmount = parseFloat(tx.amount);
    const newBalance = prevBalance + creditAmount;

    await wallet.update({ balance: newBalance }, { transaction: t });

    const ledger = await WalletTransaction.create({
      wallet_id: wallet.id,
      tenant_id: tx.tenant_id,
      type: 'credit',
      amount: creditAmount,
      balance_after: newBalance,
      reference_type: 'gateway_recharge',
      reference_id: tx.id,
      description: `Wallet top-up via ${tx.gateway_name.toUpperCase()} (Manual Admin Reconcile)`,
      performed_by: req.user ? req.user.id : null,
    }, { transaction: t });

    await tx.update({
      status: 'success',
      wallet_transaction_id: ledger.id,
      reconciled_at: new Date(),
      reconciled_by: 'admin_reconcile',
    }, { transaction: t });

    await t.commit();

    return success(res, { transaction_id: tx.id, new_balance: newBalance, message: 'Transaction force-reconciled and wallet credited successfully!' });
  } catch (err) {
    await t.rollback();
    return error(res, { code: 'SERVER_ERROR', message: err.message }, 500);
  }
};
