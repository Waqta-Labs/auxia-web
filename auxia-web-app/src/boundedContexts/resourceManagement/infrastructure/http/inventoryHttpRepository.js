import { InventoryRepository } from '../../domain/repositories/inventoryRepository.js';
import { toInventory, toStockAlert } from '../mappers/inventoryMapper.js';
import { httpClient } from '@shared/infrastructure/http/httpClient.js';
import { asList } from '@shared/infrastructure/http/asList.js';
import { toApiError } from '@shared/infrastructure/http/toApiError.js';

const call = async (request) => {
  try {
    return await request();
  } catch (error) {
    throw toApiError(error);
  }
};

const base = (inventoryId) => '/inventories/' + inventoryId;

export class InventoryHttpRepository extends InventoryRepository {
  // GET /inventories (el de la organización) y luego el detalle con el stock. 404 = aún no hay inventario.
  async find() {
    let summary;
    try {
      const { data } = await call(() => httpClient.get('/inventories'));
      summary = Array.isArray(data) ? data[0] : data?.content ? data.content[0] : data;
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
    if (!summary?.id) return null;
    const { data: detail } = await call(() => httpClient.get(base(summary.id)));
    return toInventory(summary, detail);
  }

  async findAlerts(inventoryId, status) {
    const { data } = await call(() => httpClient.get(base(inventoryId) + '/alerts', { params: { status } }));
    return asList(data).map(toStockAlert);
  }

  // El body es una suposición ({ name }): el inventario es uno por organización.
  async create() {
    const { data } = await call(() => httpClient.post('/inventories', { name: 'Almacén central' }));
    return data?.id ?? null;
  }

  // RegisterResourceRequest: name (máx. 150), category (WATER, FOOD, SHELTER, HYGIENE, MEDICINE, OTHER),
  // unit (UNIT, KG, LITER, KIT), minimumStock (entero >= 0).
  async registerResource(inventoryId, body) {
    const { data } = await call(() => httpClient.post(base(inventoryId) + '/resources', body));
    return data?.id ?? data?.resourceId ?? null;
  }

  // RestockRequest: { quantity } (entero > 0).
  async restock(inventoryId, resourceId, quantity) {
    await call(() => httpClient.post(base(inventoryId) + '/resources/' + resourceId + '/restock', { quantity }));
  }

  // AdjustStockRequest: { quantityChange (entero con signo, nunca 0; negativo = salida), reason (máx. 300) }.
  async adjust(inventoryId, resourceId, quantityChange, reason) {
    await call(() => httpClient.patch(base(inventoryId) + '/resources/' + resourceId + '/adjustment', { quantityChange, reason }));
  }
}
