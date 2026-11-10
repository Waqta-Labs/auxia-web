import { useQuery } from '@tanstack/react-query';
import { getVerificationStatsUseCase } from '../../infrastructure/container.js';

export function useVerificationStats() {
  return useQuery({
    queryKey: ['deliveries', 'verificationStats'],
    queryFn: () => getVerificationStatsUseCase.execute(),
  });
}
