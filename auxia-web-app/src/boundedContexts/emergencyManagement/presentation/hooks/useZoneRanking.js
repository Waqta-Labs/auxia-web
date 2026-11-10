import { useQuery } from '@tanstack/react-query';
import { getZoneRankingUseCase } from '../../infrastructure/container.js';

export function useZoneRanking(emergencyId) {
  return useQuery({
    queryKey: ['zones', 'ranking', emergencyId],
    queryFn: () => getZoneRankingUseCase.execute(emergencyId),
    enabled: Boolean(emergencyId),
  });
}
