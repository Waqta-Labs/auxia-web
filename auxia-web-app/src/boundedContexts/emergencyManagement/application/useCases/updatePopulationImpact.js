import { parseImpact } from '../../domain/services/populationImpact.js';

// Cambia solo los conteos indicados; el backend recalcula el puntaje de urgencia.
export class UpdatePopulationImpact {
  constructor(zoneRepository) {
    this.zoneRepository = zoneRepository;
  }

  async execute({ zoneId, impact }) {
    const counts = parseImpact(impact);
    if (Object.keys(counts).length === 0) throw new Error('impactEmpty');
    return this.zoneRepository.updatePopulationImpact(zoneId, counts);
  }
}
