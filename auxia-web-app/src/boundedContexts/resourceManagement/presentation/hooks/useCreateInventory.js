import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createInventoryUseCase } from '../../infrastructure/container.js';

// mutate(): crea el inventario de la organización.
export function useCreateInventory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values) => createInventoryUseCase.execute(values),
    // Refresca existencias, tarjetas y alertas.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
  });
}
