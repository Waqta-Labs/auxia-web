// Contrato. Backend: GET /api/v1/deliveries?zoneId= (entregas de una zona, la más reciente primero).
export class DeliveryRepository {
  // eslint-disable-next-line no-unused-vars
  async findByZone(zoneId) {
    throw new Error('DeliveryRepository.findByZone no implementado');
  }
}
