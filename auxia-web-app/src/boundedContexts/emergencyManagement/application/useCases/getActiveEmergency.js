export class GetActiveEmergency {
  constructor(emergencyRepository) {
    this.emergencyRepository = emergencyRepository;
  }

  // La emergencia en curso es la activa más reciente; null si no hay ninguna.
  async execute() {
    const active = await this.emergencyRepository.findActive();
    return active[0] ?? null;
  }
}
