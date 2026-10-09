const platformAuthService = require('../services/platformAuth.service');
const { success } = require('../utils/apiResponse');
const logger = require('../utils/logger');

const getPlatformCookieOptions = (maxAgeMs = 7 * 24 * 60 * 60 * 1000) => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    domain: isProd ? '.nanoshipy.com' : undefined,
    path: '/',
    maxAge: maxAgeMs,
  };
};

const getClearPlatformCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    domain: isProd ? '.nanoshipy.com' : undefined,
    path: '/',
  };
};

const sendOtp = async (req, res, next) => {
  try {
    const { email, phone } = req.body;
    const result = await platformAuthService.sendOtp({ email, phone });
    return success(res, result, 200);
  } catch (error) {
    next(error);
  }
};

const loginWithOtp = async (req, res, next) => {
  try {
    const { email, phone, otp } = req.body;
    const ipAddress = req.ip;
    const result = await platformAuthService.loginWithOtp({ email, phone, otp, ipAddress });

    if (result.refreshToken) {
      res.cookie('platform_refresh_token', result.refreshToken, getPlatformCookieOptions());
    }

    return success(res, {
      admin: result.admin,
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
    }, 200);
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, phone, password, otp } = req.body;
    const ipAddress = req.ip;

    if (otp) {
      const result = await platformAuthService.loginWithOtp({ email, phone, otp, ipAddress });
      if (result.refreshToken) {
        res.cookie('platform_refresh_token', result.refreshToken, getPlatformCookieOptions());
      }
      return success(res, {
        admin: result.admin,
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
      }, 200);
    }

    const result = await platformAuthService.login(email, password, ipAddress);

    if (result.requires_2fa) {
      return success(res, result, 200);
    }

    // Set refresh token in HttpOnly cookie
    if (result.refreshToken) {
      res.cookie('platform_refresh_token', result.refreshToken, getPlatformCookieOptions());
    }

    return success(res, {
      admin: result.admin,
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
    }, 200);
  } catch (error) {
    next(error);
  }
};

const verify2FA = async (req, res, next) => {
  try {
    const { token } = req.body;
    const adminId = req.platformAdmin.id; // from temp token middleware
    const ipAddress = req.ip;

    const result = await platformAuthService.verify2FA(adminId, token, ipAddress);

    if (result.refreshToken) {
      res.cookie('platform_refresh_token', result.refreshToken, getPlatformCookieOptions());
    }

    return success(res, {
      admin: result.admin,
      access_token: result.accessToken,
    }, 200);
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    const token = req.cookies?.platform_refresh_token || req.body?.platform_refresh_token || req.body?.refresh_token;
    const adminId = req.platformAdmin?.id || req.user?.id;
    const ipAddress = req.ip;

    await platformAuthService.logout(token, adminId, ipAddress);

    res.clearCookie('platform_refresh_token', getClearPlatformCookieOptions());
    res.clearCookie('platform_refresh_token', { path: '/' });
    return success(res, { message: 'Logged out successfully' }, 200);
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    const admin = req.platformAdmin;
    return success(res, admin, 200);
  } catch (error) {
    next(error);
  }
};

const listAdmins = async (req, res, next) => {
  try {
    const { PlatformAdmin, PlatformRole } = require('../models');
    const admins = await PlatformAdmin.findAll({
      attributes: ['id', 'name', 'email', 'role', 'status', 'created_at', 'custom_role_id'],
      include: [
        {
          model: PlatformRole,
          as: 'customRole',
          attributes: ['id', 'name', 'display_name'],
          required: false,
        },
      ],
      order: [['created_at', 'DESC']],
    });
    return success(res, admins, 200);
  } catch (error) {
    next(error);
  }
};

const createAdmin = async (req, res, next) => {
  try {
    const { PlatformAdmin, PlatformRole } = require('../models');
    const bcrypt = require('bcrypt');
    const { email, name, role = 'platform_staff', custom_role_id } = req.body;

    if (!email || !name) {
      return res.status(400).json({ success: false, error: { message: 'Name and email are required' } });
    }

    const existing = await PlatformAdmin.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ success: false, error: { message: 'Platform admin with this email already exists' } });
    }

    let assignedRole = role;
    let validCustomRoleId = null;
    if (custom_role_id) {
      const cRole = await PlatformRole.findByPk(custom_role_id);
      if (cRole) {
        validCustomRoleId = cRole.id;
        assignedRole = cRole.name;
      }
    }

    const tempPassword = `Admin@${Math.random().toString(36).substring(2, 8).toUpperCase()}!`;
    const password_hash = await bcrypt.hash(tempPassword, 10);

    const admin = await PlatformAdmin.create({
      id: require('uuid').v4(),
      name,
      email,
      password_hash,
      role: assignedRole,
      custom_role_id: validCustomRoleId,
      status: 'active',
      created_by: req.platformAdmin?.id || null,
    });

    const { logAdminAction } = require('../utils/adminAudit.helper');
    await logAdminAction({
      adminId: req.platformAdmin?.id,
      action: 'platform_admin_created',
      entityType: 'platform_admin',
      entityId: admin.id,
      metadata: { email: admin.email, role: admin.role, custom_role_id: admin.custom_role_id },
      ipAddress: req.ip,
    });

    return success(res, {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      custom_role_id: admin.custom_role_id,
      status: admin.status,
      created_at: admin.created_at,
      temp_password: tempPassword,
    }, 201);
  } catch (error) {
    next(error);
  }
};

const updateAdminRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, custom_role_id } = req.body;
    const { PlatformAdmin, PlatformRole } = require('../models');
    const { logAdminAction } = require('../utils/adminAudit.helper');
    const { getRedisClient } = require('../config/redis.config');

    // Only super_admin can change roles
    if (req.platformAdmin?.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: { message: 'Only super_admin can update admin roles' } });
    }

    const admin = await PlatformAdmin.findByPk(id);
    if (!admin) {
      return res.status(404).json({ success: false, error: { message: 'Platform admin not found' } });
    }

    let newRole = role || admin.role;
    let newCustomRoleId = admin.custom_role_id;

    if (custom_role_id !== undefined) {
      if (custom_role_id === null || custom_role_id === '') {
        newCustomRoleId = null;
      } else {
        const cRole = await PlatformRole.findByPk(custom_role_id);
        if (cRole) {
          newCustomRoleId = cRole.id;
          newRole = cRole.name;
        }
      }
    }

    const oldRole = admin.role;
    await admin.update({ role: newRole, custom_role_id: newCustomRoleId });

    // Invalidate Redis permissions cache for this admin
    const redis = getRedisClient();
    if (redis) {
      await redis.del(`platform_perm:${admin.id}`);
    }

    await logAdminAction({
      adminId: req.platformAdmin?.id,
      action: 'platform_admin_role_updated',
      entityType: 'platform_admin',
      entityId: admin.id,
      metadata: { old_role: oldRole, new_role: newRole, custom_role_id: newCustomRoleId, target_email: admin.email },
      ipAddress: req.ip,
    });

    return success(res, {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      custom_role_id: admin.custom_role_id,
      status: admin.status,
    }, 200);
  } catch (error) {
    next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.platform_refresh_token || req.body?.platform_refresh_token || req.body?.refresh_token;
    const ipAddress = req.ip;

    if (!refreshToken) {
      return res.status(200).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'No refresh token provided' } });
    }

    const result = await platformAuthService.refresh(refreshToken, ipAddress);

    if (result.refreshToken) {
      res.cookie('platform_refresh_token', result.refreshToken, getPlatformCookieOptions());
    }

    return success(res, {
      admin: result.admin,
      access_token: result.accessToken,
      refresh_token: result.refreshToken,
    }, 200);
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: { message: 'Email is required' } });
    }

    const { PlatformAdmin } = require('../models');
    const cleanEmail = String(email).toLowerCase().trim();
    const admin = await PlatformAdmin.findOne({ where: { email: cleanEmail } });

    if (admin && admin.status === 'active') {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const { getRedisClient } = require('../config/redis.config');
      const redis = getRedisClient();
      if (redis) {
        try {
          await redis.set(`admin_pwd_reset_otp:${cleanEmail}`, otp, 'EX', 600);
          logger.info(`[PlatformAuth] Admin password reset OTP cached in Redis for ${cleanEmail}`);
        } catch (rErr) {
          logger.warn(`[PlatformAuth] Redis error: ${rErr.message}`);
        }
      }

      // Dispatch Email via SMTP
      const emailService = require('../services/email.service');
      try {
        await emailService.sendEmail({
          to: cleanEmail,
          subject: `Nanoshipy Superadmin Password Reset Code: ${otp}`,
          htmlBody: `
            <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h2 style="color: #7c3aed; margin-top: 0;">Nanoshipy Admin Console</h2>
              <p>Hello ${admin.name || 'Admin'},</p>
              <p>A request was received to reset your platform admin password. Your 6-digit security code is:</p>
              <div style="background: #f5f3ff; border: 2px dashed #8b5cf6; border-radius: 8px; text-align: center; padding: 16px; margin: 20px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #6d28d9;">${otp}</span>
              </div>
              <p style="font-size: 13px; color: #64748b;">This code expires in 10 minutes. If you did not make this request, please alert the security team immediately.</p>
            </div>
          `,
        });
      } catch (mErr) {
        logger.error(`[PlatformAuth] Failed to send admin reset email: ${mErr.message}`);
      }
    }

    return success(res, {
      message: 'If an active platform admin account exists for this email address, password reset instructions have been dispatched.'
    }, 200);
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, new_password } = req.body;
    if (!email || !otp || !new_password) {
      return res.status(400).json({ success: false, error: { message: 'Email, OTP, and new password are required' } });
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const { getRedisClient } = require('../config/redis.config');
    const redis = getRedisClient();
    let valid = false;

    if (redis) {
      const cached = await redis.get(`admin_pwd_reset_otp:${cleanEmail}`);
      if (cached && String(cached).trim() === String(otp).trim()) {
        valid = true;
        await redis.del(`admin_pwd_reset_otp:${cleanEmail}`).catch(() => {});
      }
    }

    if (!valid) {
      return res.status(400).json({ success: false, error: { message: 'Invalid or expired OTP code' } });
    }

    const { PlatformAdmin, PlatformRefreshToken } = require('../models');
    const bcrypt = require('bcrypt');
    const admin = await PlatformAdmin.findOne({ where: { email: cleanEmail } });
    if (!admin) {
      return res.status(404).json({ success: false, error: { message: 'Platform admin not found' } });
    }

    const password_hash = await bcrypt.hash(new_password, 10);
    const nextVersion = (admin.token_version || 1) + 1;
    await admin.update({ password_hash, token_version: nextVersion });

    await PlatformRefreshToken.update(
      { revoked_at: new Date() },
      { where: { admin_id: admin.id, revoked_at: null } }
    ).catch(() => {});

    if (redis) {
      await redis.del(`platform_perm:${admin.id}`).catch(() => {});
    }

    const { logAdminAction } = require('../utils/adminAudit.helper');
    await logAdminAction({
      adminId: admin.id,
      action: 'platform_admin_self_password_reset',
      entityType: 'platform_admin',
      entityId: admin.id,
      metadata: { target_email: admin.email },
      ipAddress: req.ip,
    });

    return success(res, { message: 'Password reset successfully. You may now log in.' });
  } catch (error) {
    next(error);
  }
};

const updateAdminStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const { PlatformAdmin } = require('../models');
    const { logAdminAction } = require('../utils/adminAudit.helper');

    if (req.platformAdmin?.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: { message: 'Only super_admin can change admin status' } });
    }

    if (!['active', 'disabled'].includes(status)) {
      return res.status(400).json({ success: false, error: { message: 'Status must be active or disabled' } });
    }

    const admin = await PlatformAdmin.findByPk(id);
    if (!admin) {
      return res.status(404).json({ success: false, error: { message: 'Platform admin not found' } });
    }

    if (admin.id === req.platformAdmin?.id && status === 'disabled') {
      return res.status(400).json({ success: false, error: { message: 'Cannot disable your own super admin account' } });
    }

    await admin.update({ status });

    await logAdminAction({
      adminId: req.platformAdmin?.id,
      action: 'platform_admin_status_updated',
      entityType: 'platform_admin',
      entityId: admin.id,
      metadata: { new_status: status, target_email: admin.email },
      ipAddress: req.ip,
    });

    return success(res, { id: admin.id, name: admin.name, email: admin.email, role: admin.role, status: admin.status });
  } catch (error) {
    next(error);
  }
};

const resetAdminPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { PlatformAdmin, PlatformRefreshToken } = require('../models');
    const bcrypt = require('bcrypt');
    const { logAdminAction } = require('../utils/adminAudit.helper');

    if (req.platformAdmin?.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: { message: 'Only super_admin can reset admin passwords' } });
    }

    const admin = await PlatformAdmin.findByPk(id);
    if (!admin) {
      return res.status(404).json({ success: false, error: { message: 'Platform admin not found' } });
    }

    const tempPassword = `Admin@${Math.random().toString(36).substring(2, 8).toUpperCase()}!${Math.floor(10 + Math.random() * 90)}`;
    const password_hash = await bcrypt.hash(tempPassword, 10);
    const nextVersion = (admin.token_version || 1) + 1;
    await admin.update({ password_hash, token_version: nextVersion });

    await PlatformRefreshToken.update(
      { revoked_at: new Date() },
      { where: { admin_id: admin.id, revoked_at: null } }
    ).catch(() => {});

    const { getRedisClient } = require('../config/redis.config');
    const redis = getRedisClient();
    if (redis) {
      await redis.del(`platform_perm:${admin.id}`).catch(() => {});
    }

    await logAdminAction({
      adminId: req.platformAdmin?.id,
      action: 'platform_admin_password_reset',
      entityType: 'platform_admin',
      entityId: admin.id,
      metadata: { target_email: admin.email },
      ipAddress: req.ip,
    });

    return success(res, {
      message: 'Password reset successfully',
      temp_password: tempPassword,
    });
  } catch (error) {
    next(error);
  }
};

const deleteAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { PlatformAdmin } = require('../models');
    const { logAdminAction } = require('../utils/adminAudit.helper');

    if (req.platformAdmin?.role !== 'super_admin') {
      return res.status(403).json({ success: false, error: { message: 'Only super_admin can remove admins' } });
    }

    const admin = await PlatformAdmin.findByPk(id);
    if (!admin) {
      return res.status(404).json({ success: false, error: { message: 'Platform admin not found' } });
    }

    if (admin.id === req.platformAdmin?.id) {
      return res.status(400).json({ success: false, error: { message: 'Cannot delete your own account' } });
    }

    await admin.destroy();

    await logAdminAction({
      adminId: req.platformAdmin?.id,
      action: 'platform_admin_deleted',
      entityType: 'platform_admin',
      entityId: id,
      metadata: { target_email: admin.email, name: admin.name },
      ipAddress: req.ip,
    });

    return success(res, { message: 'Platform admin deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  sendOtp,
  loginWithOtp,
  verify2FA,
  logout,
  getMe,
  listAdmins,
  createAdmin,
  updateAdminRole,
  updateAdminStatus,
  resetAdminPassword,
  deleteAdmin,
  refresh,
  forgotPassword,
  resetPassword,
};

