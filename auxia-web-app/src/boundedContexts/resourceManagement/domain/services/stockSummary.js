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

