import { pickCurrentPlan } from '../../domain/services/pickCurrentPlan.js';

export class GetZoneDistributionPlan {
  constructor(distributionPlanRepository) {
    this.distributionPlanRepository = distributionPlanRepository;
  }

  // Devuelve el plan vigente de la zona con sus cantidades, o null si la zona no tiene ninguno.
  async execute(zoneId) {
    const plans = await this.distributionPlanRepository.findByZone(zoneId);
    const current = pickCurrentPlan(plans);
    if (!current) return null;
    try {
      return await this.distributionPlanRepository.findById(current.id);
    } catch {
      return current; // el historial ya trae lo esencial; el detalle es un extra
    }
  }
}
