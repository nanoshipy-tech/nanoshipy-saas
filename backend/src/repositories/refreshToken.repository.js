const { Op } = require('sequelize');
const { RefreshToken } = require('../models');

const create = async (tokenData) => {
  return RefreshToken.create(tokenData);
};

const findByHash = async (token_hash) => {
  return RefreshToken.findOne({ where: { token_hash } });
};

const revoke = async (id) => {
  return RefreshToken.update(
    { revoked_at: new Date() },
    { where: { id } }
  );
};

const revokeFamily = async (user_id) => {
  return RefreshToken.update(
    { revoked_at: new Date() },
    { 
      where: { 
        user_id,
        revoked_at: null 
      } 
    }
  );
};

const deleteExpired = async () => {
  return RefreshToken.destroy({
    where: {
      expires_at: {
        [Op.lt]: new Date(),
      }
    }
  });
};

module.exports = {
  create,
  findByHash,
  revoke,
  revokeFamily,
  deleteExpired,
};
