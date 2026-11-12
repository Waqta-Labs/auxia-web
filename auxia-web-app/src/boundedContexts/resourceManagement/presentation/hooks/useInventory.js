import { useQuery } from '@tanstack/react-query';
import { getInventoryUseCase } from '../../infrastructure/container.js';

export function useInventory() {
  return useQuery({
    queryKey: ['inventory', 'stock'],
    queryFn: () => getInventoryUseCase.execute(),
  });
}
