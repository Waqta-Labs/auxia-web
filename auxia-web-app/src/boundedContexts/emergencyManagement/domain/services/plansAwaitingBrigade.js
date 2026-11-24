import { brigadeOfPlan } from '@bc/resourceManagement/domain/services/brigadeAvailability.js';

// Planes aprobados que ninguna brigada tomó: la ayuda de esas zonas está detenida hasta que se
// asigne una. Un plan con su propia brigada (datos de prueba) no cuenta.
export function plansAwaitingBrigade(plans, brigades) {
  return plans.filter((plan) => plan.isApproved && !plan.hasBrigade && !brigadeOfPlan(brigades, plan.id));
}
