export class GetInventory {
  constructor(inventoryRepository) {
    this.inventoryRepository = inventoryRepository;
  }

  // null si la organización todavía no tiene inventario.
  async execute() {
    return this.inventoryRepository.find();
  }
}
