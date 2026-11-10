import { AuthHttpRepository } from './http/authHttpRepository.js';
import { SignIn } from '../application/useCases/signIn.js';

const authRepository = new AuthHttpRepository();

export const signInUseCase = new SignIn(authRepository);
