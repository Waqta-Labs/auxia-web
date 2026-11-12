import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updatePopulationImpactUseCase } from '../../infrastructure/container.js';

export function useUpdatePopulationImpact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input) => updatePopulationImpactUseCase.execute(input),
    // El puntaje se recalcula: se refrescan el ranking, el detalle y el mapa.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zones'] }),
  });
}
