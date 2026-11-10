import { AuthRepository } from '../../domain/repositories/authRepository.js';
import { httpClient } from '@shared/infrastructure/http/httpClient.js';
import { toAuthSession } from '../mappers/authMapper.js';

export class AuthHttpRepository extends AuthRepository {
  async signIn({ email, password }) {
    try {
      const { data } = await httpClient.post('/auth/sign-in', { email, password });
      return toAuthSession(data);
    } catch (error) {
      const status = error.response?.status;
      // El backend responde 401 con el mismo mensaje ante cualquier fallo (no revela la causa).
      if (status === 423 || status === 429) throw new Error('accountLocked');
      if (status === 400 || status === 401 || status === 403) throw new Error('invalidCredentials');
      throw new Error('networkError');
    }
  }
}
