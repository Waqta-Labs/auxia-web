import { parsePositive } from '../../domain/services/parseQuantity.js';

export class RestockResource {
  constructor(inventoryRepository) {
    this.inventoryRepository = inventoryRepository;
  }

  // Errores de validación: resourceRequired, quantityInvalid.
  async execute({ inventoryId, resourceId, quantity }) {
    if (!resourceId) throw new Error('resourceRequired');
    const amount = parsePositive(quantity);
    if (amount === null) throw new Error('quantityInvalid');
    return this.inventoryRepository.restock(inventoryId, resourceId, amount);
  }
}
