import { useQuery } from '@tanstack/react-query';
import { getStockAlertsUseCase } from '../../infrastructure/container.js';

// status: 'OPEN' | 'RESOLVED'
export function useStockAlerts(inventoryId, status = 'OPEN') {
  return useQuery({
    queryKey: ['inventory', 'alerts', inventoryId, status],
    queryFn: () => getStockAlertsUseCase.execute({ inventoryId, status }),
    enabled: Boolean(inventoryId),
  });
}
