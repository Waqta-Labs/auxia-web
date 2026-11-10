import { DeliveryRepository } from '../../domain/repositories/deliveryRepository.js';
import { toDelivery, toVerificationStats } from '../mappers/deliveryMapper.js';
import { delay } from '@shared/infrastructure/mock/delay.js';

const fakeHash = (head, tail) => '0x' + head + '0'.repeat(64 - head.length - tail.length) + tail;

const deliveryDtos = [
  {
    id: 'dl-0001', status: 'CERTIFIED', transactionHash: fakeHash('7f3a', 'c91e'),
    originName: 'Almacén Central', destinationName: 'Brigada Alfa · Santa Rosa',
  },
  {
    id: 'dl-0002', status: 'INITIATED', transactionHash: fakeHash('2b9d', 'a47f'),
    originName: 'Centro de Acopio Norte', destinationName: 'Brigada Bravo · Villa Esperanza',
  },
  {
    id: 'dl-0003', status: 'CERTIFIED', transactionHash: fakeHash('91c4', '03de'),
    originName: 'Almacén Central', destinationName: 'Albergue Municipal',
  },
  {
    id: 'dl-0004', status: 'REGISTERED', transactionHash: fakeHash('c07e', '5b12'),
    originName: 'Almacén Central', destinationName: 'Brigada Delta · Quebrada Carossio',
  },
];

export class DeliveryMockRepository extends DeliveryRepository {
  async findRecent({ limit }) {
    await delay(500);
    return deliveryDtos.slice(0, limit).map(toDelivery);
  }

  async getVerificationStats() {
    await delay(450);
    return toVerificationStats({ verified: 492, total: 500 }); // 98.4 %
  }
}
