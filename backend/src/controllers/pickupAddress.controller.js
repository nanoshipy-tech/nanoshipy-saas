const pickupAddressService = require('../services/pickupAddress.service');

class PickupAddressController {
  async getAddresses(req, res, next) {
    try {
      const tenantId = req.tenant.id;
      const result = await pickupAddressService.getAddresses(tenantId, req.query);
      res.status(200).json({ success: true, data: result, error: null });
    } catch (error) {
      next(error);
    }
  }

  async getAddressById(req, res, next) {
    try {
      const tenantId = req.tenant.id;
      const { id } = req.params;
      const address = await pickupAddressService.getAddressById(tenantId, id);
      res.status(200).json({ success: true, data: address, error: null });
    } catch (error) {
      next(error);
    }
  }

  async createAddress(req, res, next) {
    try {
      const tenantId = req.tenant.id;
      const address = await pickupAddressService.createAddress(tenantId, req.body);
      res.status(201).json({ success: true, data: address, error: null });
    } catch (error) {
      next(error);
    }
  }

  async updateAddress(req, res, next) {
    try {
      const tenantId = req.tenant.id;
      const { id } = req.params;
      const address = await pickupAddressService.updateAddress(tenantId, id, req.body);
      res.status(200).json({ success: true, data: address, error: null });
    } catch (error) {
      if (error.code === 'DEFAULT_ADDRESS_REQUIRED') {
        return res.status(409).json({ success: false, error: { code: error.code, message: error.message } });
      }
      next(error);
    }
  }

  async setDefault(req, res, next) {
    try {
      const tenantId = req.tenant.id;
      const { id } = req.params;
      const address = await pickupAddressService.setDefault(tenantId, id);
      res.status(200).json({ success: true, data: address, error: null });
    } catch (error) {
      next(error);
    }
  }

  async deleteAddress(req, res, next) {
    try {
      const tenantId = req.tenant.id;
      const { id } = req.params;
      await pickupAddressService.deleteAddress(tenantId, id);
      res.status(200).json({ success: true, data: null, error: null });
    } catch (error) {
      if (error.code === 'DEFAULT_ADDRESS_REQUIRED') {
        return res.status(409).json({ success: false, error: { code: error.code, message: error.message } });
      }
      next(error);
    }
  }
}

module.exports = new PickupAddressController();
