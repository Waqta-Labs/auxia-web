export class OverrideZoneScore {
  constructor(zoneRepository) {
    this.zoneRepository = zoneRepository;
  }

  // Anula el score con una prioridad manual: la justificación es obligatoria (US-07).
  async execute({ zoneId, reason }) {
    const justification = (reason ?? '').trim();
    if (!justification) throw new Error('reasonRequired');
    return this.zoneRepository.setManualPriority(zoneId, justification);
  }
}
