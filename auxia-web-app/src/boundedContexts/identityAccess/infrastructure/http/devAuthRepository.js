import { AuthRepository } from '../../domain/repositories/authRepository.js';
import { AuthSession } from '../../domain/entities/AuthSession.js';
import { Role } from '../../domain/enums/role.js';

// ⚠ ACCESO DE DESARROLLO ("backdoor"): solo se activa con "npm run dev" (import.meta.env.DEV).
// Cualquier otra credencial se delega al repositorio real. Borrar este archivo y su uso en
// container.js cuando el login contra el backend sea el único camino.
const DEV_USER = 'jane.doe';
const DEV_PASSWORD = '123456';
const DEV_SESSION_MS = 8 * 60 * 60 * 1000;

export class DevAuthRepository extends AuthRepository {
  constructor(realRepository) {
    super();
    this.realRepository = realRepository;
  }

  async signIn({ email, password }) {
    if (email.toLowerCase() === DEV_USER && password === DEV_PASSWORD) {
      return new AuthSession({
        token: 'dev-token',
        expiresAt: Date.now() + DEV_SESSION_MS,
        role: Role.AUTHORITY,
        organizationId: 'dev-organization',
        displayName: 'Jane Doe',
        organizationName: 'Defensa Civil',
      });
    }
    return this.realRepository.signIn({ email, password });
  }
}
