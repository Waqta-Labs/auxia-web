import { Delivery } from '../../domain/entities/Delivery.js';
import { DeliveryDetail } from '../../domain/entities/DeliveryDetail.js';
import { VerificationResult } from '../../domain/entities/VerificationResult.js';
import { DeliveryStatus } from '../../domain/enums/deliveryStatus.js';
import { parseUtc } from '@shared/utils/formatters.js';

// Si el anclaje falló (y se reintenta cada 5 min) se muestra aparte.
const statusOf = (dto) => (dto.integrity?.anchorStatus === 'FAILED' ? DeliveryStatus.FAILED : dto.status);

// DeliveryResource { id, zoneId, status, deliveredAt, integrity: { anchorStatus, transactionHash } }
export function toDelivery(dto) {
  return new Delivery({
    id: dto.id,
    zoneId: dto.zoneId,
    status: statusOf(dto),
    transactionHash: dto.integrity?.transactionHash ?? null,
    deliveredAt: parseUtc(dto.deliveredAt),
  });
}

// GET /deliveries/{id}: items [{ resourceId, quantity }], evidences [{ id, type, contentHash, capturedAt, location }],
// integrity { recordHash, anchorStatus, transactionHash, anchoredAt, attempts }. El nombre del recurso no viene
// (solo su id): se muestra cuando exista la pantalla de Inventario o si el backend lo agrega.
export function toDeliveryDetail(dto) {
  const integrity = dto.integrity ?? {};
  return new DeliveryDetail({
    id: dto.id,
    zoneId: dto.zoneId ?? null,
    planId: dto.distributionPlanId ?? null,
    status: statusOf(dto),
    deliveredAt: parseUtc(dto.deliveredAt),
    receivedAt: parseUtc(dto.receivedAt),
    recordHash: integrity.recordHash ?? null,
    transactionHash: integrity.transactionHash ?? null,
    anchoredAt: parseUtc(integrity.anchoredAt),
    attempts: integrity.attempts ?? null,
    items: (dto.items ?? []).map((item) => ({
      resourceId: item.resourceId ?? null,
      name: item.resourceName ?? item.name ?? null,
      quantity: item.quantity ?? null,
    })),
    evidences: (dto.evidences ?? []).map((evidence) => ({
      id: evidence.id ?? null,
      type: evidence.type ?? null,
      hash: evidence.contentHash ?? null,
      capturedAt: parseUtc(evidence.capturedAt),
      location: evidence.location ? { latitude: evidence.location.latitude, longitude: evidence.location.longitude } : null,
    })),
  });
}

// GET /deliveries/{id}/verify: { deliveryId, recordHash, anchoredHash, transactionHash, verified }
export function toVerificationResult(dto) {
  return new VerificationResult({
    deliveryId: dto.deliveryId,
    verified: dto.verified === true,
    recordHash: dto.recordHash ?? null,
    anchoredHash: dto.anchoredHash ?? null,
    transactionHash: dto.transactionHash ?? null,
  });
}
