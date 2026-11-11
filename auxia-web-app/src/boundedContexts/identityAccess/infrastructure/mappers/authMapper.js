import { AuthSession } from '../../domain/entities/AuthSession.js';
import { parseUtc } from '@shared/utils/formatters.js';

// POST /auth/sign-in -> { token, tokenType, expiresAt, userId, organizationId, role, fullName }
export function toAuthSession(dto) {
  return new AuthSession({
    token: dto.token,
    expiresAt: parseUtc(dto.expiresAt),
    role: dto.role,
    organizationId: dto.organizationId,
    displayName: dto.fullName ?? null,
  });
}
