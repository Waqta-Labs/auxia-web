import { useMutation, useQueryClient } from '@tanstack/react-query';
import { setBrigadeAvailabilityUseCase } from '../../infrastructure/container.js';

// mutate({ brigadeId, status }): pone la brigada en servicio o fuera de servicio.
export function useSetBrigadeAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values) => setBrigadeAvailabilityUseCase.execute(values),
    // Refresca la lista, el detalle y el resumen del tablero.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brigades'] }),
  });
}
