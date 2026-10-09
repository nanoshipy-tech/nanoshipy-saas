const authService = require('../../src/services/auth.service');
const tenantRepository = require('../../src/repositories/tenant.repository');
const userRepository = require('../../src/repositories/user.repository');
const emailService = require('../../src/services/email.service');
const tokenService = require('../../src/services/token.service');
const { sequelize } = require('../../src/models');

jest.mock('../../src/repositories/tenant.repository');
jest.mock('../../src/repositories/user.repository');
jest.mock('../../src/services/email.service');
jest.mock('../../src/services/token.service');
jest.mock('../../src/models', () => ({
  sequelize: {
    transaction: jest.fn((cb) => cb()),
  },
  CourierProvider: {
    findOne: jest.fn().mockResolvedValue({ id: 'mock-provider-id' }),
    findAll: jest.fn().mockResolvedValue([]),
  },
  TenantCourierAccess: {
    create: jest.fn().mockResolvedValue({}),
    bulkCreate: jest.fn().mockResolvedValue([]),
  },
  Wallet: {
    create: jest.fn().mockResolvedValue({}),
  },
  SubscriptionPlan: {
    findOne: jest.fn().mockResolvedValue({
      id: 'mock-plan-id',
      courier_access_tier: 'basic',
    }),
  },
  TenantSubscription: {
    create: jest.fn().mockResolvedValue({}),
  },
  PlanUsageTracking: {
    create: jest.fn().mockResolvedValue({}),
  },
  PlanChangeHistory: {
    create: jest.fn().mockResolvedValue({}),
  },
}));

describe('Auth Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should throw ConflictError if subdomain is taken', async () => {
      const { getRedisClient } = require('../../src/config/redis.config');
      const redis = getRedisClient();
      await redis.set('reg_otp:test@example.com', '789123', 'EX', 60);

      tenantRepository.findBySubdomain.mockResolvedValue({ id: '1' });
      await expect(
        authService.register({ email: 'test@example.com', subdomain: 'test', otp: '789123' })
      ).rejects.toThrow('This subdomain is already in use');
    });

    it('should fail registration if OTP is expired or not requested', async () => {
      const { getRedisClient } = require('../../src/config/redis.config');
      const redis = getRedisClient();
      await redis.del('reg_otp:no_otp@example.com');

      await expect(
        authService.register({
          email: 'no_otp@example.com',
          company_name: 'NoOtp Co',
          subdomain: 'no-otp',
          otp: '123456',
        })
      ).rejects.toThrow('OTP expired or not requested');
    });

    it('should fail registration if invalid OTP or backdoor 123456 is provided', async () => {
      const { getRedisClient } = require('../../src/config/redis.config');
      const redis = getRedisClient();
      await redis.set('reg_otp:bad_otp@example.com', '999888', 'EX', 60);

      await expect(
        authService.register({
          email: 'bad_otp@example.com',
          company_name: 'BadOtp Co',
          subdomain: 'bad-otp',
          otp: '123456',
        })
      ).rejects.toThrow('Invalid or expired verification OTP code');
    });

    it('should successfully register and send verification email with valid OTP', async () => {
      const { getRedisClient } = require('../../src/config/redis.config');
      const redis = getRedisClient();
      await redis.set('reg_otp:john@acme.com', '654321', 'EX', 60);

      tenantRepository.findBySubdomain.mockResolvedValue(null);
      tenantRepository.create.mockResolvedValue({ id: 't1', status: 'pending' });
      tenantRepository.findGlobalRoleByName.mockResolvedValue({ id: 'r1' });
      tenantRepository.createTenantRole.mockResolvedValue({ id: 'tr1' });
      tenantRepository.cloneRolePermissions.mockResolvedValue();
      userRepository.create.mockResolvedValue({ id: 'u1' });
      tokenService.signEmailVerificationToken.mockReturnValue('token123');
      emailService.sendEmail.mockResolvedValue(true);

      const result = await authService.register({
        company_name: 'Acme',
        subdomain: 'acme',
        name: 'John',
        email: 'john@acme.com',
        password: 'Password1!',
        otp: '654321',
      });

      expect(result).toHaveProperty('tenant_id', 't1');
      expect(result).toHaveProperty('user_id', 'u1');
      expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe('resetPassword backdoor regression test', () => {
    it('should reject password reset with otp=123456 when OTP was not requested', async () => {
      const { getRedisClient } = require('../../src/config/redis.config');
      const redis = getRedisClient();
      await redis.del('pwd_reset_otp:victim@example.com');

      await expect(
        authService.resetPassword({
          email: 'victim@example.com',
          otp: '123456',
          new_password: 'HackedPassword123!',
        })
      ).rejects.toThrow('Invalid or expired OTP code');
    });
  });
});
