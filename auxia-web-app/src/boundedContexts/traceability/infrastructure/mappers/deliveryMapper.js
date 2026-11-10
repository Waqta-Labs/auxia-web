import { Delivery } from '../../domain/entities/Delivery.js';
import { VerificationStats } from '../../domain/entities/VerificationStats.js';
import { DeliveryStatus } from '../../domain/enums/deliveryStatus.js';

export function toDelivery(dto) {
  return new Delivery({
    id: dto.id,
    // El backend informa el estado de la entrega y, aparte, el del anclaje (PENDING / FAILED).
    status: dto.anchoringStatus === 'FAILED' ? DeliveryStatus.FAILED : dto.status,
    transactionHash: dto.transactionHash ?? null,
    originName: dto.originName ?? null,
    destinationName: dto.destinationName ?? null,
  });
}

export function toVerificationStats(dto) {
  return new VerificationStats({ verified: dto.verified, total: dto.total });
}
