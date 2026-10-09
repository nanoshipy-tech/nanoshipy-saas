import { useAuth } from './authStore';

export const usePermission = (permissionKey?: string): boolean => {
  const { user } = useAuth();

  // If no specific permission key is requested, permit
  if (!permissionKey) return true;

  // When RBAC is disabled via env flag, permit all authenticated operations
  if (process.env.NEXT_PUBLIC_RBAC_ENABLED === 'false') {
    return true;
  }

  if (!user) return false;

  // Super admin always retains full unrestricted access
  if (user.role === 'super_admin') return true;

  const permissions = user.permissions || [];
  if (permissions.includes('*')) return true;
  if (permissions.includes(permissionKey)) return true;

  const domain = permissionKey.split('.')[0];
  if (permissions.includes(`${domain}.*`)) return true;

  return false;
};

export const hasAdminPermission = (user: { role?: string; permissions?: string[] } | null, permissionKey?: string): boolean => {
  if (!permissionKey) return true;
  if (process.env.NEXT_PUBLIC_RBAC_ENABLED === 'false') return true;
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  const permissions = user.permissions || [];
  if (permissions.includes('*')) return true;
  if (permissions.includes(permissionKey)) return true;
  const domain = permissionKey.split('.')[0];
  if (permissions.includes(`${domain}.*`)) return true;
  return false;
};
