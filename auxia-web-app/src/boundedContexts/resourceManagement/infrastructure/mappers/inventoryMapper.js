import { Inventory } from '../../domain/entities/Inventory.js';
import { StockResource } from '../../domain/entities/StockResource.js';
import { StockAlert } from '../../domain/entities/StockAlert.js';
import { parseUtc } from '@shared/utils/formatters.js';

const num = (...values) => {
  const found = values.find((value) => value !== undefined && value !== null);
  return found === undefined ? undefined : Number(found);
};

// Recurso del inventario. El README no lista los campos: se aceptan los nombres más probables
// (onHand/reserved/available/minimumStock/belowMinimum) y variantes; ajusta aquí si el JSON real difiere.
export function toStockResource(dto) {
  const onHand = num(dto.onHand, dto.onHandQuantity, dto.quantityOnHand, dto.stock) ?? 0;
  const reserved = num(dto.reserved, dto.reservedQuantity, dto.quantityReserved) ?? 0;
  return new StockResource({
    id: dto.resourceId ?? dto.id,
    name: dto.name ?? dto.resourceName ?? '—',
    category: dto.category ?? null,
    unit: dto.unit ?? dto.unitOfMeasure ?? '',
    onHand,
    reserved,
    available: num(dto.available, dto.availableQuantity, dto.quantityAvailable) ?? onHand - reserved,
    minimumStock: num(dto.minimumStock, dto.minStock, dto.minimumQuantity, dto.minimum) ?? 0,
    belowMinimum: typeof dto.belowMinimum === 'boolean' ? dto.belowMinimum : null,
  });
}

export function toInventory(summary, detail) {
  const source = detail ?? summary ?? {};
  const list = source.resources ?? source.items ?? source.stock ?? [];
  return new Inventory({
    id: summary?.id ?? detail?.id ?? detail?.inventoryId,
    name: summary?.name ?? detail?.name ?? null,
    resources: list.map(toStockResource),
  });
}

// Alerta de la tabla stock_alerts: recurso, estado, cantidades al momento de la alerta y fechas.
export function toStockAlert(dto) {
  return new StockAlert({
    id: dto.id,
    resourceId: dto.resourceId ?? dto.resource?.id ?? null,
    resourceName: dto.resourceName ?? dto.resource?.name ?? null,
    status: dto.status ?? 'OPEN',
    available: num(dto.availableQuantity, dto.available) ?? null,
    minimumStock: num(dto.minimumStock, dto.minimum) ?? null,
    raisedAt: parseUtc(dto.raisedAt ?? dto.createdAt ?? dto.openedAt),
    resolvedAt: parseUtc(dto.resolvedAt),
  });
}
