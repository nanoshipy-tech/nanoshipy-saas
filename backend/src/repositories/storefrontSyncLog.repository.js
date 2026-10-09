const { v4: uuidv4 } = require('uuid');
const { StorefrontSyncLog } = require('../models');

const create = async (data) => StorefrontSyncLog.create({ id: uuidv4(), ...data });
const update = async (id, data) => StorefrontSyncLog.update(data, { where: { id } });
const findByConnection = async (connectionId, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  const { count, rows } = await StorefrontSyncLog.findAndCountAll({
    where: { connection_id: connectionId },
    order: [['started_at', 'DESC']],
    limit, offset,
  });
  return { total: count, page, limit, data: rows };
};
module.exports = { create, update, findByConnection };
