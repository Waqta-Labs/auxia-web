import { useMutation, useQueryClient } from '@tanstack/react-query';
import { removeBrigadeMemberUseCase } from '../../infrastructure/container.js';

// mutate({ brigadeId, memberId }): quita un miembro.
export function useRemoveBrigadeMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values) => removeBrigadeMemberUseCase.execute(values),
    // Refresca la lista, el detalle y el resumen del tablero.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brigades'] }),
  });
}
