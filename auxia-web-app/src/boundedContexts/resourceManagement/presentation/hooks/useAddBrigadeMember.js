import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addBrigadeMemberUseCase } from '../../infrastructure/container.js';

// mutate({ brigadeId, name, role }): agrega un miembro.
export function useAddBrigadeMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values) => addBrigadeMemberUseCase.execute(values),
    // Refresca la lista, el detalle y el resumen del tablero.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brigades'] }),
  });
}
