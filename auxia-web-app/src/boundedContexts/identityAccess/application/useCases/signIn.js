export class SignIn {
  constructor(authRepository) {
    this.authRepository = authRepository;
  }

  async execute({ email, password }) {
    if (!email?.trim() || !password) throw new Error('credentialsRequired');
    return this.authRepository.signIn({ email: email.trim(), password });
  }
}
