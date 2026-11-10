// Contrato. Backend: GET /api/v1/deliveries?zoneId= (por zona). El tablero necesita las entregas
// más recientes de toda la emergencia y un conteo de verificadas: se compondrá en el backend
// o sumando las entregas de cada zona.
export class DeliveryRepository {
  // eslint-disable-next-line no-unused-vars
  async findRecent({ limit }) {
    throw new Error('DeliveryRepository.findRecent no implementado');
  }

  async getVerificationStats() {
    throw new Error('DeliveryRepository.getVerificationStats no implementado');
  }
}
