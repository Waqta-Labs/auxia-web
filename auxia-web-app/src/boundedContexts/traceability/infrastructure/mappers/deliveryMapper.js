import { Delivery } from '../../domain/entities/Delivery.js';
import { DeliveryStatus } from '../../domain/enums/deliveryStatus.js';
import { parseUtc } from '@shared/utils/formatters.js';

// DeliveryResource { id, zoneId, status, deliveredAt, integrity: { anchorStatus, transactionHash } }
export function toDelivery(dto) {
  return new Delivery({
    id: dto.id,
    zoneId: dto.zoneId,
    // Si el anclaje falló (y se reintenta cada 5 min) se muestra aparte.
    status: dto.integrity?.anchorStatus === 'FAILED' ? DeliveryStatus.FAILED : dto.status,
    transactionHash: dto.integrity?.transactionHash ?? null,
    deliveredAt: parseUtc(dto.deliveredAt),
  });
}
