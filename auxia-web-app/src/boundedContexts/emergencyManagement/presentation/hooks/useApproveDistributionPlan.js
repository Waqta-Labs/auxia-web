import { useMutation, useQueryClient } from '@tanstack/react-query';
import { approveDistributionPlanUseCase } from '../../infrastructure/container.js';

// mutate(planId): aprueba el plan; el backend asigna la brigada.
export function useApproveDistributionPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planId) => approveDistributionPlanUseCase.execute(planId),
    // Refresca el plan de la zona, el ranking y el tablero.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zones'] }),
  });
}
