import { useAuth } from './authStore';

function getRoleName(role: any): string {
  if (!role) return '';
  if (typeof role === 'string') return role.toLowerCase();
  if (typeof role === 'object' && role.name) return String(role.name).toLowerCase();
  return '';
}

export const usePermission = (permissionKey?: string): boolean => {
  const { user } = useAuth();

  // If no permission key is requested, permit
  if (!permissionKey) return true;

  // When RBAC is disabled via env flag, permit all authenticated operations
  if (process.env.NEXT_PUBLIC_RBAC_ENABLED === 'false') {
    return true;
  }

  if (!user) return false;

  // Account owner and admin bypass all permission gates
  const userRole = getRoleName(user.role);
  if (['owner', 'admin', 'super_admin'].includes(userRole)) {
    return true;
  }

  const permissions = user.permissions || [];
  if (permissions.includes('*')) return true;
  if (permissions.includes(permissionKey)) return true;

  const domain = permissionKey.split('.')[0];
  if (permissions.includes(`${domain}.*`)) return true;

  return false;
};

export const hasUserPermission = (
  user: { role?: any; permissions?: string[] } | null,
  permissionKey?: string
): boolean => {
  if (!permissionKey) return true;
  if (process.env.NEXT_PUBLIC_RBAC_ENABLED === 'false') return true;
  if (!user) return false;
  const userRole = getRoleName(user.role);
  if (['owner', 'admin', 'super_admin'].includes(userRole)) return true;

  const permissions = user.permissions || [];
  if (permissions.includes('*')) return true;
  if (permissions.includes(permissionKey)) return true;

  const domain = permissionKey.split('.')[0];
  if (permissions.includes(`${domain}.*`)) return true;

  return false;
};
