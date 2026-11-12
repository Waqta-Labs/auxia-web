import { useMutation, useQueryClient } from '@tanstack/react-query';
import { registerZoneUseCase } from '../../infrastructure/container.js';

export function useRegisterZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input) => registerZoneUseCase.execute(input),
    // El mapa, el tablero y la bandeja vuelven a pedir las zonas.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zones'] }),
  });
}
