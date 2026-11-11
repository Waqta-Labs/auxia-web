import { Brigade } from '../../domain/entities/Brigade.js';
import { BrigadeDetail } from '../../domain/entities/BrigadeDetail.js';
import { BrigadeMember } from '../../domain/entities/BrigadeMember.js';
import { parseUtc } from '@shared/utils/formatters.js';

export function toBrigade(dto) {
  return new Brigade({
    id: dto.id,
    name: dto.name,
    code: dto.code ?? null,
    status: dto.status,
    latitude: dto.baseLocation?.latitude ?? null,
    longitude: dto.baseLocation?.longitude ?? null,
    memberCount: Array.isArray(dto.members) ? dto.members.length : dto.memberCount ?? null,
  });
}

// Los miembros usan fullName/role/phone/userId (Swagger). La asignación en curso (currentAssignment)
// aún no se vio con datos reales: se leen los nombres más probables; ajustar toAssignment si hace falta.
const toMember = (dto) =>
  new BrigadeMember({
    id: dto.id,
    name: dto.fullName ?? dto.name ?? '—',
    role: String(dto.role ?? '').toUpperCase(),
    phone: dto.phone ?? null,
    userId: dto.userId ?? null,
  });

const toAssignment = (dto) => {
  const a = dto.assignment ?? dto.currentAssignment ?? dto.activeAssignment ?? null;
  if (!a) return null;
  return {
    planId: a.planId ?? a.distributionPlanId ?? a.plan?.id ?? null,
    zoneId: a.zoneId ?? a.zone?.id ?? null,
    zoneName: a.zoneName ?? a.zone?.name ?? null,
    score: a.score ?? a.zone?.score ?? null,
    etaMinutes: a.etaMinutes ?? null,
    distanceKm: a.distanceKm ?? null,
    resources: (a.items ?? a.resources ?? a.plan?.items ?? []).map((item) => ({
      name: item.resourceName ?? item.name ?? '—',
      quantity: item.quantity ?? null,
      unit: item.unit ?? null,
    })),
    startedAt: parseUtc(a.assignedAt ?? a.startedAt ?? null),
  };
};

export function toBrigadeDetail(dto) {
  return new BrigadeDetail({
    id: dto.id,
    name: dto.name,
    code: dto.code ?? null,
    status: dto.status,
    latitude: dto.baseLocation?.latitude ?? null,
    longitude: dto.baseLocation?.longitude ?? null,
    members: (dto.members ?? []).map(toMember),
    assignment: toAssignment(dto),
  });
}
