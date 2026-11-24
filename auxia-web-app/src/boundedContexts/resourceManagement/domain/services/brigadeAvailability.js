// El backend solo asigna un plan aprobado a una brigada libre que tenga líder. Este resumen explica
// por qué no hubo ninguna: cuántas están en misión, fuera de servicio o libres pero sin líder.
export function availabilitySummary(brigades) {
  const summary = { total: brigades.length, ready: 0, onMission: 0, offDuty: 0, withoutLeader: 0 };
  for (const brigade of brigades) {
    if (brigade.isDeployed) summary.onMission += 1;
    else if (brigade.isOffDuty) summary.offDuty += 1;
    else if (brigade.isAvailable && brigade.hasLeader === false) summary.withoutLeader += 1;
    else if (brigade.isAvailable) summary.ready += 1;
  }
  return summary;
}

// La brigada que lleva el plan, o null. El plan del backend no trae su brigada: la trae la brigada.
export function brigadeOfPlan(brigades, planId) {
  return brigades.find((brigade) => brigade.assignedPlanId === planId) ?? null;
}
