'use strict';

const { v4: uuidv4 } = require('uuid');
const walletService = require('../../src/services/wallet.service');
const { InsufficientBalanceError } = require('../../src/utils/errors');
const { Wallet, WalletTransaction, sequelize } = require('../../src/models');

describe('Wallet Financial Integrity & Validation Tests', () => {
  let tenantId;
  let wallet;

  beforeEach(async () => {
    tenantId = uuidv4();
    wallet = {
      id: uuidv4(),
      tenant_id: tenantId,
      balance: 300.00,
      low_balance_threshold: 100.00,
      update: jest.fn().mockImplementation(async (updates) => {
        wallet.balance = updates.balance;
        return wallet;
      }),
    };

    jest.spyOn(Wallet, 'findOne').mockResolvedValue(wallet);
    jest.spyOn(WalletTransaction, 'create').mockImplementation(async (txData) => ({
      id: uuidv4(),
      ...txData,
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('1. Rejects zero or negative credit amounts', async () => {
    await expect(
      walletService.credit(tenantId, 0, 'manual', uuidv4(), 'Zero credit')
    ).rejects.toThrow('Credit amount must be positive');

    await expect(
      walletService.credit(tenantId, -50, 'manual', uuidv4(), 'Negative credit')
    ).rejects.toThrow('Credit amount must be positive');
  });

  it('2. Rejects zero or negative debit amounts', async () => {
    await expect(
      walletService.debit(tenantId, 0, 'manual', uuidv4(), 'Zero debit')
    ).rejects.toThrow('Debit amount must be positive');

    await expect(
      walletService.debit(tenantId, -100, 'manual', uuidv4(), 'Negative debit')
    ).rejects.toThrow('Debit amount must be positive');
  });

  it('3. Rejects single debit exceeding available balance', async () => {
    await expect(
      walletService.debit(tenantId, 500, 'freight_adjustment', uuidv4(), 'Overdraft test')
    ).rejects.toThrow(InsufficientBalanceError);

    expect(wallet.balance).toBe(300.00);
  });

  it('4. Sequential and concurrency validation: prevents balance overrun', async () => {
    // Attempt multiple debits of ₹100
    const debits = [100.00, 100.00, 100.00, 100.00, 100.00];
    const results = [];

    for (const amt of debits) {
      try {
        const bal = await walletService.debit(tenantId, amt, 'freight_adjustment', uuidv4(), 'Debit step');
        results.push({ success: true, balance: bal });
      } catch (err) {
        results.push({ success: false, error: err.name });
      }
    }

    const succeeded = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    // Exactly 3 succeed (3 * 100 = 300) and 2 fail
    expect(succeeded.length).toBe(3);
    expect(failed.length).toBe(2);
    expect(wallet.balance).toBe(0.00);
  });

  it('5. Accurate financial floating point calculations without binary drift', async () => {
    wallet.balance = 100.00;
    const b1 = await walletService.credit(tenantId, 0.10, 'manual', uuidv4(), 'Cent 1');
    expect(b1).toBe(100.10);

    const b2 = await walletService.credit(tenantId, 0.20, 'manual', uuidv4(), 'Cent 2');
    expect(b2).toBe(100.30);

    const b3 = await walletService.debit(tenantId, 0.15, 'freight_adjustment', uuidv4(), 'Cent debit');
    expect(b3).toBe(100.15);
  });
});
