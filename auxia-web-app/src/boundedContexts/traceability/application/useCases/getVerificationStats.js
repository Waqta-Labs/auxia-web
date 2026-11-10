export class GetVerificationStats {
  constructor(deliveryRepository) {
    this.deliveryRepository = deliveryRepository;
  }

  execute() {
    return this.deliveryRepository.getVerificationStats();
  }
}
