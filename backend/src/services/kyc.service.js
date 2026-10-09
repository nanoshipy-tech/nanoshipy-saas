'use strict';

const kycRepository = require('../repositories/kyc.repository');
const { Tenant, Wallet } = require('../models');
const { KycAlreadyApprovedError, KycDocumentMissingError, NotFoundError } = require('../utils/errors');
const eventBus = require('../events/eventBus');
const sequelize = require('../config/db.config');

function levenshteinDistance(s1, s2) {
  const m = s1.length;
  const n = s2.length;
  const d = [];
  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1].toLowerCase() === s2[j - 1].toLowerCase() ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
    }
  }
  return d[m][n];
}

class KycService {
  async getKycStatus(sellerId) {
    const status = await kycRepository.getKycStatus(sellerId);
    if (!status) throw new NotFoundError('Seller not found');
    return status;
  }

  async updateBusinessDetails(sellerId, data) {
    const tenant = await Tenant.findByPk(sellerId);
    if (!tenant) throw new NotFoundError('Seller not found');
    if (tenant.kyc_status === 'approved' || tenant.kyc_status === 'suspended') {
      throw new KycAlreadyApprovedError('Cannot update business details once KYC is approved or suspended');
    }

    return kycRepository.updateBusinessDetails(sellerId, data);
  }

  async verifyBankPennyDrop(sellerId, bankDetails) {
    const tenant = await Tenant.findByPk(sellerId);
    if (!tenant) throw new NotFoundError('Seller not found');

    const { bank_account_number, bank_ifsc, bank_account_holder_name } = bankDetails;

    // Simulate penny drop verification
    // Fuzzy matching holder name against legal name or authorized signatory
    const targetName1 = tenant.legal_business_name || tenant.company_name || '';
    const targetName2 = tenant.authorized_signatory_name || '';

    const dist1 = levenshteinDistance(bank_account_holder_name, targetName1);
    const dist2 = levenshteinDistance(bank_account_holder_name, targetName2);

    const isMatch = dist1 <= 3 || dist2 <= 3;

    // Update bank details
    // We encrypt bank account number in the database: AES-256-GCM is best. For simplicity of demonstration,
    // we use base64 encoding/decoding or a simple cipher since standard node crypto is available.
    const crypto = require('crypto');
    const key = process.env.ENCRYPTION_KEY ? crypto.scryptSync(process.env.ENCRYPTION_KEY, 'salt', 32) : crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encryptedAcc = cipher.update(bank_account_number, 'utf8', 'hex');
    encryptedAcc += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    const encryptedData = JSON.stringify({ iv: iv.toString('hex'), data: encryptedAcc, tag: authTag });

    await tenant.update({
      bank_account_number_encrypted: encryptedData,
      bank_ifsc,
      bank_account_holder_name,
      bank_verified: isMatch,
    });

    return {
      success: true,
      bank_verified: isMatch,
      message: isMatch ? 'Bank details verified successfully.' : 'Bank name mismatch. Flagged for manual review.',
    };
  }

  async submitKyc(sellerId) {
    const tenant = await Tenant.findByPk(sellerId);
    if (!tenant) throw new NotFoundError('Seller not found');
    if (tenant.kyc_status === 'approved' || tenant.kyc_status === 'suspended') {
      throw new KycAlreadyApprovedError('KYC already approved');
    }

    // Check mandatory documents: PAN and Bank Cancelled Cheque are mandatory
    const docs = await kycRepository.findDocumentsBySeller(sellerId);
    const hasPan = docs.some(d => d.document_type === 'pan');
    const hasCheque = docs.some(d => d.document_type === 'bank_cancelled_cheque');

    if (!hasPan || !hasCheque) {
      throw new KycDocumentMissingError('Mandatory documents (PAN, Bank Cancelled Cheque) are missing');
    }

    await tenant.update({
      kyc_status: 'submitted',
      kyc_submitted_at: new Date(),
    });

    const auditService = require('./audit.service');
    await auditService.log({
      tenant_id: sellerId,
      action: 'kyc_submitted',
      entity_type: 'tenant',
      entity_id: sellerId,
      metadata: { submitted_at: new Date() },
    });

    eventBus.emit('kyc.submitted', { seller_id: sellerId });

    return { success: true, status: 'submitted' };
  }

  async getReviewQueue(options) {
    return kycRepository.getReviewQueue(options);
  }

  async approveKyc(sellerId, adminId) {
    const tenant = await Tenant.findByPk(sellerId);
    if (!tenant) throw new NotFoundError('Seller not found');

    await sequelize.transaction(async (t) => {
      await tenant.update({
        kyc_status: 'approved',
        kyc_approved_at: new Date(),
        status: 'active', // Unlock seller account
      }, { transaction: t });

      // Create wallet if it does not exist
      const existingWallet = await Wallet.findOne({ where: { tenant_id: sellerId }, transaction: t });
      if (!existingWallet) {
        await Wallet.create({
          tenant_id: sellerId,
          balance: 0.00,
          low_balance_threshold: 500.00,
          currency: 'INR',
        }, { transaction: t });
      }
    });

    const auditService = require('./audit.service');
    await auditService.log({
      tenant_id: sellerId,
      user_id: adminId,
      action: 'kyc_approved',
      entity_type: 'tenant',
      entity_id: sellerId,
      metadata: { approved_by: adminId },
    });

    eventBus.emit('kyc.approved', { seller_id: sellerId });

    return { success: true, status: 'approved' };
  }

  async rejectKyc(sellerId, adminId, reason) {
    const tenant = await Tenant.findByPk(sellerId);
    if (!tenant) throw new NotFoundError('Seller not found');

    await tenant.update({
      kyc_status: 'rejected',
      kyc_rejection_reason: reason,
    });

    const auditService = require('./audit.service');
    await auditService.log({
      tenant_id: sellerId,
      user_id: adminId,
      action: 'kyc_rejected',
      entity_type: 'tenant',
      entity_id: sellerId,
      metadata: { rejected_by: adminId, reason },
    });

    eventBus.emit('kyc.rejected', { seller_id: sellerId, reason });

    return { success: true, status: 'rejected' };
  }

  async requestResubmission(sellerId, adminId, reason) {
    const tenant = await Tenant.findByPk(sellerId);
    if (!tenant) throw new NotFoundError('Seller not found');

    await tenant.update({
      kyc_status: 'resubmission_requested',
      kyc_rejection_reason: reason,
    });

    const auditService = require('./audit.service');
    await auditService.log({
      tenant_id: sellerId,
      user_id: adminId,
      action: 'kyc_resubmission_requested',
      entity_type: 'tenant',
      entity_id: sellerId,
      metadata: { requested_by: adminId, reason },
    });

    eventBus.emit('kyc.resubmission_requested', { seller_id: sellerId, reason });

    return { success: true, status: 'resubmission_requested' };
  }
}

module.exports = new KycService();
