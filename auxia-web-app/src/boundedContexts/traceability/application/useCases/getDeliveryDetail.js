export class GetDeliveryDetail {
  constructor(deliveryRepository) {
    this.deliveryRepository = deliveryRepository;
  }

  execute(deliveryId) {
    return this.deliveryRepository.findById(deliveryId);
  }
}
