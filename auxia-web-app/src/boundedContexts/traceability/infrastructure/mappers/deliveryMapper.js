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

// El detalle (recursos, evidencias, hash del registro) aún no se vio con datos reales: se leen los
// nombres más probables de cada campo. Si el backend usa otros, solo hay que ajustar este archivo.
const toItem = (item) => ({
  name: item.resourceName ?? item.name ?? item.resource?.name ?? '—',
  planned: item.plannedQuantity ?? null,
  quantity: item.deliveredQuantity ?? item.quantity ?? null,
  unit: item.unit ?? item.resource?.unit ?? null,
});

const toEvidence = (evidence) =>
  typeof evidence === 'string'
    ? { hash: evidence, type: null }
    : { hash: evidence.sha256 ?? evidence.hash ?? null, type: evidence.contentType ?? evidence.type ?? null };

export function toDeliveryDetail(dto) {
  const integrity = dto.integrity ?? {};
  return new DeliveryDetail({
    id: dto.id,
    zoneId: dto.zoneId ?? dto.zone?.id ?? null,
    status: statusOf(dto),
    deliveredAt: parseUtc(dto.deliveredAt),
    openedAt: parseUtc(dto.initiatedAt ?? dto.openedAt ?? dto.createdAt ?? null),
    recordHash: integrity.recordHash ?? integrity.hash ?? dto.recordHash ?? dto.hash ?? null,
    transactionHash: integrity.transactionHash ?? null,
    anchoredAt: parseUtc(integrity.anchoredAt ?? integrity.confirmedAt ?? null),
    items: (dto.items ?? []).map(toItem),
    evidences: (dto.evidences ?? dto.evidence ?? []).map(toEvidence),
  });
}

export function toVerificationResult(dto) {
  return new VerificationResult({
    verified: dto.verified === true,
    recordHash: dto.recordHash ?? dto.computedHash ?? dto.currentHash ?? null,
    chainHash: dto.blockchainHash ?? dto.onChainHash ?? dto.chainHash ?? null,
  });
}
