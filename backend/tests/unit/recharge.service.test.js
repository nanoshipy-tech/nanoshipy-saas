'use strict';

jest.mock('../../src/config/db.config', () => {
  const mockTransactionObj = {
    commit: jest.fn().mockResolvedValue(true),
    rollback: jest.fn().mockResolvedValue(true),
    LOCK: {
      UPDATE: 'UPDATE',
    },
  };
  return {
    transaction: jest.fn(async (cb) => {
      if (cb) return cb(mockTransactionObj);
      return mockTransactionObj;
    }),
    sequelize: {
      fn: jest.fn(),
      col: jest.fn(),
    },
  };
});

jest.mock('../../src/models', () => {
  const mockWalletFindOne = jest.fn();
  const mockWalletFindByPk = jest.fn();
  const mockWalletUpdate = jest.fn();

  const mockWalletTransactionCreate = jest.fn();

  const mockRechargeOrderCreate = jest.fn();
  const mockRechargeOrderFindOne = jest.fn();
  const mockRechargeOrderFindByPk = jest.fn();
  const mockRechargeOrderUpdate = jest.fn();

  const mockUserFindByPk = jest.fn();

  return {
    sequelize: {
      transaction: jest.fn(async (cb) => {
        const mockTx = {
          commit: jest.fn(),
          rollback: jest.fn(),
          LOCK: { UPDATE: 'UPDATE' },
        };
        return cb(mockTx);
      }),
    },
    Wallet: {
      findOne: mockWalletFindOne,
      findByPk: mockWalletFindByPk,
      update: mockWalletUpdate,
    },
    WalletTransaction: {
      create: mockWalletTransactionCreate,
    },
    RechargeOrder: {
      create: mockRechargeOrderCreate,
      findOne: mockRechargeOrderFindOne,
      findByPk: mockRechargeOrderFindByPk,
      update: mockRechargeOrderUpdate,
    },
    User: {
      findByPk: mockUserFindByPk,
    },
  };
});

const rechargeService = require('../../src/services/recharge.service');
const { Wallet, RechargeOrder, User } = require('../../src/models');
const paymentGateway = require('../../src/services/paymentGateway.service');
const walletService = require('../../src/services/wallet.service');
const emailService = require('../../src/services/email.service');

jest.mock('../../src/services/paymentGateway.service', () => {
  const mockAdapter = {
    createOrder: jest.fn().mockResolvedValue({
      gatewayOrderId: 'rzp_order_abc',
      amount: 1000.00,
      currency: 'INR',
    }),
    verifyPaymentSignature: jest.fn().mockResolvedValue(true),
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
  };
  return {
    getAdapter: jest.fn().mockReturnValue(mockAdapter),
  };
});

jest.mock('../../src/services/wallet.service', () => ({
  credit: jest.fn().mockResolvedValue(1500.00),
}));

jest.mock('../../src/services/email.service', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/services/audit.service', () => ({
  log: jest.fn().mockResolvedValue(true),
}));

describe('RechargeService - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateRecharge', () => {
    it('should successfully create local recharge record and initiate gateway order', async () => {
      const mockWallet = { id: 'wallet-123' };
      Wallet.findOne.mockResolvedValue(mockWallet);

      const mockOrder = {
        id: 'order-123',
        amount: 1000.00,
        update: jest.fn().mockResolvedValue(true),
      };
      RechargeOrder.create.mockResolvedValue(mockOrder);

      const res = await rechargeService.initiateRecharge('tenant-123', 'user-123', 1000.00);

      expect(Wallet.findOne).toHaveBeenCalledWith({ where: { tenant_id: 'tenant-123' } });
      expect(RechargeOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: 'tenant-123',
          wallet_id: 'wallet-123',
          amount: 1000.00,
          status: 'created',
        })
      );
      expect(mockOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ gateway_order_id: 'rzp_order_abc', status: 'pending' })
      );
      expect(res.gateway_order_id).toBe('rzp_order_abc');
    });
  });

  describe('verifyRechargePayment', () => {
    it('should verify payment signature, credit wallet balance, and update status to success', async () => {
      const mockOrder = {
        id: 'order-123',
        tenant_id: 'tenant-123',
        wallet_id: 'wallet-123',
        amount: 1000.00,
        gateway: 'razorpay',
        gateway_order_id: 'rzp_order_abc',
        status: 'pending',
        initiated_by: 'user-123',
        update: jest.fn().mockResolvedValue(true),
      };

      RechargeOrder.findOne.mockResolvedValue(mockOrder);
      RechargeOrder.findByPk.mockResolvedValue(mockOrder);

      const mockUser = { id: 'user-123', email: 'test@example.com', name: 'John Doe' };
      User.findByPk.mockResolvedValue(mockUser);

      const result = await rechargeService.verifyRechargePayment(
        'tenant-123',
        'user-123',
        'order-123',
        'pay_123',
        'sig_123'
      );

      expect(RechargeOrder.findOne).toHaveBeenCalledWith({
        where: { id: 'order-123', tenant_id: 'tenant-123' },
      });
      expect(walletService.credit).toHaveBeenCalledWith(
        'tenant-123',
        1000.00,
        'recharge',
        'order-123',
        'Recharge success - Gateway Ref #pay_123',
        'user-123',
        expect.any(Object)
      );
      expect(mockOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          gateway_payment_id: 'pay_123',
          status: 'success',
        }),
        expect.any(Object)
      );
      expect(emailService.sendEmail).toHaveBeenCalled();
      expect(result.status).toBe('success');
      expect(result.new_balance).toBe(1500.00);
    });

    it('should be idempotent and skip double verification if order is already completed', async () => {
      const mockOrder = {
        id: 'order-123',
        wallet_id: 'wallet-123',
        status: 'success',
      };

      const mockWallet = { id: 'wallet-123', balance: 2500.00 };

      RechargeOrder.findOne.mockResolvedValue(mockOrder);
      Wallet.findByPk.mockResolvedValue(mockWallet);

      const result = await rechargeService.verifyRechargePayment(
        'tenant-123',
        'user-123',
        'order-123',
        'pay_123',
        'sig_123'
      );

      expect(walletService.credit).not.toHaveBeenCalled();
      expect(result.new_balance).toBe(2500.00);
    });
  });

  describe('handleGatewayWebhook', () => {
    it('should capture webhook payment captured event and credit balance', async () => {
      const mockOrder = {
        id: 'order-123',
        tenant_id: 'tenant-123',
        wallet_id: 'wallet-123',
        amount: 1000.00,
        status: 'pending',
        initiated_by: 'user-123',
        update: jest.fn().mockResolvedValue(true),
      };

      RechargeOrder.findOne.mockResolvedValue(mockOrder);
      RechargeOrder.findByPk.mockResolvedValue(mockOrder);

      const webhookPayload = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_webhook_999',
              order_id: 'rzp_order_abc',
            },
          },
        },
      });

      const res = await rechargeService.handleGatewayWebhook(
        'razorpay',
        'valid_signature',
        webhookPayload,
        'secret'
      );

      expect(RechargeOrder.findOne).toHaveBeenCalledWith({
        where: { gateway_order_id: 'rzp_order_abc' },
      });
      expect(walletService.credit).toHaveBeenCalled();
      expect(res.success).toBe(true);
    });
  });
});
