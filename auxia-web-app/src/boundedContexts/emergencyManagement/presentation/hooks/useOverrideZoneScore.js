import { useMutation, useQueryClient } from '@tanstack/react-query';
import { overrideZoneScoreUseCase } from '../../infrastructure/container.js';

export function useOverrideZoneScore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ zoneId, reason }) => overrideZoneScoreUseCase.execute({ zoneId, reason }),
    // Refresca el ranking, el detalle y el tablero.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zones'] }),
  });
}
