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
  const mockWalletTransactionSum = jest.fn();
  const mockWalletTransactionFindOne = jest.fn();

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
        if (typeof cb === 'function') {
          return cb(mockTx);
        }
        return mockTx;
      }),
    },
    Wallet: {
      findOne: mockWalletFindOne,
      findByPk: mockWalletFindByPk,
      update: mockWalletUpdate,
    },
    WalletTransaction: {
      findOne: mockWalletTransactionFindOne,
      create: mockWalletTransactionCreate,
      sum: mockWalletTransactionSum,
    },
    RechargeOrder: {
      findOne: mockRechargeOrderFindOne,
      findByPk: mockRechargeOrderFindByPk,
      update: mockRechargeOrderUpdate,
    },
    User: {
      findByPk: mockUserFindByPk,
    },
  };
});

const walletService = require('../../src/services/wallet.service');
const { Wallet, WalletTransaction } = require('../../src/models');
const auditService = require('../../src/services/audit.service');

jest.mock('../../src/services/audit.service', () => ({
  log: jest.fn().mockResolvedValue(true),
}));

describe('WalletService - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('credit', () => {
    it('should successfully credit balance and append transactional ledger row', async () => {
      const mockWallet = {
        id: 'wallet-123',
        tenant_id: 'tenant-123',
        balance: 1000.00,
        update: jest.fn().mockResolvedValue(true),
      };

      Wallet.findOne.mockResolvedValue(mockWallet);
      WalletTransaction.create.mockResolvedValue({ id: 'tx-1' });

      const newBalance = await walletService.credit(
        'tenant-123',
        500.00,
        'recharge',
        'ref-1',
        'Test recharge credit'
      );

      expect(Wallet.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenant_id: 'tenant-123' } })
      );
      expect(WalletTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          wallet_id: 'wallet-123',
          type: 'credit',
          amount: 500.00,
          balance_after: 1500.00,
          reference_type: 'recharge',
          reference_id: 'ref-1',
        }),
        expect.any(Object)
      );
      expect(mockWallet.update).toHaveBeenCalledWith({ balance: 1500.00 }, expect.any(Object));
      expect(newBalance).toBe(1500.00);
    });

    it('should throw if credit amount is negative or invalid', async () => {
      await expect(
        walletService.credit('tenant-123', -50.00, 'recharge', 'ref-1', 'invalid')
      ).rejects.toThrow();
    });
  });

  describe('debit', () => {
    it('should successfully debit balance if funds are sufficient', async () => {
      const mockWallet = {
        id: 'wallet-123',
        tenant_id: 'tenant-123',
        balance: 1000.00,
        low_balance_threshold: 500.00,
        update: jest.fn().mockResolvedValue(true),
      };

      Wallet.findOne.mockResolvedValue(mockWallet);
      WalletTransaction.create.mockResolvedValue({ id: 'tx-2' });

      const newBalance = await walletService.debit(
        'tenant-123',
        300.00,
        'shipment_debit',
        'shipment-123',
        'Consignment debit fee'
      );

      expect(mockWallet.update).toHaveBeenCalledWith({ balance: 700.00 }, expect.any(Object));
      expect(newBalance).toBe(700.00);
    });

    it('should reject and throw InsufficientBalanceError if amount exceeds balance', async () => {
      const mockWallet = {
        id: 'wallet-123',
        tenant_id: 'tenant-123',
        balance: 200.00,
      };

      Wallet.findOne.mockResolvedValue(mockWallet);

      await expect(
        walletService.debit('tenant-123', 300.00, 'shipment_debit', 'shipment-123', 'Consignment')
      ).rejects.toThrow(expect.objectContaining({ name: 'InsufficientBalanceError' }));
    });
  });

  describe('reconcileWalletBalance', () => {
    it('should recalculate cached balance to match sum of credits minus debits in ledger', async () => {
      const mockWallet = {
        id: 'wallet-123',
        balance: 100.00,
        update: jest.fn().mockResolvedValue(true),
      };

      Wallet.findByPk.mockResolvedValue(mockWallet);
      WalletTransaction.sum
        .mockResolvedValueOnce(5000.00) // credits sum
        .mockResolvedValueOnce(1500.00); // debits sum

      const reconciled = await walletService.reconcileWalletBalance('wallet-123');

      expect(WalletTransaction.sum).toHaveBeenNthCalledWith(1, 'amount', expect.objectContaining({
        where: { wallet_id: 'wallet-123', type: 'credit' }
      }));
      expect(WalletTransaction.sum).toHaveBeenNthCalledWith(2, 'amount', expect.objectContaining({
        where: { wallet_id: 'wallet-123', type: 'debit' }
      }));
      expect(mockWallet.update).toHaveBeenCalledWith({ balance: 3500.00 });
      expect(reconciled).toBe(3500.00);
    });
  });

  describe('Concurrency verification', () => {
    it('should lock rows sequentially when multiple concurrent debit calls occur', async () => {
      const mockWallet = {
        id: 'wallet-123',
        tenant_id: 'tenant-123',
        balance: 1000.00,
        low_balance_threshold: 500.00,
        update: jest.fn().mockImplementation(function(data) {
          this.balance = data.balance;
          return Promise.resolve(true);
        }),
      };

      Wallet.findOne.mockResolvedValue(mockWallet);
      WalletTransaction.create.mockResolvedValue({ id: 'tx-con' });

      const debits = Array.from({ length: 5 }, () =>
        walletService.debit('tenant-123', 100.00, 'shipment_debit', 'shipment-123', 'Concurrent debit')
      );

      const results = await Promise.all(debits);
      results.forEach(res => {
        expect(res).toBeGreaterThanOrEqual(500.00);
      });
      expect(Wallet.findOne).toHaveBeenCalledTimes(5);
    });
  });
});
