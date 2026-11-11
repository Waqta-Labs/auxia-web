import { DistributionPlan } from '../../domain/entities/DistributionPlan.js';
import { humanize, parseUtc } from '@shared/utils/formatters.js';

// El contrato exacto de este recurso se tomó de la descripción del README; se leen los nombres
// más probables de cada campo. Si el backend usa otro, solo hay que ajustar este archivo.
const toItem = (dto) => ({
  resourceId: dto.resourceId ?? dto.resource?.id ?? null,
  name: dto.resourceName ?? dto.name ?? dto.resource?.name ?? humanize(dto.category ?? dto.resource?.category ?? 'resource'),
  unit: dto.unit ?? dto.resource?.unit ?? null,
  recommended: dto.recommendedQuantity ?? null,
  quantity: dto.quantity ?? dto.currentQuantity ?? dto.recommendedQuantity ?? null,
});

const toBrigadeRef = (dto) => {
  const brigade = dto.brigade ?? dto.assignedBrigade ?? null;
  const id = brigade?.id ?? dto.brigadeId ?? null;
  if (!brigade && !id) return null;
  return { id, name: brigade?.name ?? dto.brigadeName ?? null };
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
