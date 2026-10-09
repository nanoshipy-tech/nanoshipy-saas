const { ImpersonationSession, Tenant } = require('../models');
const { signImpersonationToken } = require('./token.service');
const platformAuditService = require('./platformAudit.service');
const auditService = require('./audit.service');
const { NotFoundError, ForbiddenError } = require('../utils/errors');

const startImpersonation = async (platformAdminId, adminRole, targetTenantId, reason, ipAddress) => {
  const tenant = await Tenant.findByPk(targetTenantId);
  if (!tenant) {
    throw new NotFoundError('Tenant not found');
  }
  if (tenant.status === 'suspended') {
    throw new ForbiddenError('Cannot impersonate a suspended tenant');
  }

  const session = await ImpersonationSession.create({
    platform_admin_id: platformAdminId,
    target_tenant_id: targetTenantId,
    reason,
    ip_address: ipAddress,
  });

  // Generate scoped tenant token
  const scopedToken = signImpersonationToken({
    user_id: null, // Impersonating the tenant level, not a specific user initially, but let's fake a user_id or use null if middleware allows. Actually, tenant APIs usually expect user_id.
    // We will assign a virtual user_id or pick the owner
    tenant_id: targetTenantId,
    role: 'owner', // Fake owner role
    impersonated_by: platformAdminId,
    impersonator_role: adminRole,
    session_id: session.id,
  });

  // Log in Platform Audit
  await platformAuditService.log({
    platform_admin_id: platformAdminId,
    action: 'impersonation_started',
    target_tenant_id: targetTenantId,
    metadata: { reason, session_id: session.id },
    ip_address: ipAddress,
  });

  // Log in Tenant Audit
  await auditService.log({
    // no user_id since it's the platform admin
    tenant_id: targetTenantId,
    action: 'platform_admin_impersonation',
    metadata: { reason, session_id: session.id, event: 'started' },
    ip_address: ipAddress,
  });

  return {
    impersonation_session_id: session.id,
    scoped_token: scopedToken,
    expires_in: 1800, // 30 mins
    tenant: { id: tenant.id, company_name: tenant.company_name },
  };
};

const endImpersonation = async (platformAdminId, sessionId, ipAddress) => {
  const session = await ImpersonationSession.findOne({
    where: { id: sessionId, platform_admin_id: platformAdminId, ended_at: null }
  });

  if (!session) {
    throw new NotFoundError('Active impersonation session not found');
  }

  session.ended_at = new Date();
  await session.save();

  await platformAuditService.log({
    platform_admin_id: platformAdminId,
    action: 'impersonation_ended',
    target_tenant_id: session.target_tenant_id,
    metadata: { session_id: session.id },
    ip_address: ipAddress,
  });

  await auditService.log({
    tenant_id: session.target_tenant_id,
    action: 'platform_admin_impersonation',
    metadata: { session_id: session.id, event: 'ended' },
    ip_address: ipAddress,
  });
};

const getMerchantImpersonationLogs = async (tenantId) => {
  const sessions = await ImpersonationSession.findAll({
    where: { target_tenant_id: tenantId },
    order: [['started_at', 'DESC']],
    limit: 50,
  });

  return sessions.map((s) => ({
    id: s.id,
    accessed_by: `Nanoshipy Support Engineer (Ref #${s.platform_admin_id ? s.platform_admin_id.slice(0, 8) : 'ADMIN'})`,
    reason: s.reason,
    started_at: s.started_at,
    ended_at: s.ended_at,
    duration_seconds: s.ended_at ? Math.round((new Date(s.ended_at) - new Date(s.started_at)) / 1000) : null,
    status: s.ended_at ? 'completed' : 'active',
  }));
};

module.exports = {
  startImpersonation,
  endImpersonation,
  getMerchantImpersonationLogs,
};
