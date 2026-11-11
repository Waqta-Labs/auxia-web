export class GetZoneRanking {
  constructor(zoneRepository) {
    this.zoneRepository = zoneRepository;
  }

  // Prioridad manual primero, luego mayor Urgency Score (sin puntaje al final).
  //  - explainTop: a las primeras N zonas se les pide además el porqué de su score.
  //  - withPosition: false evita pedir las coordenadas (una petición por zona) cuando no hacen falta.
  async execute(emergencyId, { explainTop = 0, withPosition = true } = {}) {
    const zones = await this.zoneRepository.findRanking(emergencyId, { withPosition });
    const sorted = [...zones].sort((a, b) => {
      if (a.manualPriority !== b.manualPriority) return a.manualPriority ? -1 : 1;
      return (b.urgencyScore ?? -1) - (a.urgencyScore ?? -1);
    });

    return Promise.all(
      sorted.map(async (zone, index) => {
        if (index >= explainTop) return zone;
        try {
          const explanation = await this.zoneRepository.findScoreExplanation(zone.id);
          return explanation.features.length > 0 ? zone.withReasons(explanation.features) : zone;
        } catch {
          return zone; // la explicación es opcional: el tablero sigue sin ella
        }
      }),
    );
  }
}
