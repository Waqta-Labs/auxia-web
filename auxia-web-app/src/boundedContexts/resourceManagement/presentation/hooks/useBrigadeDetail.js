import { useQuery } from '@tanstack/react-query';
import { getBrigadeDetailUseCase } from '../../infrastructure/container.js';

export function useBrigadeDetail(brigadeId) {
  return useQuery({
    queryKey: ['brigades', 'detail', brigadeId],
    queryFn: () => getBrigadeDetailUseCase.execute(brigadeId),
    enabled: Boolean(brigadeId),
  });
}
