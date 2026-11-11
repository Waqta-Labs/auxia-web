export class GetZonePriorityDetail {
  constructor(zoneRepository) {
    this.zoneRepository = zoneRepository;
  }

  // La zona es obligatoria; la explicación del score es opcional (null si no se pudo cargar).
  async execute(zoneId) {
    const [zone, explanation] = await Promise.allSettled([
      this.zoneRepository.findDetail(zoneId),
      this.zoneRepository.findScoreExplanation(zoneId),
    ]);
    if (zone.status === 'rejected') throw zone.reason;
    return { zone: zone.value, explanation: explanation.status === 'fulfilled' ? explanation.value : null };
  }
}
