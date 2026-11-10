import { useQuery } from '@tanstack/react-query';
import { getRecentDeliveriesUseCase } from '../../infrastructure/container.js';

export function useRecentDeliveries({ limit = 5 } = {}) {
  return useQuery({
    queryKey: ['deliveries', 'recent', limit],
    queryFn: () => getRecentDeliveriesUseCase.execute({ limit }),
  });
}
