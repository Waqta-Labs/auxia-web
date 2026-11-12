import { useMutation, useQueryClient } from '@tanstack/react-query';
import { restockResourceUseCase } from '../../infrastructure/container.js';

// mutate({ inventoryId, resourceId, quantity }): registra un ingreso.
export function useRestockResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values) => restockResourceUseCase.execute(values),
    // Refresca existencias, tarjetas y alertas.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
  });
}
