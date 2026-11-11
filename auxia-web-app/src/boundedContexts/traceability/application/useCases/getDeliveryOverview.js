import { VerificationStats } from '../../domain/entities/VerificationStats.js';
import { DeliveryStatus } from '../../domain/enums/deliveryStatus.js';

export class GetDeliveryOverview {
  constructor(deliveryRepository) {
    this.deliveryRepository = deliveryRepository;
  }

  // El backend entrega por zona: se juntan las de todas las zonas de la emergencia.
  // Devuelve las entregas más recientes (las que van en camino primero) y el % validado en blockchain.
  async execute({ zones, limit = 5 }) {
    const perZone = await Promise.all(
      zones.map(async (zone) => {
        try {
          const deliveries = await this.deliveryRepository.findByZone(zone.id);
          return deliveries.map((d) => d.withZoneName(zone.name));
        } catch {
          return []; // una zona que falla no tumba el tablero
        }
      }),
    );
    const all = perZone.flat();

    const recent = [...all]
      .sort((a, b) => (b.deliveredAt ?? Infinity) - (a.deliveredAt ?? Infinity))
      .slice(0, limit);

    const registered = all.filter((d) => d.status !== DeliveryStatus.INITIATED);
    const verified = registered.filter((d) => d.status === DeliveryStatus.CERTIFIED).length;

    return { recent, stats: new VerificationStats({ verified, total: registered.length }) };
  }
}
