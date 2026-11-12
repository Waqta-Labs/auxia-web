import { UserRepository } from '../../domain/repositories/userRepository.js';
import { httpClient } from '@shared/infrastructure/http/httpClient.js';
import { parseUtc } from '@shared/utils/formatters.js';

export class UserHttpRepository extends UserRepository {
  // GET /users/me -> { id, organizationId, email, firstName, lastName, role, status, lastLoginAt }
  async getMe() {
    const { data } = await httpClient.get('/users/me');
    return {
      name: [data.firstName, data.lastName].filter(Boolean).join(' ') || null,
      email: data.email ?? null,
      status: data.status ?? null,
      lastLoginAt: parseUtc(data.lastLoginAt),
    };
  }

  // GET /me/missions -> { brigadeId, brigadeName, missions: [{ status: ASSIGNED | COMPLETED, ... }] }
  async getMyBrigade() {
    const { data } = await httpClient.get('/me/missions');
    const missions = data.missions ?? [];
    return {
      name: data.brigadeName ?? null,
      assigned: missions.filter((mission) => mission.status === 'ASSIGNED').length,
      completed: missions.filter((mission) => mission.status === 'COMPLETED').length,
    };
  }
}
