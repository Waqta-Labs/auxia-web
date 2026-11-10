// Contrato. Backend: GET /api/v1/emergencies (activas, la más reciente primero).
export class EmergencyRepository {
  async findActive() {
    throw new Error('EmergencyRepository.findActive no implementado');
  }
}
