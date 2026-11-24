import { useQuery } from '@tanstack/react-query';
import { getEmergencyDistributionPlansUseCase } from '../../infrastructure/container.js';
import { useBrigadeList } from '@bc/resourceManagement/presentation/hooks/useBrigadeList.js';
import { plansAwaitingBrigade } from '../../domain/services/plansAwaitingBrigade.js';

// Planes aprobados de la emergencia que esperan una brigada. Cuelga de ['zones'] para refrescarse
// cuando se aprueba un plan o se reintenta la asignación.
export function usePlansAwaitingBrigade(emergencyId) {
  const plans = useQuery({
    queryKey: ['zones', 'plans', emergencyId],
    queryFn: () => getEmergencyDistributionPlansUseCase.execute(emergencyId),
    enabled: Boolean(emergencyId),
  });
  const brigades = useBrigadeList();
  const ready = plans.isSuccess && brigades.isSuccess;
  return { data: ready ? plansAwaitingBrigade(plans.data, brigades.data) : [], isReady: ready };
}
