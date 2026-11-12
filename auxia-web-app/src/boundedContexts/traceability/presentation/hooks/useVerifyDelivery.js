import { useMutation } from '@tanstack/react-query';
import { verifyDeliveryUseCase } from '../../infrastructure/container.js';

// mutate(deliveryId): recalcula el hash y lo compara con el de la blockchain (a pedido, no al abrir la ficha).
export function useVerifyDelivery() {
  return useMutation({ mutationFn: (deliveryId) => verifyDeliveryUseCase.execute(deliveryId) });
}
