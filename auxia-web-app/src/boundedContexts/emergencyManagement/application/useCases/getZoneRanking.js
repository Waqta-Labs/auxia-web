export class GetZoneRanking {
  constructor(zoneRepository) {
    this.zoneRepository = zoneRepository;
  }

  // Prioridad manual primero, luego mayor Urgency Score; sin puntaje al final.
  async execute(emergencyId) {
    const zones = await this.zoneRepository.findRanking(emergencyId);
    return [...zones].sort((a, b) => {
      if (a.manualPriority !== b.manualPriority) return a.manualPriority ? -1 : 1;
      return (b.urgencyScore ?? -1) - (a.urgencyScore ?? -1);
    });
  }
}
