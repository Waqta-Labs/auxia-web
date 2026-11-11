import { useMutation, useQueryClient } from '@tanstack/react-query';
import { recommendDistributionUseCase } from '../../infrastructure/container.js';

// mutate(emergencyId): la IA reparte el inventario entre las zonas.
export function useRecommendDistribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (emergencyId) => recommendDistributionUseCase.execute(emergencyId),
    // Refresca el plan de la zona, el ranking y el tablero.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zones'] }),
  });
}
