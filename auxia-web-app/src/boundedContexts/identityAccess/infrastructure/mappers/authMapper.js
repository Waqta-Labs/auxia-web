import { AuthSession } from '../../domain/entities/AuthSession.js';

// Ajustar los nombres de campo si el Swagger del backend difiere.
export function toAuthSession(dto) {
  const parsed = dto.expiresAt ? new Date(dto.expiresAt).getTime() : NaN;
  return new AuthSession({
    token: dto.token ?? dto.accessToken,
    expiresAt: Number.isNaN(parsed) ? null : parsed,
    role: dto.role,
    organizationId: dto.organizationId,
  });
}
