import { parsePositive } from '../../domain/services/parseQuantity.js';

export class WithdrawStock {
  constructor(inventoryRepository) {
    this.inventoryRepository = inventoryRepository;
  }

  // Una salida es un ajuste negativo con motivo. Errores de validación: resourceRequired, quantityInvalid,
  // reasonRequired, reasonTooLong, exceedsAvailable (el backend también lo rechaza con 409 si no alcanza lo disponible).
  async execute({ inventoryId, resource, quantity, reason }) {
    if (!resource) throw new Error('resourceRequired');
    const amount = parsePositive(quantity);
    if (amount === null) throw new Error('quantityInvalid');
    const cleanReason = (reason ?? '').trim();
    if (!cleanReason) throw new Error('reasonRequired');
    if (cleanReason.length > 300) throw new Error('reasonTooLong');
    if (amount > resource.available) throw new Error('exceedsAvailable');
    return this.inventoryRepository.adjust(inventoryId, resource.id, -amount, cleanReason);
  }
}
