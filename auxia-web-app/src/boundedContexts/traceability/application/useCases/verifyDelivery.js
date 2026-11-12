export class VerifyDelivery {
  constructor(deliveryRepository) {
    this.deliveryRepository = deliveryRepository;
  }

  execute(deliveryId) {
    return this.deliveryRepository.verify(deliveryId);
  }
}
