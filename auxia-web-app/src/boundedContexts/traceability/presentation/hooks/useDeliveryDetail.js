import { useQuery } from '@tanstack/react-query';
import { getDeliveryDetailUseCase } from '../../infrastructure/container.js';

export function useDeliveryDetail(deliveryId) {
  return useQuery({
    queryKey: ['deliveries', 'detail', deliveryId],
    queryFn: () => getDeliveryDetailUseCase.execute(deliveryId),
    enabled: Boolean(deliveryId),
  });
}
