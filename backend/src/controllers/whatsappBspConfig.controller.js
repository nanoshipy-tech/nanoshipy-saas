const whatsappBspConfigService = require('../services/whatsappBspConfig.service');
const { success } = require('../utils/apiResponse');

const getConfig = async (req, res, next) => {
  try {
    const cfg = await whatsappBspConfigService.getConfig();
    return success(res, cfg || { status: 'unconfigured' }, 200);
  } catch (err) { next(err); }
};

const saveConfig = async (req, res, next) => {
  try {
    const adminId = req.platformAdmin.id;
    const { bsp, api_key, webhook_verify_token, webhook_secret, phone_number_id, waba_id } = req.body;
    const cfg = await whatsappBspConfigService.saveConfig(adminId, {
      bsp, apiKey: api_key, webhookVerifyToken: webhook_verify_token,
      webhookSecret: webhook_secret, phoneNumberId: phone_number_id, wabaId: waba_id,
    });
    return success(res, cfg, 200);
  } catch (err) { next(err); }
};

const testConfig = async (req, res, next) => {
  try {
    const result = await whatsappBspConfigService.testExistingConfig(req.platformAdmin.id);
    return success(res, result, 200);
  } catch (err) { next(err); }
};

const disconnectConfig = async (req, res, next) => {
  try {
    await whatsappBspConfigService.disconnectConfig(req.platformAdmin.id);
    return success(res, null, 200);
  } catch (err) { next(err); }
};

module.exports = { getConfig, saveConfig, testConfig, disconnectConfig };
