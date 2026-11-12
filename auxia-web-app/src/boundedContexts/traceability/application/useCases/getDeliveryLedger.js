export class GetDeliveryLedger {
  constructor(deliveryRepository) {
    this.deliveryRepository = deliveryRepository;
  }

  // El backend entrega por zona: se juntan todas las de la emergencia. Primero las que van en camino
  // (sin fecha) y luego de la más reciente a la más antigua. Una zona que falla no tumba el ledger.
  async execute({ zones }) {
    const perZone = await Promise.all(
      zones.map(async (zone) => {
        try {
          const deliveries = await this.deliveryRepository.findByZone(zone.id);
          return deliveries.map((delivery) => delivery.withZoneName(zone.name));
        } catch {
          return [];
        }
      }),
    );
    return perZone.flat().sort((a, b) => (b.deliveredAt ?? Infinity) - (a.deliveredAt ?? Infinity));
  }
}
