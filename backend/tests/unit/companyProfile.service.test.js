const companyProfileService = require('../../src/services/companyProfile.service');
const { Tenant, CompanyDocument, PickupAddress } = require('../../src/models');
const fileUploadService = require('../../src/services/fileUpload.service');
const auditService = require('../../src/services/audit.service');

// Mock dependencies
jest.mock('../../src/models', () => {
  const mockCount = jest.fn();
  const mockCreate = jest.fn();
  const mockUpdate = jest.fn();
  const mockFindOne = jest.fn();
  const mockFindByPk = jest.fn();
  const mockFindAll = jest.fn();
  
  return {
    Tenant: {
      findByPk: mockFindByPk,
      update: mockUpdate,
    },
    CompanyDocument: {
      create: mockCreate,
      findOne: mockFindOne,
      findAll: mockFindAll,
    },
    PickupAddress: {
      count: mockCount,
    },
  };
});

jest.mock('../../src/services/fileUpload.service', () => ({
  uploadFile: jest.fn(),
  deleteFile: jest.fn(),
}));

jest.mock('../../src/services/audit.service', () => ({
  log: jest.fn(),
}));

describe('CompanyProfileService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('evaluateProfileCompletion', () => {
    it('should set profile_completed to true when legal_name, gstin, and at least one address exist', async () => {
      const mockTenant = {
        legal_name: 'Acme legal',
        gstin: '22AAAAA1111A1Z1',
        profile_completed: false,
        save: jest.fn(),
      };
      Tenant.findByPk.mockResolvedValue(mockTenant);
      PickupAddress.count.mockResolvedValue(1); // 1 active address

      const result = await companyProfileService.evaluateProfileCompletion('tenant123');

      expect(result).toBe(true);
      expect(mockTenant.profile_completed).toBe(true);
      expect(mockTenant.save).toHaveBeenCalled();
    });

    it('should set profile_completed to false if legal_name is missing', async () => {
      const mockTenant = {
        legal_name: null,
        gstin: '22AAAAA1111A1Z1',
        profile_completed: true,
        save: jest.fn(),
      };
      Tenant.findByPk.mockResolvedValue(mockTenant);
      PickupAddress.count.mockResolvedValue(1);

      const result = await companyProfileService.evaluateProfileCompletion('tenant123');

      expect(result).toBe(false);
      expect(mockTenant.profile_completed).toBe(false);
      expect(mockTenant.save).toHaveBeenCalled();
    });

    it('should set profile_completed to false if gstin is missing', async () => {
      const mockTenant = {
        legal_name: 'Acme Legal',
        gstin: null,
        profile_completed: true,
        save: jest.fn(),
      };
      Tenant.findByPk.mockResolvedValue(mockTenant);
      PickupAddress.count.mockResolvedValue(1);

      const result = await companyProfileService.evaluateProfileCompletion('tenant123');

      expect(result).toBe(false);
      expect(mockTenant.profile_completed).toBe(false);
    });

    it('should set profile_completed to false if active pickup address count is 0', async () => {
      const mockTenant = {
        legal_name: 'Acme Legal',
        gstin: '22AAAAA1111A1Z1',
        profile_completed: true,
        save: jest.fn(),
      };
      Tenant.findByPk.mockResolvedValue(mockTenant);
      PickupAddress.count.mockResolvedValue(0); // No addresses

      const result = await companyProfileService.evaluateProfileCompletion('tenant123');

      expect(result).toBe(false);
      expect(mockTenant.profile_completed).toBe(false);
    });
  });

  describe('deleteDocument', () => {
    it('should throw DOCUMENT_ALREADY_VERIFIED error if document status is verified', async () => {
      const mockDoc = {
        id: 'doc123',
        status: 'verified',
        file_url: 'http://s3/file.pdf',
        destroy: jest.fn(),
      };
      CompanyDocument.findOne.mockResolvedValue(mockDoc);

      await expect(
        companyProfileService.deleteDocument('tenant123', 'doc123')
      ).rejects.toThrow('Cannot delete a verified document');
    });

    it('should delete file and destroy document if status is pending', async () => {
      const mockDoc = {
        id: 'doc123',
        status: 'pending',
        file_url: 'http://s3/file.pdf',
        destroy: jest.fn(),
      };
      CompanyDocument.findOne.mockResolvedValue(mockDoc);

      await companyProfileService.deleteDocument('tenant123', 'doc123');

      expect(fileUploadService.deleteFile).toHaveBeenCalledWith('http://s3/file.pdf');
      expect(mockDoc.destroy).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'document_deleted', entity_id: 'doc123' })
      );
    });
  });
});
