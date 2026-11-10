export class GetRecentDeliveries {
  constructor(deliveryRepository) {
    this.deliveryRepository = deliveryRepository;
  }

  execute({ limit = 5 } = {}) {
    return this.deliveryRepository.findRecent({ limit });
  }
}
