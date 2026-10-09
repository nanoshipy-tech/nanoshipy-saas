'use strict';

const weightDisputeService = require('../services/weightDispute.service');
const { success } = require('../utils/apiResponse');

// Seller endpoints
const fileDispute = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { seller_evidence_s3_key, file_size_bytes, mime_type } = req.body;

    // Validate file constraints (Fix #28)
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const maxSizeBytes = 5 * 1024 * 1024; // 5 MB

    if (mime_type && !allowedMimeTypes.includes(mime_type.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: 'Evidence file must be a JPEG, PNG, WEBP image or PDF document.',
        },
      });
    }

    if (file_size_bytes && Number(file_size_bytes) > maxSizeBytes) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'Evidence file size cannot exceed 5MB.',
        },
      });
    }

    if (seller_evidence_s3_key) {
      const ext = seller_evidence_s3_key.split('.').pop()?.toLowerCase();
      const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];
      if (ext && !allowedExts.includes(ext)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_FILE_EXTENSION',
            message: 'Evidence file must have a valid extension (.jpg, .jpeg, .png, .webp, .pdf)',
          },
        });
      }
    }

    const dispute = await weightDisputeService.fileDispute(tenantId, req.body);
    return success(res, dispute, 201);
  } catch (err) {
    next(err);
  }
};

const listMyDisputes = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const disputes = await weightDisputeService.listDisputes(tenantId);
    return success(res, disputes);
  } catch (err) {
    next(err);
  }
};

const getMyDispute = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;
    const dispute = await weightDisputeService.getDispute(id, tenantId);
    if (!dispute) return res.status(404).json({ success: false, error: { message: 'Dispute not found' } });
    return success(res, dispute);
  } catch (err) {
    next(err);
  }
};

// Admin endpoints
const listAllDisputes = async (req, res, next) => {
  try {
    const disputes = await weightDisputeService.listDisputes();
    return success(res, disputes);
  } catch (err) {
    next(err);
  }
};

const resolveDispute = async (req, res, next) => {
  try {
    const adminId = req.platformAdmin ? req.platformAdmin.id : null;
    const { id } = req.params;
    const resolution = req.body.resolution || req.body.status;
    const { admin_notes, approved_weight_kg } = req.body;
    const resolved = await weightDisputeService.resolveDispute(id, adminId, { resolution, admin_notes, approved_weight_kg });
    return success(res, resolved);
  } catch (err) {
    next(err);
  }
};

module.exports = { fileDispute, listMyDisputes, getMyDispute, listAllDisputes, resolveDispute };
