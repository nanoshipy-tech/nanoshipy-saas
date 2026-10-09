'use strict';

const crypto = require('crypto');
const paymentWebhookController = require('../../src/controllers/paymentWebhook.controller');
const { PaymentGateway, WalletRechargeTransaction, Wallet, WalletTransaction } = require('../../src/models');

describe('Payment Webhook Idempotency & Security Verification Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 Bad Request and NOT credit wallet when x-razorpay-signature is missing', async () => {
    const req = {
      params: { provider: 'razorpay' },
      headers: {}, // NO signature header
      body: {
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_unverified_1', order_id: 'order_test_1' } } },
      },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    jest.spyOn(PaymentGateway, 'findOne').mockResolvedValue({
      name: 'razorpay',
      webhook_secret: 'dummy_secret',
    });

    const txSpy = jest.spyOn(WalletRechargeTransaction.sequelize, 'transaction');

    await paymentWebhookController.handlePaymentWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.stringMatching(/invalid or missing webhook signature/i),
    }));
    // Must NOT credit or open wallet transaction
    expect(txSpy).not.toHaveBeenCalled();
  });

  it('should return 400 Bad Request when x-razorpay-signature is invalid/tampered', async () => {
    const req = {
      params: { provider: 'razorpay' },
      headers: { 'x-razorpay-signature': 'tampered_invalid_hex_signature' },
      body: {
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_unverified_2', order_id: 'order_test_2' } } },
      },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    jest.spyOn(PaymentGateway, 'findOne').mockResolvedValue({
      name: 'razorpay',
      webhook_secret: 'dummy_secret',
    });

    const txSpy = jest.spyOn(WalletRechargeTransaction.sequelize, 'transaction');

    await paymentWebhookController.handlePaymentWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: 'Invalid webhook signature',
    }));
    expect(txSpy).not.toHaveBeenCalled();
  });

  it('should return 400 Bad Request and fail closed for unverified gateways', async () => {
    const req = {
      params: { provider: 'phonepe' },
      headers: {},
      body: { order_id: 'order_123', payment_id: 'pay_123' },
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    jest.spyOn(PaymentGateway, 'findOne').mockResolvedValue({
      name: 'phonepe',
      webhook_secret: 'dummy_secret',
    });

    await paymentWebhookController.handlePaymentWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.stringMatching(/fail-closed/i),
    }));
  });

  it('should prevent duplicate processing if WalletTransaction already exists with same payment id', async () => {
    const secret = 'dummy_secret';
    const body = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_duplicate_12345',
            order_id: 'order_test_99999',
          },
        },
      },
    };
    const validSignature = crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');

    const req = {
      params: { provider: 'razorpay' },
      headers: { 'x-razorpay-signature': validSignature },
      body,
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    jest.spyOn(PaymentGateway, 'findOne').mockResolvedValue({
      name: 'razorpay',
      webhook_secret: secret,
    });

    jest.spyOn(WalletTransaction, 'findOne').mockResolvedValue({
      id: 'tx_already_processed',
      gateway_payment_id: 'pay_duplicate_12345',
    });

    const txSpy = jest.spyOn(WalletRechargeTransaction.sequelize, 'transaction');

    await paymentWebhookController.handlePaymentWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Webhook processed successfully',
    });
    // DB transaction should not even have been opened because idempotency guard intercepted it
    expect(txSpy).not.toHaveBeenCalled();
  });

  it('should prevent double credit when status is already success on WalletRechargeTransaction', async () => {
    const secret = 'dummy_secret';
    const body = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_new_54321',
            order_id: 'order_test_88888',
          },
        },
      },
    };
    const validSignature = crypto.createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');

    const req = {
      params: { provider: 'razorpay' },
      headers: { 'x-razorpay-signature': validSignature },
      body,
    };

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    jest.spyOn(PaymentGateway, 'findOne').mockResolvedValue({
      name: 'razorpay',
      webhook_secret: secret,
    });

    jest.spyOn(WalletTransaction, 'findOne').mockResolvedValue(null);

    const mockRollback = jest.fn().mockResolvedValue(true);
    const mockCommit = jest.fn().mockResolvedValue(true);
    jest.spyOn(WalletRechargeTransaction.sequelize, 'transaction').mockResolvedValue({
      rollback: mockRollback,
      commit: mockCommit,
    });

    jest.spyOn(WalletRechargeTransaction, 'findOne').mockResolvedValue({
      id: 'recharge-1',
      status: 'success', // Already credited
    });

    const walletUpdateSpy = jest.spyOn(Wallet, 'findOne');

    await paymentWebhookController.handlePaymentWebhook(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockRollback).toHaveBeenCalled();
    expect(walletUpdateSpy).not.toHaveBeenCalled();
  });
});
