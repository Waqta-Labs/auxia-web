// Contrato. Backend (Traceability):
//   GET /deliveries?zoneId=                      entregas de una zona, la más reciente primero
//   GET /deliveries/{id}                         entrega con recursos, evidencias (por hash) y anclaje
//   GET /deliveries/{id}/verify                  público: compara el hash actual con el de la blockchain
//   GET /deliveries/report?zoneId=&from=&to=     PDF de auditoría (parámetros opcionales)
export class DeliveryRepository {
  async findByZone() { throw new Error('DeliveryRepository.findByZone no implementado'); }
  async findById() { throw new Error('DeliveryRepository.findById no implementado'); }
  async verify() { throw new Error('DeliveryRepository.verify no implementado'); }
  async downloadReport() { throw new Error('DeliveryRepository.downloadReport no implementado'); }
}
