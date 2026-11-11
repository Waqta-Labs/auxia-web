import { useQuery } from '@tanstack/react-query';
import { getZoneDistributionPlanUseCase } from '../../infrastructure/container.js';

// Plan vigente de una zona (o null). Cuelga de ['zones'] para refrescarse junto con el ranking.
export function useZoneDistributionPlan(zoneId) {
  return useQuery({
    queryKey: ['zones', 'plan', zoneId],
    queryFn: () => getZoneDistributionPlanUseCase.execute(zoneId),
    enabled: Boolean(zoneId),
  });
}
