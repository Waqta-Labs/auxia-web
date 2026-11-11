export class ApproveDistributionPlan {
  constructor(distributionPlanRepository) {
    this.distributionPlanRepository = distributionPlanRepository;
  }

  execute(planId) {
    return this.distributionPlanRepository.approve(planId);
  }
}
