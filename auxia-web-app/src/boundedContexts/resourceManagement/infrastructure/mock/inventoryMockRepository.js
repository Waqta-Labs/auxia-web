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
