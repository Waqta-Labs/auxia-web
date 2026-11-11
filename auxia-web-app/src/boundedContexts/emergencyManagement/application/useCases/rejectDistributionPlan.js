export class RejectDistributionPlan {
  constructor(distributionPlanRepository) {
    this.distributionPlanRepository = distributionPlanRepository;
  }

  async execute({ planId, reason }) {
    const text = (reason ?? '').trim();
    if (!text) throw new Error('reasonRequired');
    return this.distributionPlanRepository.reject(planId, text);
  }
}
