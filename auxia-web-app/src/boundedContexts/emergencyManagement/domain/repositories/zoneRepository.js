// Contrato.
//  - findRanking: GET /emergencies/{id}/zones (+ GET /zones/{id} por zona si se piden coordenadas).
//  - findDetail: GET /zones/{id}
//  - findScoreExplanation: GET /zones/{id}/score
//  - setManualPriority / clearManualPriority: PUT / DELETE /zones/{id}/manual-priority (solo AUTHORITY)
//  - register: POST /emergencies/{id}/zones (solo AUTHORITY)
//  - updatePopulationImpact: PATCH /zones/{id}/population-impact (solo AUTHORITY)
export class ZoneRepository {
  // eslint-disable-next-line no-unused-vars
  async findRanking(emergencyId, { withPosition } = {}) {
    throw new Error('ZoneRepository.findRanking no implementado');
  }

  // eslint-disable-next-line no-unused-vars
  async findDetail(zoneId) {
    throw new Error('ZoneRepository.findDetail no implementado');
  }

  // eslint-disable-next-line no-unused-vars
  async findScoreExplanation(zoneId) {
    throw new Error('ZoneRepository.findScoreExplanation no implementado');
  }

  // eslint-disable-next-line no-unused-vars
  async setManualPriority(zoneId, reason) {
    throw new Error('ZoneRepository.setManualPriority no implementado');
  }

  // eslint-disable-next-line no-unused-vars
  async clearManualPriority(zoneId) {
    throw new Error('ZoneRepository.clearManualPriority no implementado');
  }

  // eslint-disable-next-line no-unused-vars
  async register(emergencyId, { name, latitude, longitude, damageLevel, impact }) {
    throw new Error('ZoneRepository.register no implementado');
  }

  // eslint-disable-next-line no-unused-vars
  async updatePopulationImpact(zoneId, impact) {
    throw new Error('ZoneRepository.updatePopulationImpact no implementado');
  }
}
