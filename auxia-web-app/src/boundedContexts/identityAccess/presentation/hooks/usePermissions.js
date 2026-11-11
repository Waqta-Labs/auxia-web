import { useAuth } from './useAuth.js';
import { Role } from '../../domain/enums/role.js';

// Qué puede hacer el usuario según su rol. AUDITOR solo consulta.
export function usePermissions() {
  const { session } = useAuth();
  const role = session?.role ?? null;
  return {
    role,
    isAuthority: role === Role.AUTHORITY,
    isAdmin: role === Role.ORGANIZATION_ADMIN,
  };
}
