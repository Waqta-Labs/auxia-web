import { DeliveryRepository } from '../../domain/repositories/deliveryRepository.js';
import { toDelivery, toDeliveryDetail, toVerificationResult } from '../mappers/deliveryMapper.js';
import { httpClient } from '@shared/infrastructure/http/httpClient.js';
import { asList } from '@shared/infrastructure/http/asList.js';
import { toApiError } from '@shared/infrastructure/http/toApiError.js';

const call = async (request) => {
  try {
    return await request();
  } catch (error) {
    // Si se pidió un archivo, el error (application/problem+json) llega como Blob: se lee para mostrar su "detail".
    const data = error.response?.data;
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
      try {
        error.response.data = JSON.parse(await data.text());
      } catch {
        error.response.data = null;
      }
    }
    throw toApiError(error);
  }
};

export class DeliveryHttpRepository extends DeliveryRepository {
  async findByZone(zoneId) {
    const { data } = await call(() => httpClient.get('/deliveries', { params: { zoneId } }));
    return asList(data).map(toDelivery);
  }

  async findById(deliveryId) {
    const { data } = await call(() => httpClient.get('/deliveries/' + deliveryId));
    return toDeliveryDetail(data);
  }

  async verify(deliveryId) {
    const { data } = await call(() => httpClient.get('/deliveries/' + deliveryId + '/verify'));
    return toVerificationResult(data);
  }

  async downloadReport({ zoneId, from, to }) {
    const params = {};
    if (zoneId) params.zoneId = zoneId;
    if (from) params.from = from;
    if (to) params.to = to;
    const { data } = await call(() => httpClient.get('/deliveries/report', { params, responseType: 'blob' }));
    return data;
  }
}
