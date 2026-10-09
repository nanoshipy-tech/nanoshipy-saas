'use strict';

const { KycDocument, Tenant } = require('../models');

class KycRepository {
  async createDocument(data, transaction) {
    return KycDocument.create(data, { transaction });
  }

  async findDocumentById(id) {
    return KycDocument.findByPk(id);
  }

  async findDocumentsBySeller(sellerId) {
    return KycDocument.findAll({
      where: { seller_id: sellerId },
      order: [['uploaded_at', 'DESC']],
    });
  }

  async findDocumentBySellerAndType(sellerId, docType) {
    return KycDocument.findOne({
      where: { seller_id: sellerId, document_type: docType },
    });
  }

  async updateDocument(id, updates, transaction) {
    const doc = await KycDocument.findByPk(id);
    if (!doc) return null;
    return doc.update(updates, { transaction });
  }

  async getKycStatus(sellerId) {
    const tenant = await Tenant.findByPk(sellerId, {
      attributes: [
        'kyc_status',
        'legal_business_name',
        'business_type',
        'pan_number',
        'gst_number',
        'gst_registered',
        'bank_verified',
        'bank_account_holder_name',
        'bank_ifsc',
        'authorized_signatory_name',
        'aadhaar_last4',
        'kyc_rejection_reason',
        'kyc_submitted_at',
        'kyc_approved_at',
      ],
    });
    if (!tenant) return null;

    const documents = await this.findDocumentsBySeller(sellerId);
    return {
      seller_id: sellerId,
      kyc_status: tenant.kyc_status,
      business_details: {
        legal_business_name: tenant.legal_business_name,
        business_type: tenant.business_type,
        pan_number: tenant.pan_number,
        gst_number: tenant.gst_number,
        gst_registered: tenant.gst_registered,
        bank_verified: tenant.bank_verified,
        bank_account_holder_name: tenant.bank_account_holder_name,
        bank_ifsc: tenant.bank_ifsc,
        authorized_signatory_name: tenant.authorized_signatory_name,
        aadhaar_last4: tenant.aadhaar_last4,
        kyc_rejection_reason: tenant.kyc_rejection_reason,
        kyc_submitted_at: tenant.kyc_submitted_at,
        kyc_approved_at: tenant.kyc_approved_at,
      },
      documents: documents.map(d => ({
        id: d.id,
        document_type: d.document_type,
        verification_status: d.verification_status,
        rejection_reason: d.rejection_reason,
        uploaded_at: d.uploaded_at,
        s3_object_key: d.s3_object_key,
      })),
    };
  }

  async updateBusinessDetails(sellerId, data, transaction) {
    const tenant = await Tenant.findByPk(sellerId);
    if (!tenant) return null;
    return tenant.update(data, { transaction });
  }

  async getReviewQueue(options = {}) {
    const { limit = 20, offset = 0, status = 'submitted' } = options;
    return Tenant.findAndCountAll({
      where: { kyc_status: status },
      attributes: ['id', 'company_name', 'subdomain', 'kyc_status', 'kyc_submitted_at'],
      order: [['kyc_submitted_at', 'ASC']],
      limit,
      offset,
    });
  }
}

module.exports = new KycRepository();
