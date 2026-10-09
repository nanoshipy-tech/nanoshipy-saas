const orderImportService = require('../services/orderImport.service');
const { generateCsvTemplate } = require('../utils/orderTemplate.util');

class OrderImportController {
  async downloadTemplate(req, res, next) {
    try {
      const csv = generateCsvTemplate();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=orders-upload-template.csv');
      res.status(200).send(csv);
    } catch (error) {
      next(error);
    }
  }

  async bulkImport(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, data: null, error: { message: 'No import file uploaded' } });
      }

      const tenantId = req.tenant.id;
      // Pass the multer file to the service
      const importRecord = await orderImportService.importOrders(tenantId, req.file, req.user.id);
      
      // Return 202 Accepted as requested by prompt API spec
      res.status(202).json({ success: true, data: importRecord, error: null });
    } catch (error) {
      if (error.code === 'IMPORT_FILE_FORMAT_ERROR') {
        return res.status(422).json({ success: false, error: { code: error.code, message: error.message } });
      }
      next(error);
    }
  }

  async listImports(req, res, next) {
    try {
      const tenantId = req.tenant.id;
      const { page = 1, limit = 20 } = req.query;
      const result = await orderImportService.listImports(tenantId, page, limit);
      res.status(200).json({ success: true, data: result, error: null });
    } catch (error) {
      next(error);
    }
  }

  async getImportById(req, res, next) {
    try {
      const tenantId = req.tenant.id;
      const { id } = req.params;
      const record = await orderImportService.getImportById(tenantId, id);
      res.status(200).json({ success: true, data: record, error: null });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new OrderImportController();
