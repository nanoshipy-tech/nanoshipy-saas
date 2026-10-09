const impersonationService = require('../services/impersonation.service');
const { success } = require('../utils/apiResponse');

const startImpersonation = async (req, res, next) => {
  try {
    const { tenantId } = req.params;
    const { reason } = req.body;
    const adminId = req.platformAdmin.id;
    const adminRole = req.platformAdmin.role;
    const ipAddress = req.ip;

    const result = await impersonationService.startImpersonation(adminId, adminRole, tenantId, reason, ipAddress);

    return success(res, result, 200);
  } catch (error) {
    next(error);
  }
};

const endImpersonation = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const adminId = req.platformAdmin.id;
    const ipAddress = req.ip;

    await impersonationService.endImpersonation(adminId, sessionId, ipAddress);

    return success(res, null, 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  startImpersonation,
  endImpersonation,
};
