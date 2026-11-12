import { useMutation, useQueryClient } from '@tanstack/react-query';
import { registerResourceUseCase } from '../../infrastructure/container.js';

// mutate({ inventoryId, name, category, unit, minimumStock }): registra un recurso sin stock.
export function useRegisterResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values) => registerResourceUseCase.execute(values),
    // Refresca existencias, tarjetas y alertas.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
  });
}
