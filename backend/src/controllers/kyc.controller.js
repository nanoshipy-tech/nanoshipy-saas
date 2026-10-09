'use strict';

const kycService = require('../services/kyc.service');
const fileUploadService = require('../services/fileUpload.service');
const { success } = require('../utils/apiResponse');
const { 
  updateBusinessDetailsSchema, 
  verifyBankDetailsSchema, 
  uploadDocumentSchema, 
  reviewKycSchema 
} = require('../validators/kyc.validator');
const { KycDocument, Tenant } = require('../models');
const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');

const getKycStatus = async (req, res, next) => {
  try {
    const sellerId = req.user.tenant_id || req.user.id;
    const status = await kycService.getKycStatus(sellerId);
    return success(res, status);
  } catch (err) {
    next(err);
  }
};

const updateBusinessDetails = async (req, res, next) => {
  try {
    const sellerId = req.user.tenant_id || req.user.id;
    const { error, value } = updateBusinessDetailsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: { message: error.details[0].message } });
    }
    const updated = await kycService.updateBusinessDetails(sellerId, value);
    return success(res, updated);
  } catch (err) {
    next(err);
  }
};

const getUploadUrl = async (req, res, next) => {
  try {
    const sellerId = req.user.tenant_id || req.user.id;
    const { error, value } = uploadDocumentSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: { message: error.details[0].message } });
    }

    const { document_type, s3_object_key } = value;
    const originalName = s3_object_key.split('/').pop() || 'document.pdf';
    
    // Call file upload service to get presigned details
    const result = await fileUploadService.getPresignedPutUrl('kyc/documents', originalName, 'application/pdf');

    // Create or update the document record
    let doc = await KycDocument.findOne({ where: { seller_id: sellerId, document_type } });
    if (doc) {
      await doc.update({
        s3_object_key: result.key,
        verification_status: 'pending',
      });
    } else {
      await KycDocument.create({
        seller_id: sellerId,
        document_type,
        s3_object_key: result.key,
        verification_status: 'pending',
      });
    }

    return success(res, {
      upload_url: result.uploadUrl,
      s3_object_key: result.key,
    });
  } catch (err) {
    next(err);
  }
};

const verifyBankDetails = async (req, res, next) => {
  try {
    const sellerId = req.user.tenant_id || req.user.id;
    const { error, value } = verifyBankDetailsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: { message: error.details[0].message } });
    }
    const result = await kycService.verifyBankPennyDrop(sellerId, value);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

const submitKyc = async (req, res, next) => {
  try {
    const sellerId = req.user.tenant_id || req.user.id;
    const result = await kycService.submitKyc(sellerId);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

// Admin Queue & Actions
const getAdminQueue = async (req, res, next) => {
  try {
    const { limit = 20, offset = 0, status = 'submitted' } = req.query;
    const list = await kycService.getReviewQueue({ limit: parseInt(limit), offset: parseInt(offset), status });
    return success(res, list);
  } catch (err) {
    next(err);
  }
};

const getAdminKycDetails = async (req, res, next) => {
  try {
    const { sellerId } = req.params;
    const status = await kycService.getKycStatus(sellerId);

    // Hydrate documents with short-lived presigned GET URLs
    if (status && status.documents) {
      for (const doc of status.documents) {
        doc.signed_url = await fileUploadService.getPresignedGetUrl(doc.s3_object_key);
      }
    }

    return success(res, status);
  } catch (err) {
    next(err);
  }
};

const approveKyc = async (req, res, next) => {
  try {
    const { sellerId } = req.params;
    const adminId = req.user.id;
    const result = await kycService.approveKyc(sellerId, adminId);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

const rejectKyc = async (req, res, next) => {
  try {
    const { sellerId } = req.params;
    const adminId = req.user.id;
    const { error, value } = reviewKycSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: { message: error.details[0].message } });
    }
    const result = await kycService.rejectKyc(sellerId, adminId, value.reason);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

const requestResubmission = async (req, res, next) => {
  try {
    const { sellerId } = req.params;
    const adminId = req.user.id;
    const { error, value } = reviewKycSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: { message: error.details[0].message } });
    }
    const result = await kycService.requestResubmission(sellerId, adminId, value.reason);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

// Simulated local upload for development/testing
const simulateUpload = async (req, res, next) => {
  try {
    const { key } = req.query;
    if (!key) {
      return res.status(400).json({ success: false, error: { message: 'Missing key parameter' } });
    }

    // Path traversal protection
    const sanitizedKey = path.normalize(key).replace(/^(\.\.[\/\\])+/, '');
    if (sanitizedKey.includes('..') || path.isAbsolute(sanitizedKey)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid path parameter' } });
    }

    const uploadBasePath = path.join(__dirname, '..', '..', 'uploads');
    const targetPath = path.join(uploadBasePath, sanitizedKey);
    const targetDir = path.dirname(targetPath);

    if (!fsSync.existsSync(targetDir)) {
      await fs.mkdir(targetDir, { recursive: true });
    }

    // Write a dummy file to simulate the upload success
    await fs.writeFile(targetPath, 'Simulated PDF Content for KYC');

    return success(res, { message: 'Simulated upload successful', key });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getKycStatus,
  updateBusinessDetails,
  getUploadUrl,
  verifyBankDetails,
  submitKyc,
  getAdminQueue,
  getAdminKycDetails,
  approveKyc,
  rejectKyc,
  requestResubmission,
  simulateUpload,
};
