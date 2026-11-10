import { useQuery } from '@tanstack/react-query';
import { getActiveEmergencyUseCase } from '../../infrastructure/container.js';

export function useActiveEmergency() {
  return useQuery({
    queryKey: ['emergency', 'active'],
    queryFn: () => getActiveEmergencyUseCase.execute(),
  });
}
