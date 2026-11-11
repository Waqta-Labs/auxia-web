import { DeliveryRepository } from '../../domain/repositories/deliveryRepository.js';
import { toDelivery } from '../mappers/deliveryMapper.js';
import { delay } from '@shared/infrastructure/mock/delay.js';

const fakeHash = (head, tail) => '0x' + head + '0'.repeat(64 - head.length - tail.length) + tail;
const iso = (offsetMinutes) => new Date(Date.now() - offsetMinutes * 60000).toISOString().slice(0, 19);

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
];
const generated = Array.from({ length: 497 }, (_, i) =>
  delivery(
    'dl-' + String(i + 5).padStart(4, '0'),
    'zn-0' + (1 + (i % 7)),
    i < 7 ? 'REGISTERED' : 'CERTIFIED',
    fakeHash((i + 4096).toString(16), (i * 7919 + 4096).toString(16).slice(-4)),
    120 + i * 30,
  ),
);
const deliveryDtos = [...specials, ...generated];

export class DeliveryMockRepository extends DeliveryRepository {
  async findByZone(zoneId) {
    await delay(300);
    return deliveryDtos.filter((dto) => dto.zoneId === zoneId).map(toDelivery);
  }
}
