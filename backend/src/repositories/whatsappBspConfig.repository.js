const { WhatsappBspConfig } = require('../models');

const findLatest = async () => WhatsappBspConfig.findOne({ order: [['created_at', 'DESC']] });
const updateById = async (id, data) => WhatsappBspConfig.update(data, { where: { id } });
module.exports = { findLatest, updateById };
