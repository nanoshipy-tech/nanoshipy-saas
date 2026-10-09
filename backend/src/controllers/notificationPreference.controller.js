'use strict';

const notificationPreferenceService = require('../services/notificationPreference.service');
const { success } = require('../utils/apiResponse');

async function getPreferences(req, res, next) {
  try {
    const tenantId = req.user.tenant_id;
    // We check user_id if they want user level preferences (e.g. user specific overrides)
    // For simplicity, we default to tenant wide preference setup
    const prefs = await notificationPreferenceService.getPreferences(tenantId, null);
    return success(res, prefs);
  } catch (err) {
    next(err);
  }
}

async function updatePreferences(req, res, next) {
  try {
    const tenantId = req.user.tenant_id;
    const { preferences } = req.body;

    const result = await notificationPreferenceService.updatePreferences(
      tenantId,
      null,
      preferences
    );

    return success(res, result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPreferences,
  updatePreferences,
};
