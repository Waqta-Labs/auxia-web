export class RecommendDistribution {
  constructor(distributionPlanRepository) {
    this.distributionPlanRepository = distributionPlanRepository;
  }

  async execute(emergencyId) {
    if (!emergencyId) throw new Error('emergencyRequired');
    return this.distributionPlanRepository.recommend(emergencyId);
  }
}
