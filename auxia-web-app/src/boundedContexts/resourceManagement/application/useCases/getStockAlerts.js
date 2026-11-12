export class GetStockAlerts {
  constructor(inventoryRepository) {
    this.inventoryRepository = inventoryRepository;
  }

  async execute({ inventoryId, status = 'OPEN' }) {
    return this.inventoryRepository.findAlerts(inventoryId, status);
  }
}
