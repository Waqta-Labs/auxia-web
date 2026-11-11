import { DeliveryRepository } from '../../domain/repositories/deliveryRepository.js';
import { toDelivery } from '../mappers/deliveryMapper.js';
import { httpClient } from '@shared/infrastructure/http/httpClient.js';
import { asList } from '@shared/infrastructure/http/asList.js';

export class DeliveryHttpRepository extends DeliveryRepository {
  async findByZone(zoneId) {
    const { data } = await httpClient.get('/deliveries', { params: { zoneId } });
    return asList(data).map(toDelivery);
  }
}
