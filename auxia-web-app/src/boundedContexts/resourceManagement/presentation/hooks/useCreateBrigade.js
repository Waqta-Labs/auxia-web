import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createBrigadeUseCase } from '../../infrastructure/container.js';

// mutate({ name, code, latitude, longitude }): crea una brigada disponible.
export function useCreateBrigade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values) => createBrigadeUseCase.execute(values),
    // Refresca la lista, el detalle y el resumen del tablero.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brigades'] }),
  });
}
