// Contrato. Backend (Resource Management), inventario de la organización del usuario:
//   GET   /inventories                                      el inventario (404 si todavía no existe)
//   GET   /inventories/{id}?category=                       stock de cada recurso: en almacén, reservado, disponible
//   GET   /inventories/{id}/alerts?status=                  OPEN | RESOLVED, la más reciente primero
//   POST  /inventories                                      crea el inventario (ORGANIZATION_ADMIN)
//   POST  /inventories/{id}/resources                       registra un recurso sin stock
//   POST  /inventories/{id}/resources/{rid}/restock         ingreso de una cantidad
//   PATCH /inventories/{id}/resources/{rid}/adjustment      suma o resta una cantidad, con motivo
export class InventoryRepository {
  async find() { throw new Error('InventoryRepository.find no implementado'); }
  async findAlerts() { throw new Error('InventoryRepository.findAlerts no implementado'); }
  async create() { throw new Error('InventoryRepository.create no implementado'); }
  async registerResource() { throw new Error('InventoryRepository.registerResource no implementado'); }
  async restock() { throw new Error('InventoryRepository.restock no implementado'); }
  async adjust() { throw new Error('InventoryRepository.adjust no implementado'); }
}
