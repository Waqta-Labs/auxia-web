import { useQuery } from '@tanstack/react-query';
import { getZonePriorityDetailUseCase } from '../../infrastructure/container.js';

export function useZonePriorityDetail(zoneId) {
  return useQuery({
    queryKey: ['zones', 'detail', zoneId],
    queryFn: () => getZonePriorityDetailUseCase.execute(zoneId),
    enabled: Boolean(zoneId),
  });
}
