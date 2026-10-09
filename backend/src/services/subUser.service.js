'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const subUserRepository = require('../repositories/subUser.repository');
const { SubUser } = require('../models');
const { NotFoundError, BadRequestError, InviteTokenExpiredError } = require('../utils/errors');
const emailService = require('./email.service');
const logger = require('../utils/logger');

const INVITE_TOKEN_EXPIRY_HOURS = parseInt(process.env.SUB_USER_INVITE_EXPIRY_HOURS, 10) || 48;

class SubUserService {
  /**
   * Invite a sub-user by sending them an email with a signup link.
   */
  async inviteSubUser(tenantId, invitedBy, { email, name, permissions }) {
    // Check if sub-user with this email already exists under this tenant
    const existing = await subUserRepository.findByEmail(email);
    if (existing && existing.seller_id === tenantId) {
      throw new BadRequestError('A sub-user with this email already exists for your account.');
    }

    // Generate invite token (32-byte random hex)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(rawToken, 10);
    const expiresAt = new Date(Date.now() + INVITE_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    const subUser = await subUserRepository.create({
      seller_id: tenantId,
      email,
      name,
      permissions: permissions || ['orders.view', 'shipments.view'],
      invite_token_hash: tokenHash,
      invite_expires_at: expiresAt,
      invited_by: invitedBy,
      status: 'pending',
    });

    // Send invite email
    const inviteLink = `${process.env.FRONTEND_URL || 'https://app.yourdomain.com'}/accept-invite?token=${rawToken}&sub_user_id=${subUser.id}`;
    await emailService.sendEmail({
      to: email,
      subject: 'You have been invited to join as a team member',
      html: `<p>Hi ${name},</p><p>You have been invited to join as a sub-user. Click the link below to accept:</p><a href="${inviteLink}">${inviteLink}</a><p>This link expires in ${INVITE_TOKEN_EXPIRY_HOURS} hours.</p>`,
    });

    logger.info(`[SubUserService] Invite sent to ${email} for tenant ${tenantId}`);
    return { sub_user: subUser, invite_link: inviteLink };
  }

  /**
   * Accept an invite — sub-user sets their password.
   */
  async acceptInvite(subUserId, rawToken, password) {
    const subUser = await subUserRepository.findById(subUserId);
    if (!subUser) throw new NotFoundError('Sub-user invitation not found.');

    if (subUser.status !== 'pending') {
      throw new BadRequestError('This invitation has already been accepted or is no longer valid.');
    }

    // Verify token
    const isValid = await bcrypt.compare(rawToken, subUser.invite_token_hash);
    if (!isValid) throw new InviteTokenExpiredError('Invalid or expired invitation token.');

    // Check expiry
    if (new Date() > new Date(subUser.invite_expires_at)) {
      throw new InviteTokenExpiredError('Your invitation link has expired. Please request a new invite.');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const accepted = await subUser.update({
      password_hash: passwordHash,
      status: 'active',
      invite_token_hash: null,
      invite_expires_at: null,
      accepted_at: new Date(),
    });

    logger.info(`[SubUserService] Sub-user ${subUserId} accepted invite.`);
    return accepted;
  }

  /**
   * Update sub-user permissions.
   */
  async updatePermissions(tenantId, id, permissions) {
    const subUser = await subUserRepository.update(id, tenantId, { permissions });
    if (!subUser) throw new NotFoundError('Sub-user not found.');
    return subUser;
  }

  /**
   * Revoke / deactivate a sub-user.
   */
  async revokeSubUser(tenantId, id) {
    const subUser = await subUserRepository.update(id, tenantId, { status: 'revoked' });
    if (!subUser) throw new NotFoundError('Sub-user not found.');
    return subUser;
  }

  async listSubUsers(tenantId) {
    return subUserRepository.list(tenantId);
  }

  async getSubUser(tenantId, id) {
    return subUserRepository.findById(id, tenantId);
  }

  /**
   * Authenticate a sub-user (used in sub-user login flow).
   */
  async authenticate(email, password) {
    const subUser = await subUserRepository.findByEmail(email);
    if (!subUser || subUser.status !== 'active') return null;

    const match = await bcrypt.compare(password, subUser.password_hash);
    if (!match) return null;

    return subUser;
  }
}

module.exports = new SubUserService();
