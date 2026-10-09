const { Tenant, CompanyDocument, PickupAddress, User } = require('../models');
const fileUploadService = require('./fileUpload.service');
const { Op } = require('sequelize');
const auditService = require('./audit.service');

class CompanyProfileService {
  async getProfile(tenantId, options = {}) {
    const tenant = await Tenant.findByPk(tenantId, {
      attributes: ['id', 'company_name', 'legal_name', 'gstin', 'business_type', 'support_email', 'support_phone', 'logo_url', 'profile_completed', 'kyc_status'],
    });
    if (!tenant) throw new Error('Tenant not found');
    const data = tenant.toJSON();
    if (!options.unmasked && data.gstin && data.gstin.length >= 10) {
      data.gstin = data.gstin.substring(0, 2) + 'XXXXX' + data.gstin.substring(7, 11) + 'X' + data.gstin.substring(12);
    }
    return data;
  }

  async getAdminAccessLogs(tenantId) {
    const impersonationService = require('./impersonation.service');
    return impersonationService.getMerchantImpersonationLogs(tenantId);
  }

  async updateProfile(tenantId, updateData, user) {
    const tenant = await Tenant.findByPk(tenantId);
    if (!tenant) throw new Error('Tenant not found');

    const originalData = tenant.toJSON();

    // Allowed fields
    const fields = ['legal_name', 'gstin', 'business_type', 'support_email', 'support_phone'];
    for (const field of fields) {
      if (updateData[field] !== undefined) {
        tenant[field] = updateData[field];
      }
    }

    await tenant.save();

    // Re-evaluate profile_completed flag
    await this.evaluateProfileCompletion(tenantId);
    await tenant.reload();

    if (user) {
      await auditService.log({
        action: 'company_profile_updated',
        tenant_id: tenantId,
        user_id: user.id,
        entity_type: 'tenant',
        entity_id: tenantId,
        metadata: { diff: 'Profile updated' } // using simple string for diff
      });
    }
    
    return tenant;
  }

  async uploadLogo(tenantId, file, user) {
    const tenant = await Tenant.findByPk(tenantId);
    if (!tenant) throw new Error('Tenant not found');

    // Delete old logo if exists
    if (tenant.logo_url) {
      await fileUploadService.deleteFile(tenant.logo_url);
    }

    const publicUrl = await fileUploadService.uploadFile(
      file.buffer,
      'company/logos',
      file.originalname,
      file.mimetype
    );

    tenant.logo_url = publicUrl;
    await tenant.save();

    return tenant;
  }

  async getDocuments(tenantId) {
    return CompanyDocument.findAll({
      where: { tenant_id: tenantId },
      include: [{ model: User, attributes: ['id', 'name', 'email'] }],
      order: [['created_at', 'DESC']],
    });
  }

  async uploadDocument(tenantId, documentType, file, userId) {
    const publicUrl = await fileUploadService.uploadFile(
      file.buffer,
      'company/documents',
      file.originalname,
      file.mimetype
    );

    const doc = await CompanyDocument.create({
      tenant_id: tenantId,
      document_type: documentType,
      file_url: publicUrl,
      file_name: file.originalname,
      status: 'pending',
      uploaded_by: userId,
    });

    // Automatically update KYC status of tenant to submitted if it was pending
    const tenant = await Tenant.findByPk(tenantId);
    if (tenant && tenant.kyc_status === 'pending') {
      tenant.kyc_status = 'submitted';
      await tenant.save();
    }

    if (userId) {
      await auditService.log({
        action: 'document_uploaded',
        tenant_id: tenantId,
        user_id: userId,
        entity_type: 'company_document',
        entity_id: doc.id,
        metadata: { document_type: documentType, file_name: file.originalname }
      });
    }

    return doc;
  }

  async deleteDocument(tenantId, documentId) {
    const doc = await CompanyDocument.findOne({
      where: { id: documentId, tenant_id: tenantId },
    });

    if (!doc) throw new Error('Document not found');
    if (doc.status === 'verified') {
      const error = new Error('Cannot delete a verified document');
      error.code = 'DOCUMENT_ALREADY_VERIFIED';
      throw error;
    }

    await fileUploadService.deleteFile(doc.file_url);
    await doc.destroy();

    await auditService.log({
      action: 'document_deleted',
      tenant_id: tenantId,
      entity_type: 'company_document',
      entity_id: documentId,
    });
  }

  async evaluateProfileCompletion(tenantId) {
    const tenant = await Tenant.findByPk(tenantId);
    if (!tenant) return false;

    const hasAddresses = await PickupAddress.count({
      where: { tenant_id: tenantId, is_active: true }
    });

    const isComplete = Boolean(
      tenant.legal_name &&
      tenant.gstin &&
      hasAddresses > 0
    );

    if (tenant.profile_completed !== isComplete) {
      tenant.profile_completed = isComplete;
      await tenant.save();
    }

    return isComplete;
  }
}

module.exports = new CompanyProfileService();
