export class GetEmergencyDistributionPlans {
  constructor(distributionPlanRepository) {
    this.distributionPlanRepository = distributionPlanRepository;
  }

  // Todos los planes de la emergencia, de todas sus zonas.
  async execute(emergencyId) {
    return this.distributionPlanRepository.findByEmergency(emergencyId);
  }
}
