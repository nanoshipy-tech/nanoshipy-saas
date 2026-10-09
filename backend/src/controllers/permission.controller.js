const permissionService = require('../services/permission.service');
const { success } = require('../utils/apiResponse');

const getPermissions = async (req, res, next) => {
  try {
    const result = await permissionService.getPermissionCatalogue();
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPermissions,
};
