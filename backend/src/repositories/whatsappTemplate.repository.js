'use strict';

const { WhatsappTemplate } = require('../models');

class WhatsappTemplateRepository {
  async create(data, transaction) {
    return WhatsappTemplate.create(data, { transaction });
  }

  async findById(id) {
    return WhatsappTemplate.findByPk(id);
  }

  async findByName(name) {
    return WhatsappTemplate.findOne({ where: { name } });
  }

  async list(options = {}) {
    return WhatsappTemplate.findAndCountAll({
      order: [['created_at', 'DESC']],
      ...options,
    });
  }

  async update(id, updates, transaction) {
    const template = await WhatsappTemplate.findByPk(id);
    if (!template) return null;
    return template.update(updates, { transaction });
  }

  async delete(id, transaction) {
    const template = await WhatsappTemplate.findByPk(id);
    if (!template) return false;
    await template.destroy({ transaction });
    return true;
  }
}

module.exports = new WhatsappTemplateRepository();
