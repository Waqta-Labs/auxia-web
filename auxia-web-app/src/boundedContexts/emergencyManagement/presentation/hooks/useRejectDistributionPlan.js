import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rejectDistributionPlanUseCase } from '../../infrastructure/container.js';

// mutate({ planId, reason }): rechaza el plan con un motivo.
export function useRejectDistributionPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, reason }) => rejectDistributionPlanUseCase.execute({ planId, reason }),
    // Refresca el plan de la zona, el ranking y el tablero.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zones'] }),
  });
}
