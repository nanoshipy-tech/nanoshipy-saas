const { PickupAddress, Tenant, sequelize } = require('../models');
const { Op } = require('sequelize');
const companyProfileService = require('./companyProfile.service');
const auditService = require('./audit.service');

class PickupAddressService {
  async getAddresses(tenantId, query) {
    const { page = 1, limit = 20, search, city, state, is_default, sort = 'created_at:desc' } = query;
    const offset = (page - 1) * limit;

    const whereClause = { tenant_id: tenantId, is_active: true };

    if (city) whereClause.city = city;
    if (state) whereClause.state = state;
    if (is_default !== undefined) whereClause.is_default = is_default === 'true';

    // Basic search across label, contact_name, city
    if (search) {
      const likeOp = Op.iLike && process.env.USE_SQLITE !== 'true' ? Op.iLike : Op.like;
      whereClause[Op.or] = [
        { label: { [likeOp]: `%${search}%` } },
        { contact_name: { [likeOp]: `%${search}%` } },
        { city: { [likeOp]: `%${search}%` } },
      ];
    }

    const [sortField, sortOrder] = sort.split(':');
    const order = [[sortField || 'created_at', (sortOrder || 'DESC').toUpperCase()]];

    const { rows, count } = await PickupAddress.findAndCountAll({
      where: whereClause,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      order,
    });

    return {
      addresses: rows,
      total: count,
      page: parseInt(page, 10),
      totalPages: Math.ceil(count / limit),
    };
  }

  async getAddressById(tenantId, id) {
    const address = await PickupAddress.findOne({
      where: { id, tenant_id: tenantId, is_active: true }
    });
    if (!address) throw new Error('Address not found');
    return address;
  }

  async createAddress(tenantId, data) {
    let createdAddress;
    
    await sequelize.transaction(async (t) => {
      // Check if this is the first address. If so, force is_default = true
      const existingCount = await PickupAddress.count({
        where: { tenant_id: tenantId, is_active: true },
        transaction: t,
      });

      let isDefault = data.is_default;
      if (existingCount === 0) {
        isDefault = true;
      } else if (isDefault) {
        // Unset other default
        await PickupAddress.update(
          { is_default: false },
          { where: { tenant_id: tenantId, is_default: true, is_active: true }, transaction: t }
        );
      }

      const validAddressSources = ['manual', 'pincode_lookup', 'google_autocomplete'];
      const sanitizedAddressSource = validAddressSources.includes(data.address_source)
        ? data.address_source
        : 'manual';

      createdAddress = await PickupAddress.create({
        ...data,
        address_source: sanitizedAddressSource,
        tenant_id: tenantId,
        is_default: isDefault,
      }, { transaction: t });
    });

    // Re-evaluate tenant profile completion
    await companyProfileService.evaluateProfileCompletion(tenantId);

    await auditService.log({
      action: 'address_created',
      tenant_id: tenantId,
      entity_type: 'pickup_address',
      entity_id: createdAddress.id,
      metadata: { label: createdAddress.label }
    });

    return createdAddress;
  }

  async updateAddress(tenantId, id, data) {
    let updatedAddress;

    await sequelize.transaction(async (t) => {
      const address = await PickupAddress.findOne({
        where: { id, tenant_id: tenantId, is_active: true },
        transaction: t,
      });

      if (!address) throw new Error('Address not found');

      if (data.is_default && !address.is_default) {
        // Unset previous default
        await PickupAddress.update(
          { is_default: false },
          { where: { tenant_id: tenantId, is_default: true, is_active: true }, transaction: t }
        );
      } else if (data.is_default === false && address.is_default) {
        const error = new Error('Set another address as default before removing the default status from this one');
        error.code = 'DEFAULT_ADDRESS_REQUIRED';
        throw error;
      }

      const updatePayload = { ...data };
      if (updatePayload.address_source !== undefined) {
        const validAddressSources = ['manual', 'pincode_lookup', 'google_autocomplete'];
        updatePayload.address_source = validAddressSources.includes(updatePayload.address_source)
          ? updatePayload.address_source
          : 'manual';
      }

      updatedAddress = await address.update(updatePayload, { transaction: t });
    });

    await auditService.log({
      action: 'address_updated',
      tenant_id: tenantId,
      entity_type: 'pickup_address',
      entity_id: updatedAddress.id,
      metadata: { label: updatedAddress.label }
    });

    return updatedAddress;
  }

  async setDefault(tenantId, id) {
    let updatedAddress;

    await sequelize.transaction(async (t) => {
      const address = await PickupAddress.findOne({
        where: { id, tenant_id: tenantId, is_active: true },
        transaction: t,
      });

      if (!address) throw new Error('Address not found');

      if (!address.is_default) {
        // Unset previous default
        await PickupAddress.update(
          { is_default: false },
          { where: { tenant_id: tenantId, is_default: true, is_active: true }, transaction: t }
        );
        updatedAddress = await address.update({ is_default: true }, { transaction: t });
      } else {
        updatedAddress = address;
      }
    });

    return updatedAddress;
  }

  async deleteAddress(tenantId, id) {
    await sequelize.transaction(async (t) => {
      const address = await PickupAddress.findOne({
        where: { id, tenant_id: tenantId, is_active: true },
        transaction: t,
      });

      if (!address) throw new Error('Address not found');

      if (address.is_default) {
        const error = new Error('Set another address as default before deleting this one');
        error.code = 'DEFAULT_ADDRESS_REQUIRED';
        throw error;
      }

      // Soft delete
      await address.update({ is_active: false }, { transaction: t });
    });

    // Re-evaluate tenant profile completion
    await companyProfileService.evaluateProfileCompletion(tenantId);

    await auditService.log({
      action: 'address_deleted',
      tenant_id: tenantId,
      entity_type: 'pickup_address',
      entity_id: id,
    });
  }
}

module.exports = new PickupAddressService();
