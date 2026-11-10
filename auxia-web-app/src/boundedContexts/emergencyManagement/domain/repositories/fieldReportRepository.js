// Contrato. Backend: GET /api/v1/emergencies/{emergencyId}/field-reports
// (el total y la parte retransmitida por Mesh se derivan del listado).
export class FieldReportRepository {
  // eslint-disable-next-line no-unused-vars
  async summarize(emergencyId) {
    throw new Error('FieldReportRepository.summarize no implementado');
  }
}
