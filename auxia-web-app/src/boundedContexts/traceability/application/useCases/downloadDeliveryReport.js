export class DownloadDeliveryReport {
  constructor(deliveryRepository) {
    this.deliveryRepository = deliveryRepository;
  }

  // zoneId, from y to (AAAA-MM-DD) son opcionales. Devuelve { blob, filename }.
  async execute({ zoneId = null, from = null, to = null } = {}) {
    const blob = await this.deliveryRepository.downloadReport({ zoneId, from, to });
    const stamp = new Date().toISOString().slice(0, 10);
    return { blob, filename: 'informe-auditoria-' + stamp + '.pdf' };
  }
}
