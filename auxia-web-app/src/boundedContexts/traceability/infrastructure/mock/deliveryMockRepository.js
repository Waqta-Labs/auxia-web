import { DeliveryRepository } from '../../domain/repositories/deliveryRepository.js';
import { toDelivery, toDeliveryDetail, toVerificationResult } from '../mappers/deliveryMapper.js';
import { delay } from '@shared/infrastructure/mock/delay.js';

const fakeHash = (head, tail) => '0x' + head + '0'.repeat(64 - head.length - tail.length) + tail;
const iso = (offsetMinutes) => new Date(Date.now() - offsetMinutes * 60000).toISOString().slice(0, 19);
const problem = (status, detail) => Object.assign(new Error(detail), { status, detail });

const delivery = (id, zoneId, status, hash, minutesAgo) => ({
  id,
  zoneId,
  status,
  deliveredAt: minutesAgo === null ? null : iso(minutesAgo),
  integrity: {
    anchorStatus: status === 'CERTIFIED' ? 'ANCHORED' : 'PENDING',
    transactionHash: hash,
  },
});

// Las 3 primeras repiten el mockup; el resto da 500 entregas registradas (492 validadas = 98.4 %).
const specials = [
  delivery('dl-0001', 'zn-01', 'CERTIFIED', fakeHash('7f3a', 'c91e'), 12),
  delivery('dl-0002', 'zn-02', 'REGISTERED', fakeHash('2b9d', 'a47f'), 35),
  delivery('dl-0003', 'zn-03', 'CERTIFIED', fakeHash('91c4', '03de'), 70),
  delivery('dl-0004', 'zn-04', 'INITIATED', null, null),
  { ...delivery('dl-0005', 'zn-05', 'REGISTERED', fakeHash('3c8e', 'f210'), 50), integrity: { anchorStatus: 'FAILED', transactionHash: null } },
];
const generated = Array.from({ length: 496 }, (_, i) =>
  delivery(
    'dl-' + String(i + 6).padStart(4, '0'),
    'zn-0' + (1 + (i % 7)),
    i < 7 ? 'REGISTERED' : 'CERTIFIED',
    fakeHash((i + 4096).toString(16), (i * 7919 + 4096).toString(16).slice(-4)),
    120 + i * 30,
  ),
);
const deliveryDtos = [...specials, ...generated];

// Detalle con la forma real del backend: items solo con resourceId y quantity.
const detailOf = (dto) => {
  const registered = dto.status !== 'INITIATED';
  const at = (minutes) => new Date(Date.parse(dto.deliveredAt + 'Z') + minutes * 60000).toISOString().slice(0, 19);
  return {
    id: dto.id,
    distributionPlanId: 'pl-' + dto.id.slice(-4),
    zoneId: dto.zoneId,
    brigadeId: 'br-01',
    status: dto.status,
    registeredBy: 'us-01',
    deliveredAt: dto.deliveredAt,
    receivedAt: registered ? at(3) : null,
    items: [
      { resourceId: 'a1c16f79-9417-433c-9161-d3a1e8faa4a2', quantity: 50 },
      { resourceId: '7be20a41-3f55-47c0-8a6e-5d1c9e0f6b12', quantity: 120 },
    ],
    evidences: registered ? [
      { id: 'ev-1', type: 'PHOTO', contentHash: fakeHash('c31f', dto.id.slice(-4)).slice(2), capturedAt: dto.deliveredAt, location: { latitude: -11.9436, longitude: -76.7078 } },
      { id: 'ev-2', type: 'PHOTO', contentHash: fakeHash('9ab2', dto.id.slice(-4)).slice(2), capturedAt: dto.deliveredAt, location: { latitude: -11.9437, longitude: -76.7079 } },
    ] : [],
    integrity: {
      recordHash: registered ? fakeHash('852b', dto.id.slice(-4)).slice(2) : null,
      anchorStatus: dto.integrity.anchorStatus === 'ANCHORED' ? 'ANCHORED' : dto.integrity.anchorStatus,
      transactionHash: dto.integrity.transactionHash,
      anchoredAt: dto.status === 'CERTIFIED' ? at(4) : null,
      attempts: registered ? 1 : 0,
    },
  };
};

export class DeliveryMockRepository extends DeliveryRepository {
  async findByZone(zoneId) {
    await delay(300);
    return deliveryDtos.filter((dto) => dto.zoneId === zoneId).map(toDelivery);
  }

  async findById(deliveryId) {
    await delay(300);
    const dto = deliveryDtos.find((item) => item.id === deliveryId);
    if (!dto) throw problem(404, 'Entrega no encontrada');
    return toDeliveryDetail(detailOf(dto));
  }

  // dl-0003 simula un registro alterado; una entrega en camino no se puede verificar; una anclando, la blockchain no responde.
  async verify(deliveryId) {
    await delay(900);
    const dto = deliveryDtos.find((item) => item.id === deliveryId);
    if (!dto || dto.status === 'INITIATED') throw problem(404, 'La entrega todavía no está registrada.');
    if (dto.status !== 'CERTIFIED') throw problem(503, 'La blockchain no responde en este momento. Inténtalo en unos minutos.');
    const record = fakeHash('852b', dto.id.slice(-4)).slice(2);
    const tampered = deliveryId === 'dl-0003';
    return toVerificationResult({
      deliveryId, recordHash: record, anchoredHash: tampered ? fakeHash('0bad', 'f00d').slice(2) : record,
      transactionHash: dto.integrity.transactionHash, verified: !tampered,
    });
  }

  async downloadReport({ zoneId }) {
    await delay(700);
    if (zoneId === 'zn-12') throw problem(404, 'No hay entregas registradas para ese filtro.');
    return new Blob(['%PDF-1.4\n% informe de prueba (mock)\n'], { type: 'application/pdf' });
  }
}
