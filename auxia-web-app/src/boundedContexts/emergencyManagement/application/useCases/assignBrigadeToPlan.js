export class AssignBrigadeToPlan {
  constructor(distributionPlanRepository) {
    this.distributionPlanRepository = distributionPlanRepository;
  }

  execute(planId) {
    return this.distributionPlanRepository.assignBrigade(planId);
  }
}
