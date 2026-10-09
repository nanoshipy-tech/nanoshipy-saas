const request = require('supertest');
const app = require('../../src/app');
const { Tenant, User, Role, PickupAddress, CompanyDocument } = require('../../src/models');
const sequelize = require('../../src/config/db.config');

// Mock auth middleware to inject mock user with required permissions
jest.mock('../../src/middlewares/auth.middleware', () => ({
  authenticate: (req, res, next) => {
    req.user = {
      id: 'e1356a2a-22a4-4599-a7ea-ac5168368c57',
      tenant_id: 'c8f3da92-c98e-49b4-b4bf-ac087114e41c',
      role: 'owner',
      permissions: ['company.view', 'company.update', 'address.view', 'address.create', 'address.update', 'address.delete'],
    };
    req.tenant = { id: 'c8f3da92-c98e-49b4-b4bf-ac087114e41c' };
    next();
  }
}));

// Mock fileUploadService to prevent calling real AWS/Cloudflare endpoints
jest.mock('../../src/services/fileUpload.service', () => ({
  uploadFile: jest.fn().mockResolvedValue('http://mockstorage/file.pdf'),
  deleteFile: jest.fn().mockResolvedValue(true),
}));

describe('Company Profile and Pickup Address Routes (Integration)', () => {
  const tenantId = 'c8f3da92-c98e-49b4-b4bf-ac087114e41c';
  const roleId = 'd03f0dc0-3d61-4502-9524-6e82f8138a66';
  const userId = 'e1356a2a-22a4-4599-a7ea-ac5168368c57';
  
  let firstAddressId;
  let secondAddressId;
  let documentId;

  beforeAll(async () => {
    // Clean prior test artifacts
    await CompanyDocument.destroy({ where: { tenant_id: tenantId }, force: true }).catch(() => {});
    await PickupAddress.destroy({ where: { tenant_id: tenantId }, force: true }).catch(() => {});

    // Seed test Tenant, Role, and User safely via findOrCreate
    const [tenant] = await Tenant.findOrCreate({
      where: { id: tenantId },
      defaults: {
        id: tenantId,
        company_name: 'Test Integration Company',
        subdomain: 'test-company-addr',
        status: 'active',
      },
    });

    // Reset profile fields for fresh test run
    await tenant.update({
      gstin: null,
      legal_name: null,
      company_email: null,
      company_phone: null,
      brand_name: null,
    });

    await Role.findOrCreate({
      where: { id: roleId },
      defaults: {
        id: roleId,
        tenant_id: tenantId,
        name: 'owner',
        is_system_role: false,
      },
    });

    await User.findOrCreate({
      where: { id: userId },
      defaults: {
        id: userId,
        tenant_id: tenantId,
        role_id: roleId,
        name: 'Test Owner User',
        email: 'company-addr-owner@test.com',
        password_hash: 'mock-hash',
        status: 'active',
        email_verified_at: new Date(),
      },
    });
  });

  afterAll(async () => {
    // Clean up test documents and addresses
    await CompanyDocument.destroy({ where: { tenant_id: tenantId }, force: true }).catch(() => {});
    await PickupAddress.destroy({ where: { tenant_id: tenantId }, force: true }).catch(() => {});
  });

  describe('Pickup Address Management Routes', () => {
    it('should create the first pickup address and set it as default automatically', async () => {
      const res = await request(app)
        .post('/api/v1/addresses')
        .send({
          label: 'Main Office',
          contact_name: 'Test Contact',
          contact_phone: '+919876543210',
          address_line1: 'Building 10',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          is_default: false // requested false, but should be forced true because it is the first address
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.is_default).toBe(true);
      firstAddressId = res.body.data.id;
    });

    it('should create a second pickup address without setting it as default', async () => {
      const res = await request(app)
        .post('/api/v1/addresses')
        .send({
          label: 'Secondary Warehouse',
          contact_name: 'Warehouse Mgr',
          contact_phone: '+919876543211',
          address_line1: 'Plot 42, GIDC',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400002',
          is_default: false
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.is_default).toBe(false);
      secondAddressId = res.body.data.id;
    });

    it('should set the second address as default and unset the first address as default', async () => {
      const res = await request(app)
        .put(`/api/v1/addresses/${secondAddressId}/set-default`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.is_default).toBe(true);

      // Verify in DB that first address has is_default = false
      const firstAddr = await PickupAddress.findByPk(firstAddressId);
      expect(firstAddr.is_default).toBe(false);
    });

    it('should allow deleting the non-default first address', async () => {
      const res = await request(app)
        .delete(`/api/v1/addresses/${firstAddressId}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify soft-deleted
      const firstAddr = await PickupAddress.findByPk(firstAddressId);
      expect(firstAddr.is_active).toBe(false);
    });

    it('should block deleting the second address because it is the only active default address', async () => {
      const res = await request(app)
        .delete(`/api/v1/addresses/${secondAddressId}`);

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('DEFAULT_ADDRESS_REQUIRED');
    });
  });

  describe('Company Profile and KYC Document Upload Routes', () => {
    it('should retrieve the company profile details', async () => {
      const res = await request(app)
        .get('/api/v1/company/profile');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.company_name).toBe('Test Integration Company');
      expect(res.body.data.profile_completed).toBe(false); // gstin and legal_name not set yet
    });

    it('should update company profile and recalculate profile completion', async () => {
      const res = await request(app)
        .put('/api/v1/company/profile')
        .send({
          legal_name: 'Test Legal India Private Limited',
          gstin: '22AAAAA1111A1Z1',
          business_type: 'pvt_ltd',
          support_email: 'support@test.com',
          support_phone: '+919876543210'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.legal_name).toBe('Test Legal India Private Limited');
      expect(res.body.data.gstin).toBe('22AAAAA1111A1Z1');
      expect(res.body.data.profile_completed).toBe(true); // gstin, legal_name, and address are now present!
    });

    it('should upload a KYC document successfully', async () => {
      const res = await request(app)
        .post('/api/v1/company/profile/documents')
        .field('document_type', 'pan')
        .attach('document', Buffer.from('fake-pdf-content'), 'pan.pdf');

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.document_type).toBe('pan');
      documentId = res.body.data.id;
    });

    it('should block deleting a KYC document if its status is verified', async () => {
      // Manually set status to verified in database
      await CompanyDocument.update({ status: 'verified' }, { where: { id: documentId } });

      const res = await request(app)
        .delete(`/api/v1/company/profile/documents/${documentId}`);

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('DOCUMENT_ALREADY_VERIFIED');
    });

    it('should allow deleting a KYC document if its status is pending', async () => {
      // Revert status to pending
      await CompanyDocument.update({ status: 'pending' }, { where: { id: documentId } });

      const res = await request(app)
        .delete(`/api/v1/company/profile/documents/${documentId}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const doc = await CompanyDocument.findByPk(documentId);
      expect(doc).toBeNull();
    });
  });
});
