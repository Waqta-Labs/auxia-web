// Inventario y Almacenes (W_04). Uso (en la raíz del proyecto): node buildInventory.mjs   (se puede repetir)
// Backend: /inventories (lista, detalle con stock, alertas, crear inventario, registrar recurso, ingreso, ajuste).
// El backend no tiene historial de movimientos: la pantalla muestra existencias y alertas en su lugar.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const write = (path, content) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content.replace(/^\n/, ''));
  console.log('+ ' + path);
};
const deepMerge = (a, b) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = v && typeof v === 'object' && !Array.isArray(v) ? deepMerge(a?.[k] ?? {}, v) : v;
  return out;
};
const mergeJson = (path, patch) => {
  const current = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  writeFileSync(path, JSON.stringify(deepMerge(current, patch), null, 2) + '\n');
  console.log('~ ' + path);
};

const RM = 'src/boundedContexts/resourceManagement/';
if (!existsSync(RM + 'infrastructure/container.js')) throw new Error('Estate en la raíz del proyecto (donde está package.json).');

// Lee con \n y respeta los \r\n de Windows al escribir de vuelta (los archivos de la app pueden venir con CRLF).
const readLf = (path) => {
  const raw = readFileSync(path, 'utf8');
  return { text: raw.replace(/\r\n/g, '\n'), crlf: raw.includes('\r\n') };
};
const writeLf = (path, text, crlf) => writeFileSync(path, crlf ? text.replace(/\n/g, '\r\n') : text);
// Reemplaza un fragmento; si el resultado ya está, no hace nada (se puede correr varias veces).
const patch = (path, pairs) => {
  let { text, crlf } = readLf(path);
  for (const [from, to] of pairs) {
    if (to !== '' && text.includes(to)) continue;
    if (!text.includes(from)) { if (to === '') continue; throw new Error('No encontré el fragmento esperado en ' + path + ':\n' + from); }
    text = text.replace(from, to);
  }
  writeLf(path, text, crlf);
  console.log('~ ' + path);
};
const appendOnce = (path, marker, css) => {
  const { text, crlf } = readLf(path);
  if (text.includes(marker)) return;
  writeLf(path, text.replace(/\s*$/, '\n') + '\n' + marker + '\n' + css, crlf);
  console.log('~ ' + path);
};


/* ════════════════════════ RUTAS, MIGAS DE PAN Y HINTS GLOBALES ════════════════════════ */
patch('src/app/router/routes.js', [[
  "  inventory: '/inventory',\n",
  "  inventory: '/inventory',\n  inventoryAlerts: '/inventory/alerts',\n  inventoryResources: '/inventory/resources',\n",
]]);
patch('src/app/router/index.jsx', [[
  "                path: routes.inventory,\n                ...page(() => import('@bc/resourceManagement/presentation/pages/inventoryPage.jsx')),\n              },\n",
  "                path: routes.inventory,\n                ...page(() => import('@bc/resourceManagement/presentation/pages/inventoryPage.jsx')),\n              },\n" +
  "              {\n                path: routes.inventoryAlerts,\n                ...page(() => import('@bc/resourceManagement/presentation/pages/inventoryAlertsPage.jsx')),\n              },\n" +
  "              {\n                path: routes.inventoryResources,\n                ...page(() => import('@bc/resourceManagement/presentation/pages/inventoryResourcesPage.jsx')),\n              },\n",
]]);

// Hints de todos los inputs (input::placeholder) en el color night-100.
appendOnce('src/shared/presentation/styles/tokens.css', '/* Hints de los inputs */',
  'input::placeholder,\ntextarea::placeholder {\n  color: var(--night-100);\n  opacity: 1;\n}\n');
if (existsSync('src/boundedContexts/identityAccess/presentation/styles/signIn.css')) {
  patch('src/boundedContexts/identityAccess/presentation/styles/signIn.css', [[
    '.si-input input::placeholder { color: var(--gray-200); }',
    '.si-input input::placeholder { color: var(--night-100); }',
  ]]);
}

write('src/shared/presentation/components/breadcrumb.jsx', String.raw`
import { Link } from 'react-router-dom';
import './breadcrumb.css';

// Migas de pan: items = [{ label, to? }]; el último es la pantalla actual (sin enlace).
export default function Breadcrumb({ label, items }) {
  return (
    <nav className="bc" aria-label={label}>
      <ol>
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={item.label}>
              {last || !item.to ? <span aria-current={last ? 'page' : undefined}>{item.label}</span> : <Link to={item.to}>{item.label}</Link>}
              {!last && <span className="bc__sep" aria-hidden="true">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
`);
write('src/shared/presentation/components/breadcrumb.css', String.raw`
.bc ol { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0; padding: 0; list-style: none; font-size: 0.875rem; }
.bc li { display: inline-flex; align-items: center; gap: 8px; }
.bc a { color: var(--color-sky); text-decoration: none; font-weight: 600; }
.bc a:hover { text-decoration: underline; }
.bc a:focus-visible { outline: 2px solid var(--color-sky); outline-offset: 2px; border-radius: 4px; }
.bc [aria-current='page'] { color: #fff; font-weight: 600; }
.bc__sep { color: var(--night-100); }
`);

/* ════════════════════════ DOMAIN ════════════════════════ */
write(RM + 'domain/enums/stockCategory.js', String.raw`
// Categoría de un recurso (RegisterResourceRequest del backend).
export const StockCategory = Object.freeze({
  WATER: 'WATER', FOOD: 'FOOD', SHELTER: 'SHELTER', HYGIENE: 'HYGIENE', MEDICINE: 'MEDICINE', OTHER: 'OTHER',
});
export const stockCategories = Object.values(StockCategory);

// Unidad de medida (backend): UNIT, KG, LITER o KIT.
export const StockUnit = Object.freeze({ UNIT: 'UNIT', KG: 'KG', LITER: 'LITER', KIT: 'KIT' });
export const stockUnits = Object.values(StockUnit);
`);

write(RM + 'domain/entities/StockResource.js', String.raw`
// Nivel de existencias: CRITICAL (casi agotado), LOW (bajo el mínimo) u OK.
export const StockLevel = Object.freeze({ CRITICAL: 'CRITICAL', LOW: 'LOW', OK: 'OK' });

// Un recurso con sus cantidades: en almacén (onHand), reservada para planes (reserved) y disponible (available = onHand - reserved).
export class StockResource {
  constructor({ id, name, category = null, unit = '', onHand = 0, reserved = 0, available = null, minimumStock = 0, belowMinimum = null }) {
    this.id = id;
    this.name = name;
    this.category = category;
    this.unit = unit;
    this.onHand = onHand;
    this.reserved = reserved;
    this.available = available ?? onHand - reserved;
    this.minimumStock = minimumStock;
    this.belowMinimum = belowMinimum ?? this.available < minimumStock;
    Object.freeze(this);
  }

  // Parte del almacén que sigue disponible (0 a 1), para la barra de la tarjeta.
  get availableRatio() {
    return this.onHand > 0 ? Math.min(1, Math.max(0, this.available / this.onHand)) : 0;
  }

  get level() {
    if (this.available <= 0) return StockLevel.CRITICAL;
    if (!this.belowMinimum) return StockLevel.OK;
    return this.minimumStock > 0 && this.available < this.minimumStock / 2 ? StockLevel.CRITICAL : StockLevel.LOW;
  }
}
`);

write(RM + 'domain/entities/Inventory.js', String.raw`
// El inventario de la organización (uno por organización) con el stock de cada recurso.
export class Inventory {
  constructor({ id, name = null, resources = [] }) {
    this.id = id;
    this.name = name;
    this.resources = resources;
    Object.freeze(this);
  }
}
`);

write(RM + 'domain/entities/StockAlert.js', String.raw`
// Alerta de stock bajo: OPEN mientras el recurso siga bajo su mínimo; RESOLVED cuando se repone.
export class StockAlert {
  constructor({ id, resourceId, resourceName = null, status, available = null, minimumStock = null, raisedAt = null, resolvedAt = null }) {
    this.id = id;
    this.resourceId = resourceId;
    this.resourceName = resourceName;
    this.status = status;
    this.available = available;
    this.minimumStock = minimumStock;
    this.raisedAt = raisedAt;       // epoch ms
    this.resolvedAt = resolvedAt;   // epoch ms
    Object.freeze(this);
  }

  get isOpen() {
    return this.status === 'OPEN';
  }
}
`);

write(RM + 'domain/repositories/inventoryRepository.js', String.raw`
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
`);

write(RM + 'domain/services/stockSummary.js', String.raw`
import { StockLevel } from '../entities/StockResource.js';

export const CategoryFilter = Object.freeze({
  ALL: 'ALL', WATER: 'WATER', FOOD: 'FOOD', SHELTER: 'SHELTER', HYGIENE: 'HYGIENE', MEDICINE: 'MEDICINE', OTHER: 'OTHER',
});

export function filterByCategory(resources, category) {
  return category === CategoryFilter.ALL ? resources : resources.filter((resource) => resource.category === category);
}

export function countByCategory(resources) {
  const counts = { ALL: resources.length };
  resources.forEach((resource) => { counts[resource.category] = (counts[resource.category] ?? 0) + 1; });
  return counts;
}

const levelWeight = { [StockLevel.CRITICAL]: 0, [StockLevel.LOW]: 1, [StockLevel.OK]: 2 };

// Los recursos más urgentes primero (críticos, luego bajos), y por nombre dentro de cada nivel.
export const byUrgency = (a, b) => levelWeight[a.level] - levelWeight[b.level] || a.name.localeCompare(b.name);

// Alertas abiertas, la del recurso más escaso primero (disponible / mínimo).
export function sortAlertsByUrgency(alerts, resources) {
  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  const ratio = (alert) => {
    const resource = byId.get(alert.resourceId);
    const min = resource?.minimumStock ?? alert.minimumStock ?? 0;
    const available = resource?.available ?? alert.available ?? 0;
    return min > 0 ? available / min : 0;
  };
  return [...alerts].sort((a, b) => ratio(a) - ratio(b));
}

// La alerta abierta del recurso más escaso: va en el aviso rojo de arriba.
export const mostUrgentAlert = (alerts, resources) => sortAlertsByUrgency(alerts.filter((alert) => alert.isOpen), resources)[0] ?? null;

`);

write(RM + 'domain/services/parseQuantity.js', String.raw`
// Cantidad escrita por la persona ("12"): entero mayor que 0 (el backend la recibe como int32), o null si no es válida.
export function parsePositive(value) {
  const text = String(value ?? '').trim();
  const n = Number(text);
  return /^\d+$/.test(text) && Number.isSafeInteger(n) && n > 0 && n <= 2147483647 ? n : null;
}
`);

/* ════════════════════════ APPLICATION ════════════════════════ */
write(RM + 'application/useCases/getInventory.js', String.raw`
export class GetInventory {
  constructor(inventoryRepository) {
    this.inventoryRepository = inventoryRepository;
  }

  // null si la organización todavía no tiene inventario.
  async execute() {
    return this.inventoryRepository.find();
  }
}
`);

write(RM + 'application/useCases/getStockAlerts.js', String.raw`
export class GetStockAlerts {
  constructor(inventoryRepository) {
    this.inventoryRepository = inventoryRepository;
  }

  async execute({ inventoryId, status = 'OPEN' }) {
    return this.inventoryRepository.findAlerts(inventoryId, status);
  }
}
`);

write(RM + 'application/useCases/createInventory.js', String.raw`
export class CreateInventory {
  constructor(inventoryRepository) {
    this.inventoryRepository = inventoryRepository;
  }

  async execute() {
    return this.inventoryRepository.create();
  }
}
`);

write(RM + 'application/useCases/registerResource.js', String.raw`
export class RegisterResource {
  constructor(inventoryRepository) {
    this.inventoryRepository = inventoryRepository;
  }

  // Errores de validación: nameRequired, nameTooLong, categoryRequired, unitRequired, minimumInvalid.
  async execute({ inventoryId, name, category, unit, minimumStock }) {
    const cleanName = (name ?? '').trim();
    if (!cleanName) throw new Error('nameRequired');
    if (cleanName.length > 150) throw new Error('nameTooLong');
    if (!category) throw new Error('categoryRequired');
    if (!unit) throw new Error('unitRequired');
    // minimumStock es un entero (int32) igual o mayor que 0; vacío = 0.
    const raw = String(minimumStock ?? '').trim();
    const minimum = raw === '' ? 0 : Number(raw);
    if (!Number.isInteger(minimum) || minimum < 0) throw new Error('minimumInvalid');
    return this.inventoryRepository.registerResource(inventoryId, { name: cleanName, category, unit, minimumStock: minimum });
  }
}
`);

write(RM + 'application/useCases/restockResource.js', String.raw`
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
`);

write(RM + 'application/useCases/withdrawStock.js', String.raw`
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
`);

/* ════════════════════════ INFRASTRUCTURE ════════════════════════ */
write(RM + 'infrastructure/mappers/inventoryMapper.js', String.raw`
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
`);

write(RM + 'infrastructure/http/inventoryHttpRepository.js', String.raw`
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
`);

write(RM + 'infrastructure/mock/inventoryMockRepository.js', String.raw`
import { InventoryRepository } from '../../domain/repositories/inventoryRepository.js';
import { toInventory, toStockAlert } from '../mappers/inventoryMapper.js';
import { delay } from '@shared/infrastructure/mock/delay.js';

const problem = (status, detail) => Object.assign(new Error(detail), { status, detail });
const iso = (hoursAgo) => new Date(Date.now() - hoursAgo * 3600000).toISOString().slice(0, 19);

// Los 4 primeros repiten el mockup (agua crítica, raciones OK, kits bajos, carpas OK).
let resources = [
  { id: 'rs-01', name: 'Agua embotellada', category: 'WATER', unit: 'LITER', onHand: 2400, reserved: 1250, minimumStock: 2500 },
  { id: 'rs-02', name: 'Raciones', category: 'FOOD', unit: 'UNIT', onHand: 7200, reserved: 400, minimumStock: 3000 },
  { id: 'rs-03', name: 'Kits de Primeros Auxilios', category: 'MEDICINE', unit: 'KIT', onHand: 900, reserved: 260, minimumStock: 750 },
  { id: 'rs-04', name: 'Carpas', category: 'SHELTER', unit: 'UNIT', onHand: 260, reserved: 50, minimumStock: 100 },
  { id: 'rs-05', name: 'Mantas térmicas', category: 'SHELTER', unit: 'UNIT', onHand: 1500, reserved: 0, minimumStock: 600 },
  { id: 'rs-06', name: 'Cuerdas de rescate', category: 'OTHER', unit: 'UNIT', onHand: 800, reserved: 120, minimumStock: 300 },
  { id: 'rs-08', name: 'Jabón y kits de higiene', category: 'HYGIENE', unit: 'KIT', onHand: 540, reserved: 0, minimumStock: 200 },
  { id: 'rs-07', name: 'Medicamentos básicos', category: 'MEDICINE', unit: 'KIT', onHand: 310, reserved: 40, minimumStock: 200 },
];
let alerts = [
  { id: 'al-01', resourceId: 'rs-01', status: 'OPEN', raisedAt: iso(5) },
  { id: 'al-02', resourceId: 'rs-03', status: 'OPEN', raisedAt: iso(2) },
  { id: 'al-03', resourceId: 'rs-02', status: 'RESOLVED', raisedAt: iso(70), resolvedAt: iso(48) },
];
let inventoryExists = true;
let sequence = 8;

const available = (resource) => resource.onHand - resource.reserved;
// Igual que el backend: bajo el mínimo abre una alerta; repuesto por encima del mínimo la resuelve.
function evaluateAlerts() {
  resources.forEach((resource) => {
    const open = alerts.find((alert) => alert.resourceId === resource.id && alert.status === 'OPEN');
    const below = available(resource) < resource.minimumStock;
    if (below && !open) alerts = [{ id: 'al-' + (alerts.length + 1), resourceId: resource.id, status: 'OPEN', raisedAt: iso(0) }, ...alerts];
    if (!below && open) alerts = alerts.map((alert) => (alert === open ? { ...alert, status: 'RESOLVED', resolvedAt: iso(0) } : alert));
  });
}
const alertDto = (alert) => {
  const resource = resources.find((item) => item.id === alert.resourceId);
  return { ...alert, resourceName: resource?.name, availableQuantity: resource ? available(resource) : null, minimumStock: resource?.minimumStock };
};
const stockDto = (resource) => ({
  resourceId: resource.id, name: resource.name, category: resource.category, unit: resource.unit, onHand: resource.onHand,
  reserved: resource.reserved, available: available(resource), minimumStock: resource.minimumStock, belowMinimum: available(resource) < resource.minimumStock,
});
const need = (resourceId) => {
  const resource = resources.find((item) => item.id === resourceId);
  if (!resource) throw problem(404, 'Recurso no encontrado');
  return resource;
};
const update = (resourceId, change) => {
  resources = resources.map((item) => (item.id === resourceId ? { ...item, ...change(item) } : item));
  evaluateAlerts();
};

export class InventoryMockRepository extends InventoryRepository {
  async find() {
    await delay(350);
    if (!inventoryExists) return null;
    return toInventory({ id: 'inv-01', name: 'Almacén Central' }, { resources: resources.map(stockDto) });
  }

  async findAlerts(_inventoryId, status) {
    await delay(300);
    return alerts.filter((alert) => alert.status === status).map(alertDto).map(toStockAlert);
  }

  async create() {
    await delay(500);
    inventoryExists = true;
    return 'inv-01';
  }

  async registerResource(_inventoryId, { name, category, unit, minimumStock }) {
    await delay(500);
    if (resources.some((resource) => resource.name.toLowerCase() === name.toLowerCase())) throw problem(409, 'Ya existe un recurso con ese nombre.');
    sequence += 1;
    const id = 'rs-' + String(sequence).padStart(2, '0');
    resources = [...resources, { id, name, category, unit, onHand: 0, reserved: 0, minimumStock }];
    evaluateAlerts();
    return id;
  }

  async restock(_inventoryId, resourceId, quantity) {
    await delay(500);
    need(resourceId);
    update(resourceId, (resource) => ({ onHand: resource.onHand + quantity }));
  }

  async adjust(_inventoryId, resourceId, quantity) {
    await delay(500);
    const resource = need(resourceId);
    if (available(resource) + quantity < 0) throw problem(409, 'No hay stock disponible suficiente: solo quedan ' + available(resource) + '.');
    update(resourceId, (item) => ({ onHand: item.onHand + quantity }));
  }
}
`);

writeFileSync(RM + 'infrastructure/container.js', String.raw`
import { BrigadeMockRepository } from './mock/brigadeMockRepository.js';
import { BrigadeHttpRepository } from './http/brigadeHttpRepository.js';
import { InventoryMockRepository } from './mock/inventoryMockRepository.js';
import { InventoryHttpRepository } from './http/inventoryHttpRepository.js';
import { GetBrigadeOverview } from '../application/useCases/getBrigadeOverview.js';
import { GetBrigadeList } from '../application/useCases/getBrigadeList.js';
import { GetBrigadeDetail } from '../application/useCases/getBrigadeDetail.js';
import { CreateBrigade } from '../application/useCases/createBrigade.js';
import { AddBrigadeMember } from '../application/useCases/addBrigadeMember.js';
import { RemoveBrigadeMember } from '../application/useCases/removeBrigadeMember.js';
import { SetBrigadeAvailability } from '../application/useCases/setBrigadeAvailability.js';
import { GetInventory } from '../application/useCases/getInventory.js';
import { GetStockAlerts } from '../application/useCases/getStockAlerts.js';
import { CreateInventory } from '../application/useCases/createInventory.js';
import { RegisterResource } from '../application/useCases/registerResource.js';
import { RestockResource } from '../application/useCases/restockResource.js';
import { WithdrawStock } from '../application/useCases/withdrawStock.js';
import { env } from '@shared/infrastructure/config/env.js';

const brigadeRepository = env.useMocks ? new BrigadeMockRepository() : new BrigadeHttpRepository();
const inventoryRepository = env.useMocks ? new InventoryMockRepository() : new InventoryHttpRepository();

export const getBrigadeOverviewUseCase = new GetBrigadeOverview(brigadeRepository);
export const getBrigadeListUseCase = new GetBrigadeList(brigadeRepository);
export const getBrigadeDetailUseCase = new GetBrigadeDetail(brigadeRepository);
export const createBrigadeUseCase = new CreateBrigade(brigadeRepository);
export const addBrigadeMemberUseCase = new AddBrigadeMember(brigadeRepository);
export const removeBrigadeMemberUseCase = new RemoveBrigadeMember(brigadeRepository);
export const setBrigadeAvailabilityUseCase = new SetBrigadeAvailability(brigadeRepository);

export const getInventoryUseCase = new GetInventory(inventoryRepository);
export const getStockAlertsUseCase = new GetStockAlerts(inventoryRepository);
export const createInventoryUseCase = new CreateInventory(inventoryRepository);
export const registerResourceUseCase = new RegisterResource(inventoryRepository);
export const restockResourceUseCase = new RestockResource(inventoryRepository);
export const withdrawStockUseCase = new WithdrawStock(inventoryRepository);
`.replace(/^\n/, ''));
console.log('~ ' + RM + 'infrastructure/container.js');

/* ════════════════════════ PRESENTATION: HOOKS ════════════════════════ */
write(RM + 'presentation/hooks/useInventory.js', String.raw`
import { useQuery } from '@tanstack/react-query';
import { getInventoryUseCase } from '../../infrastructure/container.js';

export function useInventory() {
  return useQuery({
    queryKey: ['inventory', 'stock'],
    queryFn: () => getInventoryUseCase.execute(),
  });
}
`);

write(RM + 'presentation/hooks/useStockAlerts.js', String.raw`
import { useQuery } from '@tanstack/react-query';
import { getStockAlertsUseCase } from '../../infrastructure/container.js';

// status: 'OPEN' | 'RESOLVED'
export function useStockAlerts(inventoryId, status = 'OPEN') {
  return useQuery({
    queryKey: ['inventory', 'alerts', inventoryId, status],
    queryFn: () => getStockAlertsUseCase.execute({ inventoryId, status }),
    enabled: Boolean(inventoryId),
  });
}
`);

const mutationHook = (name, useCase, doc) => write(RM + 'presentation/hooks/' + name + '.js', `
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ${useCase} } from '../../infrastructure/container.js';

// ${doc}
export function ${name}() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values) => ${useCase}.execute(values),
    // Refresca existencias, tarjetas y alertas.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
  });
}
`);
mutationHook('useCreateInventory', 'createInventoryUseCase', 'mutate(): crea el inventario de la organización.');
mutationHook('useRegisterResource', 'registerResourceUseCase', 'mutate({ inventoryId, name, category, unit, minimumStock }): registra un recurso sin stock.');
mutationHook('useRestockResource', 'restockResourceUseCase', 'mutate({ inventoryId, resourceId, quantity }): registra un ingreso.');
mutationHook('useWithdrawStock', 'withdrawStockUseCase', 'mutate({ inventoryId, resource, quantity, reason }): registra una salida (ajuste negativo con motivo).');

write(RM + 'presentation/utils/stockFormat.js', String.raw`
import { formatNumber, humanize } from '@shared/utils/formatters.js';

export const categoryLabel = (t, category) => (category ? t('inventory.categories.' + category, { defaultValue: humanize(category) }) : '—');
export const unitLabel = (t, unit) => t('inventory.units.' + unit, { defaultValue: humanize(unit) });
export const levelLabel = (t, level) => t('inventory.levels.' + level);

// Símbolo corto de la unidad (UNIT, KG, LITER, KIT); una unidad desconocida se muestra tal cual.
const UNIT_SYMBOLS = { KG: 'kg', LITER: 'L', KIT: 'kits' };
export const unitSymbol = (unit, lng) => (unit === 'UNIT' ? (lng === 'en' ? 'units' : 'unid.') : UNIT_SYMBOLS[unit] ?? unit ?? '');
export const quantity = (value, unit, lng) => formatNumber(value, lng) + (unit ? ' ' + unitSymbol(unit, lng) : '');

// "hace 3 h", "hace 2 días": desde una fecha (epoch ms) hasta ahora.
export function elapsed(fromMs, lng, toMs = Date.now()) {
  if (fromMs === null || fromMs === undefined) return '';
  const formatter = new Intl.RelativeTimeFormat(lng, { numeric: 'auto' });
  const minutes = Math.max(0, Math.round((toMs - fromMs) / 60000));
  if (minutes < 60) return formatter.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 48) return formatter.format(-hours, 'hour');
  return formatter.format(-Math.round(hours / 24), 'day');
}

const VALIDATION = ['nameRequired', 'nameTooLong', 'categoryRequired', 'unitRequired', 'minimumInvalid', 'resourceRequired', 'quantityInvalid', 'reasonRequired', 'reasonTooLong', 'exceedsAvailable'];

// El backend responde application/problem+json: se muestra su "detail" tal cual; si no hay, un texto según el caso.
export function inventoryErrorMessage(t, error) {
  if (!error) return null;
  if (VALIDATION.includes(error.message)) return t('inventory.errors.' + error.message);
  if (error.detail) return error.detail;
  if (error.status === 403) return t('inventory.errors.forbidden');
  return t('inventory.errors.generic');
}
`);

/* ════════════════════════ PRESENTATION: COMPONENTS ════════════════════════ */
write(RM + 'presentation/components/stockCards.jsx', String.raw`
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { categoryLabel, levelLabel, quantity } from '../utils/stockFormat.js';

// Una tarjeta por recurso: disponible de lo que hay en almacén, nivel y mínimo seguro.
// Con "limit" muestra solo esas (las más urgentes) y, al final, una tarjeta corta "Ver todos" hacia "moreTo".
export default function StockCards({ resources, loading, limit = null, moreTo = null }) {
  const { t, i18n } = useTranslation('resourceManagement');
  const lng = i18n.resolvedLanguage;
  const shown = limit ? resources.slice(0, limit) : resources;
  const hidden = limit ? Math.max(0, resources.length - limit) : 0;
  const rowClass = limit ? ' iv-cards--row' : '';

  if (loading) {
    return <div className={'iv-cards' + rowClass}>{Array.from({ length: limit ?? 4 }, (_, i) => <span key={i} className="iv-skel iv-skel--card" />)}</div>;
  }
  return (
    <ul className={'iv-cards' + rowClass + (hidden > 0 && moreTo ? ' iv-cards--more' : '')} aria-label={t('inventory.cards.label')}>
      {shown.map((resource) => (
        <li key={resource.id} className={'iv-card iv-card--' + resource.level.toLowerCase()}>
          <div className="iv-card__top">
            <strong>{resource.name}</strong>
            <span className={'iv-chip iv-chip--' + resource.level.toLowerCase()}>{levelLabel(t, resource.level)}</span>
          </div>
          <p className="iv-card__qty">
            <span>{new Intl.NumberFormat(lng).format(resource.available)}</span>
            <small>{t('inventory.cards.of', { total: quantity(resource.onHand, resource.unit, lng) })}</small>
          </p>
          <div className="iv-bar" role="img" aria-label={Math.round(resource.availableRatio * 100) + '%'}>
            <span style={{ width: Math.round(resource.availableRatio * 100) + '%' }} />
          </div>
          <p className="iv-card__meta">
            {t('inventory.cards.available')} · {t('inventory.cards.minimum', { value: quantity(resource.minimumStock, resource.unit, lng) })}
            {resource.reserved > 0 && ' · ' + t('inventory.cards.reserved', { value: quantity(resource.reserved, '', lng) })}
          </p>
          <span className="iv-card__cat">{categoryLabel(t, resource.category)}</span>
        </li>
      ))}
      {hidden > 0 && moreTo && (
        <li className="iv-more">
          <Link to={moreTo} aria-label={t('inventory.cards.moreLabel', { count: hidden })}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 17.5h7m-3.5-3.5l3.5 3.5-3.5 3.5" />
            </svg>
            <span>{t('inventory.cards.more')}</span>
            <small>+{hidden}</small>
          </Link>
        </li>
      )}
    </ul>
  );
}
`);

write(RM + 'presentation/components/stockTable.jsx', String.raw`
import { useTranslation } from 'react-i18next';
import { categoryLabel, levelLabel, quantity } from '../utils/stockFormat.js';

// Entrada: círculo con más (añadir). Salida: círculo con menos (restar).
const ICONS = {
  in: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  out: <><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /></>,
};

function ActionIcon({ kind, label, onClick }) {
  return (
    <button type="button" className={'iv-icon-btn iv-icon-btn--' + kind} onClick={onClick} aria-label={label} title={label}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ICONS[kind]}
      </svg>
    </button>
  );
}

export default function StockTable({ resources, loading, canManage, onRestock, onWithdraw }) {
  const { t, i18n } = useTranslation('resourceManagement');
  const lng = i18n.resolvedLanguage;

  if (loading) return <div className="iv-rows">{[0, 1, 2, 3].map((i) => <span key={i} className="iv-skel" />)}</div>;
  if (resources.length === 0) return <p className="iv-empty">{t('inventory.table.empty')}</p>;

  return (
    <div className="iv-table-wrap">
      <table className="iv-table">
        <thead>
          <tr>
            <th scope="col">{t('inventory.table.resource')}</th>
            <th scope="col">{t('inventory.table.category')}</th>
            <th scope="col" className="is-num">{t('inventory.table.onHand')}</th>
            <th scope="col" className="is-num">{t('inventory.table.reserved')}</th>
            <th scope="col" className="is-num">{t('inventory.table.available')}</th>
            <th scope="col" className="is-num">{t('inventory.table.minimum')}</th>
            <th scope="col">{t('inventory.table.status')}</th>
            {canManage && <th scope="col" className="is-actions">{t('inventory.table.actions')}</th>}
          </tr>
        </thead>
        <tbody>
          {resources.map((resource) => (
            <tr key={resource.id}>
              <th scope="row">{resource.name}</th>
              <td>{categoryLabel(t, resource.category)}</td>
              <td className="is-num">{quantity(resource.onHand, resource.unit, lng)}</td>
              <td className="is-num">{quantity(resource.reserved, '', lng)}</td>
              <td className="is-num"><strong>{quantity(resource.available, resource.unit, lng)}</strong></td>
              <td className="is-num">{quantity(resource.minimumStock, '', lng)}</td>
              <td><span className={'iv-chip iv-chip--' + resource.level.toLowerCase()}>{levelLabel(t, resource.level)}</span></td>
              {canManage && (
                <td className="is-actions">
                  <div className="iv-actions">
                    <ActionIcon kind="in" label={t('inventory.table.inFor', { name: resource.name })} onClick={() => onRestock(resource.id)} />
                    <ActionIcon kind="out" label={t('inventory.table.outFor', { name: resource.name })} onClick={() => onWithdraw(resource.id)} />
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
`);

write(RM + 'presentation/components/alertsPanel.jsx', String.raw`
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '@shared/utils/formatters.js';
import { quantity } from '../utils/stockFormat.js';

// Vista previa de las alertas abiertas (las más urgentes). El detalle completo está en la pantalla de Alertas.
export default function AlertsPanel({ alerts, total, resources, loading, error, canManage, onRestock, viewAllTo, limit = 3 }) {
  const { t, i18n } = useTranslation('resourceManagement');
  const lng = i18n.resolvedLanguage;
  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  const shown = alerts.slice(0, limit);

  return (
    <section className="iv-card-panel" aria-labelledby="iv-alerts-title">
      <header className="iv-panel__head">
        <h2 id="iv-alerts-title" className="iv-h2">{t('inventory.alerts.title')}</h2>
        {total > 0 && <span className="iv-count">{total}</span>}
      </header>

      {loading && <span className="iv-skel iv-skel--tall" />}
      {error && <p className="iv-error" role="alert">{error.detail ?? t('inventory.alerts.loadError')}</p>}
      {!loading && !error && shown.length === 0 && <p className="iv-empty">{t('inventory.alerts.empty.OPEN')}</p>}

      <ul className="iv-alerts">
        {shown.map((alert) => {
          const resource = byId.get(alert.resourceId);
          const name = alert.resourceName ?? resource?.name ?? '—';
          const unit = resource?.unit ?? '';
          const available = resource?.available ?? alert.available;
          const minimum = resource?.minimumStock ?? alert.minimumStock;
          return (
            <li key={alert.id} className="iv-alert">
              <div className="iv-alert__row">
                <strong>{name}</strong>
                {canManage && resource && (
                  <button type="button" className="iv-btn-outline iv-btn-sm" onClick={() => onRestock(alert.resourceId)}>{t('inventory.alerts.restock')}</button>
                )}
              </div>
              {available !== null && available !== undefined && minimum !== null && minimum !== undefined && (
                <p className="iv-alert__warn">{t('inventory.alerts.detail', { available: quantity(available, unit, lng), minimum: quantity(minimum, '', lng) })}</p>
              )}
              <small>{t('inventory.alerts.raised', { date: alert.raisedAt ? formatDateTime(alert.raisedAt, lng) : '—' })}</small>
            </li>
          );
        })}
      </ul>

      <Link to={viewAllTo} className="iv-viewall">
        {total > shown.length ? t('inventory.alerts.viewAll', { count: total }) : t('inventory.alerts.viewDetail')} <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
`);

write(RM + 'presentation/components/stockDialog.jsx', String.raw`
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRestockResource } from '../hooks/useRestockResource.js';
import { useWithdrawStock } from '../hooks/useWithdrawStock.js';
import { inventoryErrorMessage, quantity, unitSymbol } from '../utils/stockFormat.js';

// mode 'in': registrar entrada (ingreso). mode 'out': registrar salida (ajuste negativo con motivo).
export default function StockDialog({ mode, inventoryId, resources, resourceId, onClose }) {
  const { t, i18n } = useTranslation('resourceManagement');
  const lng = i18n.resolvedLanguage;
  const isOut = mode === 'out';
  const [selected, setSelected] = useState(resourceId ?? resources[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const restock = useRestockResource();
  const withdraw = useWithdrawStock();
  const mutation = isOut ? withdraw : restock;
  const firstRef = useRef(null);
  const resource = resources.find((item) => item.id === selected) ?? null;

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (event) => {
    event.preventDefault();
    if (isOut) withdraw.mutate({ inventoryId, resource, quantity: amount, reason }, { onSuccess: onClose });
    else restock.mutate({ inventoryId, resourceId: selected, quantity: amount }, { onSuccess: onClose });
  };
  const message = inventoryErrorMessage(t, mutation.error);

  return (
    <>
      <div className="iv-backdrop" onClick={onClose} aria-hidden="true" />
      <form className="iv-dialog" role="dialog" aria-modal="true" aria-labelledby="iv-dialog-title" onSubmit={submit} noValidate>
        <h2 id="iv-dialog-title" className="iv-h2">{t(isOut ? 'inventory.out.title' : 'inventory.in.title')}</h2>
        <p className="iv-note">{t(isOut ? 'inventory.out.hint' : 'inventory.in.hint')}</p>

        <label className="iv-field">
          <span>{t('inventory.form.resource')}</span>
          <select ref={firstRef} value={selected} onChange={(event) => setSelected(event.target.value)}>
            {resources.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        {resource && (
          <p className="iv-note">
            {t('inventory.form.current', { onHand: quantity(resource.onHand, resource.unit, lng), available: quantity(resource.available, resource.unit, lng) })}
          </p>
        )}
        <label className="iv-field">
          <span>{t('inventory.form.quantity')}{resource?.unit ? ' (' + unitSymbol(resource.unit, lng) + ')' : ''}</span>
          <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="numeric" placeholder="0" />
        </label>
        {isOut && (
          <label className="iv-field">
            <span>{t('inventory.form.reason')}</span>
            <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t('inventory.form.reasonPlaceholder')} maxLength={300} />
          </label>
        )}

        {message && <p className="iv-error" role="alert">{message}</p>}
        <div className="iv-dialog__actions">
          <button type="submit" className="iv-btn-lime" disabled={mutation.isPending}>
            {mutation.isPending ? t('inventory.form.saving') : t(isOut ? 'inventory.out.submit' : 'inventory.in.submit')}
          </button>
          <button type="button" className="iv-btn-outline" onClick={onClose} disabled={mutation.isPending}>{t('inventory.form.cancel')}</button>
        </div>
      </form>
    </>
  );
}
`);

write(RM + 'presentation/components/newResourceDialog.jsx', String.raw`
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { stockCategories, stockUnits } from '../../domain/enums/stockCategory.js';
import { useRegisterResource } from '../hooks/useRegisterResource.js';
import { categoryLabel, inventoryErrorMessage, unitLabel } from '../utils/stockFormat.js';

export default function NewResourceDialog({ inventoryId, onClose }) {
  const { t } = useTranslation('resourceManagement');
  const [values, setValues] = useState({ name: '', category: '', unit: '', minimumStock: '' });
  const mutation = useRegisterResource();
  const nameRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const change = (key) => (event) => setValues((current) => ({ ...current, [key]: event.target.value }));
  const submit = (event) => {
    event.preventDefault();
    mutation.mutate({ inventoryId, ...values }, { onSuccess: onClose });
  };
  const message = inventoryErrorMessage(t, mutation.error);

  return (
    <>
      <div className="iv-backdrop" onClick={onClose} aria-hidden="true" />
      <form className="iv-dialog" role="dialog" aria-modal="true" aria-labelledby="iv-new-title" onSubmit={submit} noValidate>
        <h2 id="iv-new-title" className="iv-h2">{t('inventory.new.title')}</h2>
        <p className="iv-note">{t('inventory.new.hint')}</p>
        <label className="iv-field"><span>{t('inventory.new.name')}</span><input ref={nameRef} value={values.name} onChange={change('name')} maxLength={150} /></label>
        <label className="iv-field">
          <span>{t('inventory.new.category')}</span>
          <select value={values.category} onChange={change('category')}>
            <option value="">{t('inventory.new.categoryPlaceholder')}</option>
            {stockCategories.map((category) => <option key={category} value={category}>{categoryLabel(t, category)}</option>)}
          </select>
        </label>
        <div className="iv-field-row">
          <label className="iv-field">
            <span>{t('inventory.new.unit')}</span>
            <select value={values.unit} onChange={change('unit')}>
              <option value="">{t('inventory.new.unitPlaceholder')}</option>
              {stockUnits.map((unit) => <option key={unit} value={unit}>{unitLabel(t, unit)}</option>)}
            </select>
          </label>
          <label className="iv-field"><span>{t('inventory.new.minimum')}</span><input value={values.minimumStock} onChange={change('minimumStock')} inputMode="numeric" placeholder="0" /></label>
        </div>
        {message && <p className="iv-error" role="alert">{message}</p>}
        <div className="iv-dialog__actions">
          <button type="submit" className="iv-btn-lime" disabled={mutation.isPending}>{mutation.isPending ? t('inventory.form.saving') : t('inventory.new.submit')}</button>
          <button type="button" className="iv-btn-outline" onClick={onClose} disabled={mutation.isPending}>{t('inventory.form.cancel')}</button>
        </div>
      </form>
    </>
  );
}
`);

/* ════════════════════════ PRESENTATION: PAGE ════════════════════════ */
write(RM + 'presentation/pages/inventoryPage.jsx', String.raw`
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { routes } from '@app/router/routes.js';
import { usePermissions } from '@bc/identityAccess/presentation/hooks/usePermissions.js';
import { CategoryFilter, byUrgency, countByCategory, filterByCategory, mostUrgentAlert, sortAlertsByUrgency } from '../../domain/services/stockSummary.js';
import { useInventory } from '../hooks/useInventory.js';
import { useStockAlerts } from '../hooks/useStockAlerts.js';
import { useCreateInventory } from '../hooks/useCreateInventory.js';
import StockCards from '../components/stockCards.jsx';
import StockTable from '../components/stockTable.jsx';
import AlertsPanel from '../components/alertsPanel.jsx';
import StockDialog from '../components/stockDialog.jsx';
import NewResourceDialog from '../components/newResourceDialog.jsx';
import { inventoryErrorMessage, quantity } from '../utils/stockFormat.js';
import '../styles/inventory.css';

const MAX_CARDS = 5;

export default function InventoryPage() {
  const { t, i18n } = useTranslation('resourceManagement');
  const lng = i18n.resolvedLanguage;
  const { isAdmin } = usePermissions();            // solo el administrador de la organización modifica el stock

  const inventoryQuery = useInventory();
  const inventory = inventoryQuery.data ?? null;
  const openAlerts = useStockAlerts(inventory?.id, 'OPEN');
  const createInventory = useCreateInventory();

  const [category, setCategory] = useState(CategoryFilter.ALL);
  const [dialog, setDialog] = useState(null);      // { type: 'in' | 'out' | 'new', resourceId? }

  const resources = useMemo(() => [...(inventory?.resources ?? [])].sort(byUrgency), [inventory]);
  const counts = useMemo(() => countByCategory(resources), [resources]);
  const visible = useMemo(() => filterByCategory(resources, category), [resources, category]);
  const alerts = useMemo(() => sortAlertsByUrgency(openAlerts.data ?? [], resources), [openAlerts.data, resources]);
  const urgent = useMemo(() => mostUrgentAlert(openAlerts.data ?? [], resources), [openAlerts.data, resources]);
  const urgentResource = urgent ? resources.find((resource) => resource.id === urgent.resourceId) : null;

  const loading = inventoryQuery.isLoading;
  const close = () => setDialog(null);
  const disabled = !inventory || resources.length === 0;

  return (
    <div className="iv">
      <header className="iv-head">
        <div>
          <h1>{t('inventory.title')}</h1>
          <p>{t('inventory.subtitle')}</p>
        </div>
        <div className="iv-head__actions">
          <span className="iv-warehouse" title={t('inventory.warehouse')}>{inventory?.name ?? t('inventory.warehouse')}</span>
          {isAdmin && (
            <>
              <button type="button" className="iv-btn-outline" disabled={disabled} onClick={() => setDialog({ type: 'out' })}>{t('inventory.actions.out')}</button>
              <button type="button" className="iv-btn-lime" disabled={disabled} onClick={() => setDialog({ type: 'in' })}>{t('inventory.actions.in')}</button>
            </>
          )}
        </div>
      </header>

      {inventoryQuery.isError && (
        <p className="iv-alert-banner" role="alert">
          {inventoryQuery.error?.detail ?? t('inventory.loadError')} <button type="button" className="iv-link-btn" onClick={() => inventoryQuery.refetch()}>{t('inventory.retry')}</button>
        </p>
      )}

      {urgent && (
        <p className="iv-banner" role="status">
          <span className="iv-dot" aria-hidden="true" />
          <span>
            {t('inventory.banner', {
              name: urgent.resourceName ?? urgentResource?.name ?? '—',
              available: quantity(urgentResource?.available ?? urgent.available ?? 0, urgentResource?.unit ?? '', lng),
              minimum: quantity(urgentResource?.minimumStock ?? urgent.minimumStock ?? 0, '', lng),
            })}
          </span>
          <Link to={routes.inventoryAlerts} className="iv-link-btn">{t('inventory.viewAlerts')}</Link>
        </p>
      )}

      {!loading && !inventoryQuery.isError && !inventory && (
        <section className="iv-card-panel iv-setup">
          <h2 className="iv-h2">{t('inventory.setup.title')}</h2>
          <p className="iv-note">{t(isAdmin ? 'inventory.setup.admin' : 'inventory.setup.other')}</p>
          {isAdmin && (
            <>
              <button type="button" className="iv-btn-lime" disabled={createInventory.isPending} onClick={() => createInventory.mutate()}>
                {createInventory.isPending ? t('inventory.form.saving') : t('inventory.setup.create')}
              </button>
              {createInventory.error && <p className="iv-error" role="alert">{inventoryErrorMessage(t, createInventory.error)}</p>}
            </>
          )}
        </section>
      )}

      {(loading || inventory) && (
        <>
          <StockCards resources={resources} loading={loading} limit={MAX_CARDS} moreTo={routes.inventoryResources} />
          {!loading && resources.length === 0 && (
            <section className="iv-card-panel iv-setup">
              <h2 className="iv-h2">{t('inventory.noResources.title')}</h2>
              <p className="iv-note">{t(isAdmin ? 'inventory.noResources.admin' : 'inventory.noResources.other')}</p>
            </section>
          )}

          <div className="iv-grid">
            <section className="iv-card-panel" aria-labelledby="iv-stock-title">
              <header className="iv-panel__head">
                <h2 id="iv-stock-title" className="iv-h2">{t('inventory.table.title')}</h2>
                {isAdmin && inventory && (
                  <button type="button" className="iv-btn-outline iv-btn-sm" onClick={() => setDialog({ type: 'new' })}>{t('inventory.actions.newResource')}</button>
                )}
              </header>
              <div className="iv-tabs" role="group" aria-label={t('inventory.table.filter')}>
                {Object.values(CategoryFilter).map((value) => (
                  <button key={value} type="button" className="iv-tab" aria-pressed={category === value} onClick={() => setCategory(value)}>
                    {t('inventory.categories.' + value)} <span className="iv-tab__count">{counts[value] ?? 0}</span>
                  </button>
                ))}
              </div>
              <StockTable
                resources={visible} loading={loading} canManage={isAdmin}
                onRestock={(resourceId) => setDialog({ type: 'in', resourceId })}
                onWithdraw={(resourceId) => setDialog({ type: 'out', resourceId })}
              />
            </section>

            <AlertsPanel
              alerts={alerts} total={alerts.length} resources={resources}
              loading={openAlerts.isLoading} error={openAlerts.error} canManage={isAdmin}
              onRestock={(resourceId) => setDialog({ type: 'in', resourceId })} viewAllTo={routes.inventoryAlerts}
            />
          </div>
        </>
      )}

      {dialog && dialog.type !== 'new' && (
        <StockDialog mode={dialog.type} inventoryId={inventory.id} resources={resources} resourceId={dialog.resourceId} onClose={close} />
      )}
      {dialog?.type === 'new' && <NewResourceDialog inventoryId={inventory.id} onClose={close} />}
    </div>
  );
}
`);


write(RM + 'presentation/pages/inventoryAlertsPage.jsx', String.raw`
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { routes } from '@app/router/routes.js';
import { usePermissions } from '@bc/identityAccess/presentation/hooks/usePermissions.js';
import Breadcrumb from '@shared/presentation/components/breadcrumb.jsx';
import { formatDateTime } from '@shared/utils/formatters.js';
import { sortAlertsByUrgency } from '../../domain/services/stockSummary.js';
import { useInventory } from '../hooks/useInventory.js';
import { useStockAlerts } from '../hooks/useStockAlerts.js';
import StockDialog from '../components/stockDialog.jsx';
import { categoryLabel, elapsed, levelLabel, quantity } from '../utils/stockFormat.js';
import '../styles/inventory.css';

// Pantalla de Alertas de desabastecimiento: cada alerta con sus cantidades, lo que falta y desde cuándo.
export default function InventoryAlertsPage() {
  const { t, i18n } = useTranslation('resourceManagement');
  const lng = i18n.resolvedLanguage;
  const { isAdmin } = usePermissions();
  const inventoryQuery = useInventory();
  const inventory = inventoryQuery.data ?? null;
  const open = useStockAlerts(inventory?.id, 'OPEN');
  const resolved = useStockAlerts(inventory?.id, 'RESOLVED');
  const [status, setStatus] = useState('OPEN');
  const [restockId, setRestockId] = useState(null);

  const resources = useMemo(() => inventory?.resources ?? [], [inventory]);
  const byId = useMemo(() => new Map(resources.map((resource) => [resource.id, resource])), [resources]);
  const openList = useMemo(() => sortAlertsByUrgency(open.data ?? [], resources), [open.data, resources]);
  const resolvedList = resolved.data ?? [];
  const list = status === 'OPEN' ? openList : resolvedList;
  const query = status === 'OPEN' ? open : resolved;
  const criticalCount = openList.filter((alert) => byId.get(alert.resourceId)?.level === 'CRITICAL').length;

  return (
    <div className="iv">
      <Breadcrumb
        label={t('inventory.breadcrumb.label')}
        items={[{ label: t('inventory.title'), to: routes.inventory }, { label: t('inventory.alertsPage.title') }]}
      />
      <header className="iv-head">
        <div>
          <h1>{t('inventory.alertsPage.title')}</h1>
          <p>{t('inventory.alertsPage.subtitle')}</p>
        </div>
      </header>

      <ul className="iv-stats" aria-label={t('inventory.alertsPage.summary')}>
        <li><span>{openList.length}</span><small>{t('inventory.alertsPage.open')}</small></li>
        <li className="is-critical"><span>{criticalCount}</span><small>{t('inventory.alertsPage.critical')}</small></li>
        <li><span>{resolvedList.length}</span><small>{t('inventory.alertsPage.resolved')}</small></li>
      </ul>

      <div className="iv-tabs" role="group" aria-label={t('inventory.alerts.filter')}>
        {['OPEN', 'RESOLVED'].map((value) => (
          <button key={value} type="button" className="iv-tab" aria-pressed={status === value} onClick={() => setStatus(value)}>
            {t('inventory.alerts.status.' + value)} <span className="iv-tab__count">{value === 'OPEN' ? openList.length : resolvedList.length}</span>
          </button>
        ))}
      </div>

      {(inventoryQuery.isLoading || query.isLoading) && <div className="iv-alert-cards"><span className="iv-skel iv-skel--card" /><span className="iv-skel iv-skel--card" /></div>}
      {(inventoryQuery.isError || query.isError) && (
        <p className="iv-alert-banner" role="alert">{(inventoryQuery.error ?? query.error)?.detail ?? t('inventory.alerts.loadError')}</p>
      )}
      {!query.isLoading && !query.isError && list.length === 0 && <p className="iv-empty">{t('inventory.alerts.empty.' + status)}</p>}

      <ul className="iv-alert-cards">
        {list.map((alert) => {
          const resource = byId.get(alert.resourceId);
          const isOpen = alert.isOpen;
          const unit = resource?.unit ?? '';
          // Abierta: se muestran las cantidades de hoy; resuelta: las del momento de la alerta.
          const available = (isOpen ? resource?.available : alert.available) ?? alert.available ?? resource?.available ?? 0;
          const minimum = (isOpen ? resource?.minimumStock : alert.minimumStock) ?? alert.minimumStock ?? resource?.minimumStock ?? 0;
          const missing = Math.max(0, minimum - available);
          const ratio = minimum > 0 ? Math.min(1, Math.max(0, available / minimum)) : 1;
          const level = resource?.level ?? 'LOW';
          return (
            <li key={alert.id} className={'iv-alert-card' + (isOpen ? ' iv-alert-card--' + level.toLowerCase() : ' is-resolved')}>
              <header>
                <div>
                  <h2>{alert.resourceName ?? resource?.name ?? '—'}</h2>
                  <span className="iv-card__cat">{categoryLabel(t, resource?.category)}</span>
                </div>
                {isOpen
                  ? <span className={'iv-chip iv-chip--' + level.toLowerCase()}>{levelLabel(t, level)}</span>
                  : <span className="iv-chip iv-chip--ok">{t('inventory.alerts.status.RESOLVED')}</span>}
              </header>

              <div className="iv-bar" role="img" aria-label={Math.round(ratio * 100) + '%'}><span style={{ width: Math.round(ratio * 100) + '%' }} /></div>
              <dl className="iv-alert-card__facts">
                <div><dt>{t('inventory.table.available')}</dt><dd>{quantity(available, unit, lng)}</dd></div>
                <div><dt>{t('inventory.table.minimum')}</dt><dd>{quantity(minimum, unit, lng)}</dd></div>
                <div><dt>{t(isOpen ? 'inventory.alertsPage.missing' : 'inventory.table.reserved')}</dt><dd>{isOpen ? quantity(missing, unit, lng) : quantity(resource?.reserved ?? 0, unit, lng)}</dd></div>
              </dl>

              <footer>
                <p>
                  {t('inventory.alertsPage.raisedOn', { date: alert.raisedAt ? formatDateTime(alert.raisedAt, lng) : '—' })}
                  {isOpen && alert.raisedAt && <strong> · {elapsed(alert.raisedAt, lng)}</strong>}
                </p>
                {!isOpen && alert.resolvedAt && <p>{t('inventory.alerts.resolved', { date: formatDateTime(alert.resolvedAt, lng) })}</p>}
                {isOpen && isAdmin && resource && (
                  <button type="button" className="iv-btn-lime iv-btn-sm" onClick={() => setRestockId(resource.id)}>{t('inventory.alerts.restock')}</button>
                )}
              </footer>
            </li>
          );
        })}
      </ul>

      {restockId && inventory && <StockDialog mode="in" inventoryId={inventory.id} resources={resources} resourceId={restockId} onClose={() => setRestockId(null)} />}
    </div>
  );
}
`);

write(RM + 'presentation/pages/inventoryResourcesPage.jsx', String.raw`
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { routes } from '@app/router/routes.js';
import Breadcrumb from '@shared/presentation/components/breadcrumb.jsx';
import { CategoryFilter, byUrgency, countByCategory, filterByCategory } from '../../domain/services/stockSummary.js';
import { useInventory } from '../hooks/useInventory.js';
import StockCards from '../components/stockCards.jsx';
import '../styles/inventory.css';

// Todos los recursos del inventario como tarjetas, con búsqueda y filtro por categoría.
export default function InventoryResourcesPage() {
  const { t } = useTranslation('resourceManagement');
  const inventoryQuery = useInventory();
  const [category, setCategory] = useState(CategoryFilter.ALL);
  const [search, setSearch] = useState('');

  const resources = useMemo(() => [...(inventoryQuery.data?.resources ?? [])].sort(byUrgency), [inventoryQuery.data]);
  const counts = useMemo(() => countByCategory(resources), [resources]);
  const visible = useMemo(() => {
    const text = search.trim().toLowerCase();
    return filterByCategory(resources, category).filter((resource) => !text || resource.name.toLowerCase().includes(text));
  }, [resources, category, search]);

  return (
    <div className="iv">
      <Breadcrumb
        label={t('inventory.breadcrumb.label')}
        items={[{ label: t('inventory.title'), to: routes.inventory }, { label: t('inventory.resourcesPage.title') }]}
      />
      <header className="iv-head">
        <div>
          <h1>{t('inventory.resourcesPage.title')}</h1>
          <p>{t('inventory.resourcesPage.subtitle', { count: resources.length })}</p>
        </div>
        <label className="iv-search">
          <span className="iv-sr">{t('inventory.resourcesPage.search')}</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('inventory.resourcesPage.search')} />
        </label>
      </header>

      <div className="iv-tabs" role="group" aria-label={t('inventory.table.filter')}>
        {Object.values(CategoryFilter).map((value) => (
          <button key={value} type="button" className="iv-tab" aria-pressed={category === value} onClick={() => setCategory(value)}>
            {t('inventory.categories.' + value)} <span className="iv-tab__count">{counts[value] ?? 0}</span>
          </button>
        ))}
      </div>

      {inventoryQuery.isError && <p className="iv-alert-banner" role="alert">{inventoryQuery.error?.detail ?? t('inventory.loadError')}</p>}
      <StockCards resources={visible} loading={inventoryQuery.isLoading} />
      {!inventoryQuery.isLoading && !inventoryQuery.isError && visible.length === 0 && <p className="iv-empty">{t('inventory.table.empty')}</p>}
    </div>
  );
}
`);

write(RM + 'presentation/styles/inventory.css', String.raw`
.iv { display: grid; align-content: start; gap: var(--space-3); }
.iv-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.iv-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.iv-head h1 { margin: 0 0 4px; font-size: 1.75rem; font-weight: 700; letter-spacing: -0.02em; }
.iv-head p { margin: 0; color: var(--night-100); }
.iv-head__actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.iv-warehouse { display: inline-flex; align-items: center; min-height: 44px; padding: 0 20px; border-radius: 10px; background: var(--cc-card-inner); color: var(--night-100); }

.iv-btn-lime, .iv-btn-outline { min-height: 44px; padding: 0 20px; border-radius: 10px; font: inherit; font-weight: 700; cursor: pointer; transition: filter 0.2s, background 0.2s, transform 0.2s; }
.iv-btn-lime { border: 0; background: var(--color-lime); color: var(--night-600); }
.iv-btn-lime:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); }
.iv-btn-outline { border: 1.5px solid rgba(255, 255, 255, 0.85); background: transparent; color: #fff; }
.iv-btn-outline:hover:not(:disabled) { background: rgba(255, 255, 255, 0.08); }
.iv-btn-sm { min-height: 36px; padding: 0 14px; font-size: 0.8125rem; }
.iv-btn-lime:disabled, .iv-btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }
.iv-link-btn { padding: 0; border: 0; background: transparent; color: var(--color-sky); font: inherit; font-weight: 600; text-decoration: underline; cursor: pointer; }
.iv button:focus-visible, .iv select:focus-visible, .iv input:focus-visible, .iv-card-panel:focus-visible { outline: 2px solid var(--color-sky); outline-offset: 2px; }

.iv-error { margin: 8px 0 0; color: #ff9b9b; font-size: 0.875rem; }
.iv-note { margin: 0; font-size: 0.8125rem; color: var(--night-100); }
.iv-alert-banner { margin: 0; padding: 12px 16px; border: 1px solid rgba(255, 77, 77, 0.35); border-radius: 12px; background: rgba(255, 77, 77, 0.1); color: #ffb3b3; font-size: 0.875rem; }
.iv-banner { display: flex; align-items: center; gap: 12px; margin: 0; padding: 14px 18px; border: 1px solid rgba(255, 77, 77, 0.55); border-radius: 12px; background: rgba(255, 77, 77, 0.12); font-size: 0.9375rem; }
.iv-banner > span:nth-child(2) { flex: 1; min-width: 0; }
.iv-dot { flex: none; width: 10px; height: 10px; border-radius: 50%; background: var(--color-danger); box-shadow: 0 0 10px var(--color-danger); }

.iv-cards { display: grid; align-content: start; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--space-3); margin: 0; padding: 0; list-style: none; }
.iv-card { display: grid; gap: 10px; min-width: 0; padding: 18px 20px; border: 1px solid var(--cc-line); border-radius: 16px; background: var(--cc-card); }
.iv-card--critical { border-color: rgba(255, 77, 77, 0.75); }
.iv-card--low { border-color: rgba(255, 176, 32, 0.55); }
.iv-card__top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 10px; }
.iv-card__top strong { min-width: 0; overflow-wrap: break-word; }
.iv-card__qty { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; margin: 0; }
.iv-card__qty span { font-size: 2rem; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.iv-card__qty small { color: var(--night-100); font-size: 0.8125rem; }
.iv-card__meta { margin: 0; font-size: 0.75rem; color: var(--night-100); }
.iv-card__cat { font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-sky); }
.iv-bar { height: 6px; border-radius: 999px; background: rgba(255, 255, 255, 0.1); overflow: hidden; }
.iv-bar span { display: block; height: 100%; border-radius: inherit; background: var(--color-emerald); }
.iv-card--critical .iv-bar span { background: var(--color-danger); }
.iv-card--low .iv-bar span { background: #ffb020; }

.iv-chip { display: inline-flex; align-items: center; min-height: 22px; padding: 0 10px; border-radius: 999px; font-size: 0.75rem; font-weight: 700; white-space: nowrap; }
.iv-chip--ok { background: rgba(5, 194, 116, 0.16); color: var(--color-emerald); }
.iv-chip--low { background: rgba(255, 176, 32, 0.16); color: #ffcf70; }
.iv-chip--critical { background: rgba(255, 77, 77, 0.16); color: #ff9b9b; }

.iv-grid { display: grid; grid-template-columns: minmax(0, 2.2fr) minmax(0, 1fr); gap: var(--space-3); align-items: start; }
.iv-card-panel { min-width: 0; display: grid; align-content: start; gap: 14px; padding: 20px; border: 1px solid var(--cc-line); border-radius: 16px; background: var(--cc-card); }
.iv-panel__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.iv-h2 { margin: 0; font-size: 1.0625rem; font-weight: 700; }
.iv-setup { max-width: 640px; }

.iv-tabs { display: flex; flex-wrap: wrap; align-content: flex-start; align-items: center; gap: 8px; }
.iv-tab { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 12px; border: 1px solid var(--cc-line); border-radius: 999px; background: transparent; color: var(--night-100); font: inherit; font-size: 0.8125rem; cursor: pointer; }
.iv-tab[aria-pressed='true'] { border-color: var(--color-lime); color: var(--color-lime); background: rgba(190, 242, 100, 0.08); font-weight: 700; }
.iv-tab__count { opacity: 0.8; font-variant-numeric: tabular-nums; }

.iv-table-wrap { overflow-x: auto; }
.iv-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
.iv-table th, .iv-table td { padding: 12px 8px; text-align: left; border-bottom: 1px solid var(--cc-line); white-space: nowrap; }
.iv-table thead th { font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-sky); background: rgba(0, 0, 0, 0.18); }
.iv-table tbody th { font-weight: 600; white-space: normal; min-width: 120px; }
.iv-table .is-num { text-align: right; font-variant-numeric: tabular-nums; }

.iv-alerts { display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }
.iv-alert { display: grid; gap: 6px; padding: 14px 16px; border-radius: 12px; background: var(--cc-card-inner); }
.iv-alert p { margin: 0; font-size: 0.8125rem; }
.iv-alert__warn { color: #ff9b9b; font-weight: 600; }
.iv-alert small { color: var(--night-100); }
.iv-alert.is-resolved { opacity: 0.75; }
.iv-alert .iv-btn-outline { margin-top: 4px; }
.iv-empty { margin: 0; padding: 24px 8px; text-align: center; color: var(--night-100); }

.iv-skel { display: block; height: 44px; border-radius: 12px; background: linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.1), rgba(255,255,255,0.04)); background-size: 200% 100%; animation: cc-shimmer 1.4s linear infinite; }
.iv-skel--card { height: 150px; border-radius: 16px; }
.iv-skel--tall { height: 140px; }
.iv-rows { display: grid; align-content: start; gap: 10px; }

/* Tarjetas: fila de máximo 5 y, si hay más, una tarjeta corta "Ver todos" */
.iv-cards--row { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.iv-cards--row.iv-cards--more { grid-template-columns: repeat(5, minmax(0, 1fr)) 104px; }
.iv-more a { display: grid; place-content: center; justify-items: center; gap: 6px; height: 100%; min-height: 120px; padding: 12px; border: 1.5px dashed rgba(133, 213, 246, 0.45); border-radius: 16px; color: var(--color-sky); text-decoration: none; text-align: center; transition: background 0.2s, border-color 0.2s; }
.iv-more a:hover { background: rgba(133, 213, 246, 0.08); border-color: var(--color-sky); }
.iv-more span { font-size: 0.8125rem; font-weight: 700; }
.iv-more small { color: var(--night-100); font-size: 0.75rem; }
@media (max-width: 1280px) {
  .iv-cards--row, .iv-cards--row.iv-cards--more { grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
}

/* Tabla: acciones con íconos */
.iv-table .is-actions { width: 1%; text-align: right; }
.iv-actions { display: inline-flex; gap: 8px; vertical-align: middle; }
.iv-icon-btn { display: grid; place-items: center; width: 34px; height: 34px; padding: 0; border: 1px solid var(--cc-line); border-radius: 10px; background: transparent; color: var(--night-100); cursor: pointer; transition: background 0.15s, color 0.15s, border-color 0.15s; }
.iv-icon-btn--in:hover { color: var(--color-lime); border-color: var(--color-lime); background: rgba(190, 242, 100, 0.08); }
.iv-icon-btn--out:hover { color: var(--color-sky); border-color: var(--color-sky); background: rgba(133, 213, 246, 0.08); }
.iv button.iv-icon-btn:focus-visible { outline: 2px solid var(--color-sky); outline-offset: 2px; }

/* Vista previa de alertas */
.iv-count { display: inline-grid; place-items: center; min-width: 26px; height: 26px; padding: 0 8px; border-radius: 999px; background: rgba(255, 77, 77, 0.18); color: #ff9b9b; font-size: 0.8125rem; font-weight: 700; }
.iv-alert__row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.iv-alert__row strong { min-width: 0; overflow-wrap: anywhere; }
.iv-viewall { justify-self: start; color: var(--color-sky); font-weight: 700; text-decoration: none; }
.iv-viewall:hover { text-decoration: underline; }
a.iv-link-btn { text-decoration: underline; }

/* Pantalla de alertas */
.iv-stats { display: grid; align-content: start; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-3); margin: 0; padding: 0; list-style: none; }
.iv-stats li { display: grid; gap: 2px; padding: 16px 20px; border: 1px solid var(--cc-line); border-radius: 16px; background: var(--cc-card); }
.iv-stats span { font-size: 2rem; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.iv-stats small { color: var(--night-100); }
.iv-stats .is-critical span { color: #ff9b9b; }
.iv-alert-cards { display: grid; align-content: start; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--space-3); margin: 0; padding: 0; list-style: none; }
.iv-alert-card { display: grid; align-content: start; gap: 14px; min-width: 0; padding: 20px; border: 1px solid var(--cc-line); border-radius: 16px; background: var(--cc-card); }
.iv-alert-card--critical { border-color: rgba(255, 77, 77, 0.65); }
.iv-alert-card--low { border-color: rgba(255, 176, 32, 0.5); }
.iv-alert-card.is-resolved { opacity: 0.8; }
.iv-alert-card > header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.iv-alert-card h2 { margin: 0 0 4px; font-size: 1.0625rem; overflow-wrap: anywhere; }
.iv-alert-card--critical .iv-bar span { background: var(--color-danger); }
.iv-alert-card--low .iv-bar span { background: #ffb020; }
.iv-alert-card__facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 0; }
.iv-alert-card__facts dt { font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-sky); }
.iv-alert-card__facts dd { margin: 4px 0 0; font-size: 1.0625rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.iv-alert-card > footer { display: grid; gap: 8px; padding-top: 12px; border-top: 1px solid var(--cc-line); font-size: 0.8125rem; color: var(--night-100); }
.iv-alert-card > footer p { margin: 0; }
.iv-alert-card > footer strong { color: #fff; }
.iv-search input { width: min(280px, 100%); height: 44px; padding: 0 14px; border: 0; border-radius: 10px; background: var(--cc-card-inner); color: #fff; font: inherit; }
@media (max-width: 560px) { .iv-stats { grid-template-columns: 1fr; } .iv-alert-card__facts { grid-template-columns: 1fr 1fr; } }

.iv-backdrop { position: fixed; inset: 0; z-index: 40; background: rgba(5, 5, 30, 0.6); }
.iv-dialog { position: fixed; z-index: 41; top: 50%; left: 50%; display: grid; gap: 12px; width: min(440px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow-y: auto; padding: 24px; border: 1px solid var(--cc-line); border-radius: 16px; background: var(--cc-card); transform: translate(-50%, -50%); }
.iv-field { display: grid; gap: 6px; font-size: 0.8125rem; font-weight: 500; }
.iv-field input, .iv-field select { height: 40px; padding: 0 12px; border: 1px solid var(--cc-line); border-radius: 10px; background: var(--cc-card-inner); color: #fff; font: inherit; color-scheme: dark; }
.iv-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.iv-dialog__actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 4px; }

@media (max-width: 1280px) { .iv-grid { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 560px) { .iv-field-row, .iv-dialog__actions { grid-template-columns: 1fr; } .iv-banner { flex-wrap: wrap; } }
`);

/* ════════════════════════ I18N ════════════════════════ */
mergeJson(RM + 'presentation/i18n/es.json', { inventory: {
  title: 'Inventario y Almacenes',
  subtitle: 'Disponibilidad de suministros por centro de acopio',
  warehouse: 'Almacén',
  loadError: 'No se pudo cargar el inventario.',
  retry: 'Reintentar',
  banner: 'Desabastecimiento próximo: {{name}} bajo el mínimo (disponible {{available}}, mínimo {{minimum}})',
  viewAlerts: 'Ver alertas',
  actions: { in: 'Registrar entrada', out: 'Registrar salida', newResource: 'Nuevo recurso' },
  levels: { OK: 'OK', LOW: 'Bajo', CRITICAL: 'Crítico' },
  categories: { ALL: 'Todos', WATER: 'Agua', FOOD: 'Alimentos', SHELTER: 'Refugio', HYGIENE: 'Higiene', MEDICINE: 'Medicinas', OTHER: 'Otros' },
  units: { UNIT: 'Unidades', KG: 'Kilogramos (kg)', LITER: 'Litros (L)', KIT: 'Kits' },
  tabs: { ALL: 'Todos' },
  cards: { label: 'Recursos', of: 'de {{total}} en almacén', available: 'Disponible', minimum: 'mínimo {{value}}', reserved: '{{value}} reservado' },
  table: {
    title: 'Existencias', filter: 'Filtrar por categoría', empty: 'No hay recursos en esta categoría.',
    resource: 'Recurso', category: 'Categoría', onHand: 'En almacén', reserved: 'Reservado', available: 'Disponible',
    minimum: 'Mínimo', status: 'Estado', actions: 'Acciones', in: 'Entrada', out: 'Salida',
  },
  alerts: {
    title: 'Alertas de desabastecimiento', filter: 'Filtrar alertas', loadError: 'No se pudieron cargar las alertas.',
    status: { OPEN: 'Abiertas', RESOLVED: 'Resueltas' },
    empty: { OPEN: 'No hay alertas abiertas. Todo el stock está sobre su mínimo.', RESOLVED: 'Todavía no hay alertas resueltas.' },
    detail: 'Disponible {{available}} · mínimo {{minimum}}',
    raised: 'Alerta desde {{date}}', resolved: 'Resuelta el {{date}}', restock: 'Reabastecer',
  },
  in: { title: 'Registrar entrada', hint: 'Suma lo recibido al stock en almacén.', submit: 'Registrar entrada' },
  out: { title: 'Registrar salida', hint: 'Resta del stock disponible. Queda registrada como ajuste con su motivo.', submit: 'Registrar salida' },
  new: {
    title: 'Nuevo recurso', hint: 'Se registra sin stock; después registra su primera entrada.', name: 'Nombre', category: 'Categoría',
    categoryPlaceholder: 'Elige una categoría', unit: 'Unidad', unitPlaceholder: 'Elige una unidad', minimum: 'Stock mínimo', submit: 'Registrar recurso',
  },
  form: {
    resource: 'Recurso', quantity: 'Cantidad', reason: 'Motivo', reasonPlaceholder: 'Ej.: entrega a albergue, merma',
    current: 'En almacén: {{onHand}} · disponible: {{available}}', saving: 'Guardando...', cancel: 'Cancelar',
  },
  setup: {
    title: 'Todavía no hay inventario', create: 'Crear inventario',
    admin: 'Crea el inventario de tu organización para empezar a registrar recursos.',
    other: 'El administrador de la organización aún no creó el inventario.',
  },
  noResources: {
    title: 'Aún no hay recursos', admin: 'Registra el primero con "Nuevo recurso" y luego su primera entrada.',
    other: 'El administrador todavía no registró recursos.',
  },
  errors: {
    nameRequired: 'Escribe el nombre del recurso.', nameTooLong: 'El nombre puede tener hasta 150 caracteres.', categoryRequired: 'Elige una categoría.', unitRequired: 'Elige la unidad.',
    minimumInvalid: 'El stock mínimo debe ser un número entero igual o mayor que 0.', resourceRequired: 'Elige un recurso.',
    quantityInvalid: 'La cantidad debe ser un número entero mayor que 0.', reasonRequired: 'Escribe el motivo de la salida.', reasonTooLong: 'El motivo puede tener hasta 300 caracteres.',
    exceedsAvailable: 'No hay tanto stock disponible: lo reservado para planes no se puede sacar.',
    forbidden: 'Solo el administrador de la organización puede modificar el inventario.', generic: 'No se pudo completar la operación.',
  },
} });
mergeJson(RM + 'presentation/i18n/en.json', { inventory: {
  title: 'Inventory and Warehouses',
  subtitle: 'Supply availability by relief center',
  warehouse: 'Warehouse',
  loadError: 'Could not load the inventory.',
  retry: 'Retry',
  banner: 'Stock-out ahead: {{name}} is below its minimum (available {{available}}, minimum {{minimum}})',
  viewAlerts: 'View alerts',
  actions: { in: 'Register entry', out: 'Register exit', newResource: 'New resource' },
  levels: { OK: 'OK', LOW: 'Low', CRITICAL: 'Critical' },
  categories: { ALL: 'All', WATER: 'Water', FOOD: 'Food', SHELTER: 'Shelter', HYGIENE: 'Hygiene', MEDICINE: 'Medicine', OTHER: 'Other' },
  units: { UNIT: 'Units', KG: 'Kilograms (kg)', LITER: 'Liters (L)', KIT: 'Kits' },
  tabs: { ALL: 'All' },
  cards: { label: 'Resources', of: 'of {{total}} in the warehouse', available: 'Available', minimum: 'minimum {{value}}', reserved: '{{value}} reserved' },
  table: {
    title: 'Stock', filter: 'Filter by category', empty: 'There are no resources in this category.',
    resource: 'Resource', category: 'Category', onHand: 'On hand', reserved: 'Reserved', available: 'Available',
    minimum: 'Minimum', status: 'Status', actions: 'Actions', in: 'Entry', out: 'Exit',
  },
  alerts: {
    title: 'Stock-out alerts', filter: 'Filter alerts', loadError: 'Could not load the alerts.',
    status: { OPEN: 'Open', RESOLVED: 'Resolved' },
    empty: { OPEN: 'There are no open alerts. All stock is above its minimum.', RESOLVED: 'There are no resolved alerts yet.' },
    detail: 'Available {{available}} · minimum {{minimum}}',
    raised: 'Alert since {{date}}', resolved: 'Resolved on {{date}}', restock: 'Restock',
  },
  in: { title: 'Register entry', hint: 'Adds what was received to the warehouse stock.', submit: 'Register entry' },
  out: { title: 'Register exit', hint: 'Subtracts from the available stock. It is recorded as an adjustment with its reason.', submit: 'Register exit' },
  new: {
    title: 'New resource', hint: 'It is registered without stock; then register its first entry.', name: 'Name', category: 'Category',
    categoryPlaceholder: 'Choose a category', unit: 'Unit', unitPlaceholder: 'Choose a unit', minimum: 'Minimum stock', submit: 'Register resource',
  },
  form: {
    resource: 'Resource', quantity: 'Quantity', reason: 'Reason', reasonPlaceholder: 'E.g.: delivered to shelter, loss',
    current: 'On hand: {{onHand}} · available: {{available}}', saving: 'Saving...', cancel: 'Cancel',
  },
  setup: {
    title: 'There is no inventory yet', create: 'Create inventory',
    admin: "Create your organization's inventory to start registering resources.",
    other: "The organization's administrator has not created the inventory yet.",
  },
  noResources: {
    title: 'No resources yet', admin: 'Register the first one with "New resource" and then its first entry.',
    other: 'The administrator has not registered resources yet.',
  },
  errors: {
    nameRequired: 'Enter the resource name.', nameTooLong: 'The name can have up to 150 characters.', categoryRequired: 'Choose a category.', unitRequired: 'Choose the unit.',
    minimumInvalid: 'The minimum stock must be a whole number equal to or greater than 0.', resourceRequired: 'Choose a resource.',
    quantityInvalid: 'The quantity must be a whole number greater than 0.', reasonRequired: 'Enter the reason for the exit.', reasonTooLong: 'The reason can have up to 300 characters.',
    exceedsAvailable: 'There is not that much available stock: what is reserved for plans cannot be taken out.',
    forbidden: "Only the organization's administrator can change the inventory.", generic: 'The operation could not be completed.',
  },
} });


mergeJson(RM + 'presentation/i18n/es.json', { inventory: {
  viewAlerts: 'Ver alertas',
  breadcrumb: { label: 'Ruta de navegación' },
  cards: { more: 'Ver todos', moreLabel: 'Ver los {{count}} recursos restantes' },
  table: { inFor: 'Registrar entrada de {{name}}', outFor: 'Registrar salida de {{name}}' },
  alerts: { viewAll: 'Ver las {{count}} alertas', viewDetail: 'Ver detalle de alertas' },
  alertsPage: {
    title: 'Alertas de desabastecimiento', subtitle: 'Recursos que bajaron de su stock mínimo, de lo más urgente a lo menos urgente.',
    summary: 'Resumen de alertas', open: 'Abiertas', critical: 'Críticas', resolved: 'Resueltas',
    missing: 'Faltan', raisedOn: 'Alerta desde {{date}}',
  },
  resourcesPage: { title: 'Recursos del inventario', subtitle: '{{count}} recursos registrados, los más urgentes primero', search: 'Buscar recurso' },
} });
mergeJson(RM + 'presentation/i18n/en.json', { inventory: {
  viewAlerts: 'View alerts',
  breadcrumb: { label: 'Breadcrumb' },
  cards: { more: 'See all', moreLabel: 'See the other {{count}} resources' },
  table: { inFor: 'Register entry for {{name}}', outFor: 'Register exit for {{name}}' },
  alerts: { viewAll: 'View all {{count}} alerts', viewDetail: 'View alert details' },
  alertsPage: {
    title: 'Stock-out alerts', subtitle: 'Resources that fell below their minimum stock, most urgent first.',
    summary: 'Alert summary', open: 'Open', critical: 'Critical', resolved: 'Resolved',
    missing: 'Missing', raisedOn: 'Alert since {{date}}',
  },
  resourcesPage: { title: 'Inventory resources', subtitle: '{{count}} registered resources, most urgent first', search: 'Search resource' },
} });

console.log('\nListo. Reinicia "npm run dev" e ingresa a Inventario (el administrador ve las acciones; la autoridad solo consulta).');
