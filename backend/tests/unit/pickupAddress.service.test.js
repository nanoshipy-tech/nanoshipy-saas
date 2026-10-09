const pickupAddressService = require('../../src/services/pickupAddress.service');
const { PickupAddress, sequelize } = require('../../src/models');
const companyProfileService = require('../../src/services/companyProfile.service');
const auditService = require('../../src/services/audit.service');

// Mock dependencies
jest.mock('../../src/models', () => {
  const mockCount = jest.fn();
  const mockCreate = jest.fn();
  const mockUpdate = jest.fn();
  const mockFindOne = jest.fn();
  const mockFindAndCountAll = jest.fn();
  
  return {
    sequelize: {
      transaction: jest.fn((cb) => cb({})),
      Op: {
        or: 'OR_MOCK',
        ne: 'NE_MOCK',
        iLike: 'ILIKE_MOCK',
      }
    },
    PickupAddress: {
      count: mockCount,
      create: mockCreate,
      update: mockUpdate,
      findOne: mockFindOne,
      findAndCountAll: mockFindAndCountAll,
    },
  };
});

jest.mock('../../src/services/companyProfile.service', () => ({
  evaluateProfileCompletion: jest.fn(),
}));

jest.mock('../../src/services/audit.service', () => ({
  log: jest.fn(),
}));

describe('PickupAddressService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAddress', () => {
    it('should force is_default to true if it is the first address', async () => {
      PickupAddress.count.mockResolvedValue(0); // No existing addresses
      PickupAddress.create.mockResolvedValue({ id: 'addr123', label: 'Warehouse', is_default: true });

      const result = await pickupAddressService.createAddress('tenant123', {
        label: 'Warehouse',
        is_default: false // requested false, but should be forced true
      });

      expect(PickupAddress.count).toHaveBeenCalled();
      expect(PickupAddress.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenant_id: 'tenant123', is_default: true }),
        expect.any(Object)
      );
      expect(result.is_default).toBe(true);
      expect(companyProfileService.evaluateProfileCompletion).toHaveBeenCalledWith('tenant123');
    });

    it('should unset previous default address if new address is set as default', async () => {
      PickupAddress.count.mockResolvedValue(2); // Already has addresses
      PickupAddress.create.mockResolvedValue({ id: 'addr456', label: 'Office', is_default: true });

      await pickupAddressService.createAddress('tenant123', {
        label: 'Office',
        is_default: true
      });

      expect(PickupAddress.update).toHaveBeenCalledWith(
        { is_default: false },
        expect.objectContaining({ where: { tenant_id: 'tenant123', is_default: true, is_active: true } })
      );
      expect(PickupAddress.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenant_id: 'tenant123', is_default: true }),
        expect.any(Object)
      );
    });
  });

  describe('updateAddress', () => {
    it('should block unsetting default if it is the only active address', async () => {
      const mockAddress = {
        id: 'addr123',
        is_default: true,
        update: jest.fn()
      };
      PickupAddress.findOne.mockResolvedValue(mockAddress);
      PickupAddress.count.mockResolvedValue(1); // Only 1 active address

      await expect(
        pickupAddressService.updateAddress('tenant123', 'addr123', { is_default: false })
      ).rejects.toThrow('Set another address as default before removing the default status from this one');
    });

    it('should allow setting is_default = true and unset previous default', async () => {
      const mockAddress = {
        id: 'addr456',
        is_default: false,
        update: jest.fn().mockResolvedValue({ id: 'addr456', is_default: true })
      };
      PickupAddress.findOne.mockResolvedValue(mockAddress);

      await pickupAddressService.updateAddress('tenant123', 'addr456', { is_default: true });

      expect(PickupAddress.update).toHaveBeenCalledWith(
        { is_default: false },
        expect.objectContaining({ where: { tenant_id: 'tenant123', is_default: true, is_active: true } })
      );
      expect(mockAddress.update).toHaveBeenCalledWith({ is_default: true }, expect.any(Object));
    });
  });

  describe('deleteAddress', () => {
    it('should throw DEFAULT_ADDRESS_REQUIRED when deleting the default address and other active addresses exist', async () => {
      const mockAddress = {
        id: 'addr123',
        is_default: true,
      };
      PickupAddress.findOne.mockResolvedValue(mockAddress);
      PickupAddress.count.mockResolvedValue(2); // Other active addresses exist

      await expect(
        pickupAddressService.deleteAddress('tenant123', 'addr123')
      ).rejects.toThrow('Set another address as default before deleting this one');
    });

    it('should soft-delete by setting is_active = false', async () => {
      const mockAddress = {
        id: 'addr123',
        is_default: false,
        update: jest.fn()
      };
      PickupAddress.findOne.mockResolvedValue(mockAddress);

      await pickupAddressService.deleteAddress('tenant123', 'addr123');

      expect(mockAddress.update).toHaveBeenCalledWith({ is_active: false }, expect.any(Object));
      expect(companyProfileService.evaluateProfileCompletion).toHaveBeenCalledWith('tenant123');
    });
  });
});
