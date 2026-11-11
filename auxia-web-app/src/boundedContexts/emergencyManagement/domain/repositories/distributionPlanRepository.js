// Contrato. Backend (Emergency Management):
//   GET  /zones/{zoneId}/distribution-plans            historial de planes de la zona
//   GET  /distribution-plans/{planId}                  plan con cantidades recomendadas y actuales
//   POST /emergencies/{emergencyId}/distribution-plans la IA reparte el inventario entre las zonas priorizadas
//   POST /distribution-plans/{planId}/approve          aprueba (y asigna la brigada más cercana)
//   POST /distribution-plans/{planId}/reject           rechaza, con motivo
//   POST /distribution-plans/{planId}/brigade-assignment  reintenta la asignación de un plan aprobado sin brigada
export class DistributionPlanRepository {
  async findByZone() { throw new Error('DistributionPlanRepository.findByZone no implementado'); }
  async findById() { throw new Error('DistributionPlanRepository.findById no implementado'); }
  async recommend() { throw new Error('DistributionPlanRepository.recommend no implementado'); }
  async approve() { throw new Error('DistributionPlanRepository.approve no implementado'); }
  async reject() { throw new Error('DistributionPlanRepository.reject no implementado'); }
  async assignBrigade() { throw new Error('DistributionPlanRepository.assignBrigade no implementado'); }
}
