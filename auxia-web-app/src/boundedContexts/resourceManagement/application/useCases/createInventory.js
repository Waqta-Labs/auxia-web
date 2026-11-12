export class CreateInventory {
  constructor(inventoryRepository) {
    this.inventoryRepository = inventoryRepository;
  }

  async execute() {
    return this.inventoryRepository.create();
  }
}
