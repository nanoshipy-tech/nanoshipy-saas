const companyProfileService = require('../services/companyProfile.service');

class CompanyProfileController {
  async getProfile(req, res, next) {
    try {
      const tenantId = req.tenant.id;
      const profile = await companyProfileService.getProfile(tenantId);
      res.status(200).json({ success: true, data: profile, error: null });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const tenantId = req.tenant.id;
      const profile = await companyProfileService.updateProfile(tenantId, req.body, req.user);
      res.status(200).json({ success: true, data: profile, error: null });
    } catch (error) {
      next(error);
    }
  }

  async uploadLogo(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, data: null, error: { message: 'No file uploaded' } });
      }
      const tenantId = req.tenant.id;
      const profile = await companyProfileService.uploadLogo(tenantId, req.file, req.user);
      res.status(200).json({ success: true, data: profile, error: null });
    } catch (error) {
      next(error);
    }
  }

  async getDocuments(req, res, next) {
    try {
      const tenantId = req.tenant.id;
      const documents = await companyProfileService.getDocuments(tenantId);
      res.status(200).json({ success: true, data: documents, error: null });
    } catch (error) {
      next(error);
    }
  }

  async uploadDocument(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, data: null, error: { message: 'No file uploaded' } });
      }
      const tenantId = req.tenant.id;
      const { document_type } = req.body;
      const document = await companyProfileService.uploadDocument(tenantId, document_type, req.file, req.user.id);
      res.status(201).json({ success: true, data: document, error: null });
    } catch (error) {
      next(error);
    }
  }

  async deleteDocument(req, res, next) {
    try {
      const tenantId = req.tenant.id;
      const { id } = req.params;
      await companyProfileService.deleteDocument(tenantId, id);
      res.status(200).json({ success: true, data: null, error: null });
    } catch (error) {
      if (error.code === 'DOCUMENT_ALREADY_VERIFIED') {
        return res.status(409).json({ success: false, error: { code: error.code, message: error.message } });
      }
      next(error);
    }
  }

  async getAdminAccessLogs(req, res, next) {
    try {
      const tenantId = req.tenant.id;
      const logs = await companyProfileService.getAdminAccessLogs(tenantId);
      res.status(200).json({ success: true, data: logs, error: null });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CompanyProfileController();
