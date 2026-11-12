import { AuthHttpRepository } from './http/authHttpRepository.js';
import { DevAuthRepository } from './http/devAuthRepository.js';
import { SignIn } from '../application/useCases/signIn.js';
import { env } from '@shared/infrastructure/config/env.js';

const httpRepository = new AuthHttpRepository();
// jane.doe / 123456 solo existe en desarrollo y con datos mock; con el backend real se usa el login real.
const authRepository = import.meta.env.DEV && env.useMocks ? new DevAuthRepository(httpRepository) : httpRepository;

export const signInUseCase = new SignIn(authRepository);

// user-profile
import { UserHttpRepository } from './http/userHttpRepository.js';

export const userRepository = new UserHttpRepository();
