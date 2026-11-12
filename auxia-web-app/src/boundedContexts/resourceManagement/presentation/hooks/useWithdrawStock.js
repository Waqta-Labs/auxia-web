import { useMutation, useQueryClient } from '@tanstack/react-query';
import { withdrawStockUseCase } from '../../infrastructure/container.js';

// mutate({ inventoryId, resource, quantity, reason }): registra una salida (ajuste negativo con motivo).
export function useWithdrawStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values) => withdrawStockUseCase.execute(values),
    // Refresca existencias, tarjetas y alertas.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
  });
}
