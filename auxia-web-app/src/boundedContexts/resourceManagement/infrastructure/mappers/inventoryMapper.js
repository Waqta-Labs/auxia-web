import { Inventory } from '../../domain/entities/Inventory.js';
import { StockResource } from '../../domain/entities/StockResource.js';
import { StockAlert } from '../../domain/entities/StockAlert.js';
import { parseUtc } from '@shared/utils/formatters.js';

const num = (...values) => {
  const found = values.find((value) => value !== undefined && value !== null);
  return found === undefined ? undefined : Number(found);
};

// Primer valor escalar cuyo nombre de campo calza con alguno de los patrones (en orden de preferencia).
const pick = (dto, ...patterns) => {
  for (const pattern of patterns) {
    const key = Object.keys(dto).find((name) => pattern.test(name) && dto[name] !== null && typeof dto[name] !== 'object');
    if (key) return dto[key];
  }
  return undefined;
};

// GET /inventories/{id} (Swagger): { id, organizationId, name, stockItems: [{ resourceId, name, category, unit, onHand,
// reserved, available, minimumStock, belowMinimum }] }. Por si el nombre del arreglo cambia, si no está en stockItems el primer arreglo de objetos del detalle (también un nivel más adentro).
export function findResourceList(source) {
  if (!source || typeof source !== 'object') return [];
  if (Array.isArray(source)) return source;
  const known = source.stockItems ?? source.resources ?? source.items ?? source.stock ?? source.lines ?? source.content;
  if (Array.isArray(known)) return known;
  const arrays = Object.values(source).filter((value) => Array.isArray(value) && value.every((item) => item && typeof item === 'object'));
  if (arrays.length > 0) return arrays.sort((x, y) => y.length - x.length)[0];
  for (const value of Object.values(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = findResourceList(value);
      if (nested.length > 0) return nested;
    }
  }
  return [];
}

// Recurso del inventario: acepta onHand/reserved/available/minimumStock/belowMinimum y variantes de esos nombres.
export function toStockResource(dto) {
  const onHand = num(dto.onHand, pick(dto, /^onhand/i, /onhand/i, /^quantity$/i, /^stock$/i, /^quantityOnHand/i)) ?? 0;
  const reserved = num(pick(dto, /^reserved/i, /reserved/i)) ?? 0;
  const availableRaw = num(pick(dto, /^available/i, /available/i));
  const belowRaw = pick(dto, /^belowMin/i, /below/i);
  return new StockResource({
    id: dto.resourceId ?? dto.id,
    name: dto.name ?? dto.resourceName ?? '—',
    category: dto.category ?? null,
    unit: dto.unit ?? dto.unitOfMeasure ?? '',
    onHand,
    reserved,
    available: availableRaw ?? onHand - reserved,
    minimumStock: num(pick(dto, /^min(imum)?(stock|quantity)?$/i, /^min/i)) ?? 0,
    belowMinimum: typeof belowRaw === 'boolean' ? belowRaw : null,
  });
}

export function toInventory(summary, detail) {
  const list = findResourceList(detail).length > 0 ? findResourceList(detail) : findResourceList(summary);
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
