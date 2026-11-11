import { useQuery } from '@tanstack/react-query';
import { getDeliveryOverviewUseCase } from '../../infrastructure/container.js';

// zones: las zonas de la emergencia (undefined mientras se cargan).
export function useDeliveryOverview({ zones, limit = 5 }) {
  return useQuery({
    queryKey: ['deliveries', 'overview', limit, zones?.map((z) => z.id).join(',')],
    queryFn: () => getDeliveryOverviewUseCase.execute({ zones, limit }),
    enabled: Array.isArray(zones),
  });
}
