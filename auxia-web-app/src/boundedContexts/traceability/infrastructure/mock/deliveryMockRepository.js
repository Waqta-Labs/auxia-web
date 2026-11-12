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

// Detalle con la forma probable del backend (recursos, evidencias por hash, hash del registro).
const detailOf = (dto) => {
  const registered = dto.status !== 'INITIATED';
  return {
    ...dto,
    initiatedAt: dto.deliveredAt ? new Date(Date.parse(dto.deliveredAt + 'Z') - 3 * 3600000).toISOString().slice(0, 19) : iso(40),
    items: [
      { resourceName: 'Agua embotellada', plannedQuantity: 24, deliveredQuantity: registered ? 24 : null, unit: 'bidones' },
      { resourceName: 'Kits de alimentos', plannedQuantity: 60, deliveredQuantity: registered ? 58 : null, unit: 'kits' },
    ],
    evidences: registered
      ? [{ sha256: fakeHash('e1d3', dto.id.slice(-4)).slice(2), contentType: 'image/jpeg' }, { sha256: fakeHash('b7a9', dto.id.slice(-4)).slice(2), contentType: 'application/pdf' }]
      : [],
    integrity: {
      ...dto.integrity,
      recordHash: registered ? fakeHash('5d2c', dto.id.slice(-4)).slice(2) : null,
      anchoredAt: dto.status === 'CERTIFIED' ? dto.deliveredAt : null,
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
    const record = fakeHash('5d2c', dto.id.slice(-4)).slice(2);
    const tampered = deliveryId === 'dl-0003';
    return toVerificationResult({ verified: !tampered, recordHash: record, blockchainHash: tampered ? fakeHash('0bad', 'f00d').slice(2) : record });
  }

  async downloadReport({ zoneId }) {
    await delay(700);
    if (zoneId === 'zn-12') throw problem(404, 'No hay entregas registradas para ese filtro.');
    return new Blob(['%PDF-1.4\n% informe de prueba (mock)\n'], { type: 'application/pdf' });
  }
}
