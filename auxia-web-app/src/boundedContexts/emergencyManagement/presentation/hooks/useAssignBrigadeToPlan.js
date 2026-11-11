import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assignBrigadeToPlanUseCase } from '../../infrastructure/container.js';

// mutate(planId): reintenta la asignación de brigada de un plan aprobado.
export function useAssignBrigadeToPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planId) => assignBrigadeToPlanUseCase.execute(planId),
    // Refresca el plan de la zona, el ranking y el tablero.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zones'] }),
  });
}
