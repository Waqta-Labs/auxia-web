import { useQuery } from '@tanstack/react-query';
import { getBrigadeListUseCase } from '../../infrastructure/container.js';

export function useBrigadeList() {
  return useQuery({
    queryKey: ['brigades', 'list'],
    queryFn: () => getBrigadeListUseCase.execute(),
  });
}
