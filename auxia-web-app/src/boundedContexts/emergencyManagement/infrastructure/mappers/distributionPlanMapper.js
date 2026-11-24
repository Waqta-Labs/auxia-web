import { DistributionPlan } from '../../domain/entities/DistributionPlan.js';
import { humanize, parseUtc } from '@shared/utils/formatters.js';

// El contrato exacto de este recurso se tomó de la descripción del README; se leen los nombres
// más probables de cada campo. Si el backend usa otro, solo hay que ajustar este archivo.
const toItem = (dto) => ({
  resourceId: dto.resourceId ?? dto.resource?.id ?? null,
  name: dto.resourceName ?? dto.name ?? dto.resource?.name ?? (dto.category ?? dto.resource?.category ? humanize(dto.category ?? dto.resource?.category) : null),
  unit: dto.unit ?? dto.resource?.unit ?? null,
  recommended: dto.recommendedQuantity ?? null,
  quantity: dto.quantity ?? dto.currentQuantity ?? dto.recommendedQuantity ?? null,
});

// El backend no documenta dónde devuelve la brigada del plan: se busca en el plan y en sus objetos anidados
// (brigade, assignedBrigade, assignment, delivery…) cualquier campo que se llame *brigade*.
const isId = (value) => typeof value === 'string' && value.length > 0;
const findBrigade = (dto, depth = 0) => {
  if (!dto || typeof dto !== 'object' || depth > 2) return null;
  for (const [key, value] of Object.entries(dto)) {
    if (!/brigade/i.test(key)) continue;
    if (isId(value)) { if (/name/i.test(key)) continue; return { id: value, name: null }; }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const id = value.id ?? value.brigadeId ?? null;
      if (isId(id)) return { id, name: value.name ?? value.brigadeName ?? null };
    }
  }
  for (const value of Object.values(dto)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = findBrigade(value, depth + 1);
      if (nested) return nested;
    }
  }
  return null;
};
const toBrigadeRef = (dto) => {
  const found = findBrigade(dto);
  if (!found) return null;
  return { id: found.id, name: found.name ?? dto.brigadeName ?? null };
};

export function toDistributionPlan(dto) {
  return new DistributionPlan({
    id: dto.id,
    zoneId: dto.zoneId ?? dto.zone?.id ?? null,
    status: String(dto.status ?? '').toUpperCase(),
    coverage: dto.coverage ?? null,
    justification: dto.justification ?? dto.reason ?? null,
    items: (dto.items ?? []).map(toItem),
    brigade: toBrigadeRef(dto),
    createdAt: parseUtc(dto.createdAt ?? dto.proposedAt ?? null),
  });
}
