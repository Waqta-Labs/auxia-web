import { AuthHttpRepository } from './http/authHttpRepository.js';
import { DevAuthRepository } from './http/devAuthRepository.js';
import { SignIn } from '../application/useCases/signIn.js';

const httpRepository = new AuthHttpRepository();
// En desarrollo, jane.doe / 123456 entra sin backend.
const authRepository = import.meta.env.DEV ? new DevAuthRepository(httpRepository) : httpRepository;

export const signInUseCase = new SignIn(authRepository);
