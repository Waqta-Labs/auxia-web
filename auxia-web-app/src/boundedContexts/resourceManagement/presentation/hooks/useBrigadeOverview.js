import { useQuery } from '@tanstack/react-query';
import { getBrigadeOverviewUseCase } from '../../infrastructure/container.js';

export function useBrigadeOverview() {
  return useQuery({
    queryKey: ['brigades', 'overview'],
    queryFn: () => getBrigadeOverviewUseCase.execute(),
  });
}
