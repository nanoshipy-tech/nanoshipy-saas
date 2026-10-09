'use strict';

const subUserService = require('../services/subUser.service');
const { success } = require('../utils/apiResponse');

const inviteSubUser = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const invitedBy = req.user.id;
    const result = await subUserService.inviteSubUser(tenantId, invitedBy, req.body);
    return success(res, result, 201);
  } catch (err) {
    next(err);
  }
};

const acceptInvite = async (req, res, next) => {
  try {
    const { sub_user_id, token, password } = req.body;
    const subUser = await subUserService.acceptInvite(sub_user_id, token, password);
    return success(res, { message: 'Invitation accepted. You can now log in.', sub_user: subUser });
  } catch (err) {
    next(err);
  }
};

const listSubUsers = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const list = await subUserService.listSubUsers(tenantId);
    return success(res, list);
  } catch (err) {
    next(err);
  }
};

const getSubUser = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;
    const subUser = await subUserService.getSubUser(tenantId, id);
    if (!subUser) return res.status(404).json({ success: false, error: { message: 'Sub-user not found' } });
    return success(res, subUser);
  } catch (err) {
    next(err);
  }
};

const updatePermissions = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;
    const { permissions } = req.body;
    const subUser = await subUserService.updatePermissions(tenantId, id, permissions);
    return success(res, subUser);
  } catch (err) {
    next(err);
  }
};

const revokeSubUser = async (req, res, next) => {
  try {
    const tenantId = req.tenant.id;
    const { id } = req.params;
    const subUser = await subUserService.revokeSubUser(tenantId, id);
    return success(res, { message: 'Sub-user access revoked.', sub_user: subUser });
  } catch (err) {
    next(err);
  }
};

module.exports = { inviteSubUser, acceptInvite, listSubUsers, getSubUser, updatePermissions, revokeSubUser };
