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

// La asignación en curso no está documentada en detalle: se busca el objeto en assignment / currentAssignment / activeAssignment
// o en cualquier campo que se llame *assign*, *mission* o *delivery*, y sus campos por patrón de nombre.
const scalar = (object, ...patterns) => {
  if (!object || typeof object !== 'object') return undefined;
  for (const pattern of patterns) {
    const key = Object.keys(object).find((name) => pattern.test(name) && object[name] !== null && typeof object[name] !== 'object');
    if (key) return object[key];
  }
  return undefined;
};
const findAssignment = (dto) => {
  const known = dto.assignment ?? dto.currentAssignment ?? dto.activeAssignment ?? null;
  if (known && typeof known === 'object') return known;
  const key = Object.keys(dto).find((name) => /assign|mission|delivery/i.test(name) && dto[name] && typeof dto[name] === 'object' && !Array.isArray(dto[name]));
  return key ? dto[key] : null;
};
const numberOrNull = (value) => (value === undefined || value === null || value === '' ? null : Number(value));

const toAssignment = (dto) => {
  const a = findAssignment(dto);
  if (!a) return null;
  const list = Array.isArray(a.items) ? a.items : Array.isArray(a.resources) ? a.resources : a.plan?.items ?? Object.values(a).find((value) => Array.isArray(value)) ?? [];
  return {
    planId: a.planId ?? a.distributionPlanId ?? a.plan?.id ?? scalar(a, /^plan.*id$/i) ?? null,
    zoneId: a.zoneId ?? a.zone?.id ?? scalar(a, /^zone.*id$/i) ?? a.plan?.zoneId ?? null,
    zoneName: a.zoneName ?? a.zone?.name ?? scalar(a, /^zone.*name$/i) ?? a.plan?.zoneName ?? null,
    score: numberOrNull(a.score ?? a.urgencyScore ?? a.zone?.score ?? a.zone?.urgencyScore ?? scalar(a, /score/i)),
    etaMinutes: numberOrNull(a.etaMinutes ?? scalar(a, /^eta/i)),
    distanceKm: numberOrNull(a.distanceKm ?? scalar(a, /^distance/i)),
    resources: list.map((item) => ({
      name: item.resourceName ?? item.name ?? item.resource?.name ?? null,
      quantity: item.quantity ?? item.currentQuantity ?? item.recommendedQuantity ?? null,
      unit: item.unit ?? item.resource?.unit ?? null,
    })).filter((item) => item.name),
    startedAt: parseUtc(a.assignedAt ?? a.startedAt ?? scalar(a, /assignedat|startedat|createdat/i) ?? null),
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
