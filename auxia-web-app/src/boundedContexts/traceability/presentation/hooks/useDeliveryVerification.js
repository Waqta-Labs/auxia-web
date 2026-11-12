import { useQuery } from '@tanstack/react-query';
import { verifyDeliveryUseCase } from '../../infrastructure/container.js';

// Verificación pública de una entrega (sin sesión): se consulta al abrir la página. Sin reintentos
// automáticos: un 404 o un 503 es una respuesta, y la persona decide cuándo volver a intentar.
export function useDeliveryVerification(deliveryId) {
  return useQuery({
    queryKey: ['deliveries', 'verification', deliveryId],
    queryFn: () => verifyDeliveryUseCase.execute(deliveryId),
    enabled: Boolean(deliveryId),
    retry: false,
  });
}
