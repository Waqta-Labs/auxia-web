import { useQuery } from '@tanstack/react-query';
import { env } from '@shared/infrastructure/config/env.js';
import { Role } from '../../domain/enums/role.js';
import { userRepository } from '../../infrastructure/container.js';
import { useAuth } from './useAuth.js';

// Datos del usuario: lo que dice la sesión, completado con GET /users/me cuando se usa el backend real.
export function useUserProfile() {
  const { session } = useAuth();
  const query = useQuery({
    queryKey: ['userProfile', session.token],
    queryFn: () => userRepository.getMe(),
    enabled: !env.useMocks,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  // Solo la cuenta de una brigada de campo tiene brigada y misiones.
  const brigadeQuery = useQuery({
    queryKey: ['myBrigade', session.token],
    queryFn: () => userRepository.getMyBrigade(),
    enabled: !env.useMocks && session.role === Role.FIELD_BRIGADE,
    retry: false,
    staleTime: 60 * 1000,
  });
  const remote = query.data ?? {};
  return {
    name: remote.name ?? session.displayName ?? null,
    email: remote.email ?? null,
    status: remote.status ?? null,
    lastLoginAt: remote.lastLoginAt ?? null,
    role: session.role,
    expiresAt: session.expiresAt,
    brigade: brigadeQuery.data ?? null,
    isLoading: query.isLoading,
  };
}
