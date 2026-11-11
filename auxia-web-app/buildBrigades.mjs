// Brigadas / Logística de campo (W_05): lista de brigadas, misión en curso, miembros y disponibilidad.
// Uso (en la raíz del proyecto): node buildBrigades.mjs
// Reescribe en resourceManagement: Brigade, brigadeRepository, brigadeMapper, brigadeHttpRepository,
// brigadeMockRepository, container y fieldLogisticsPage; en identityAccess: usePermissions (agrega isAdmin).
// Agrega estilos propios (fieldLogistics.css) e i18n es/en (mezcla).
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const write = (path, content) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content.replace(/^\n/, ''));
  console.log('+ ' + path);
};
const deepMerge = (a, b) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? deepMerge(a?.[k] ?? {}, v) : v;
  }
  return out;
};
const mergeJson = (path, patch) => {
  const current = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(deepMerge(current, patch), null, 2) + '\n');
  console.log('~ ' + path);
};

const RM = 'src/boundedContexts/resourceManagement/';
const IA = 'src/boundedContexts/identityAccess/';

if (!existsSync(RM + 'domain/entities/Brigade.js')) {
  throw new Error('No encontré ' + RM + 'domain/entities/Brigade.js. Corre este script en la raíz del proyecto.');
}

/* ════════════════════════ IDENTITY ACCESS ════════════════════════ */
write(IA + 'presentation/hooks/usePermissions.js', String.raw`
import { useAuth } from './useAuth.js';
import { Role } from '../../domain/enums/role.js';

// Qué puede hacer el usuario según su rol. AUDITOR solo consulta.
export function usePermissions() {
  const { session } = useAuth();
  const role = session?.role ?? null;
  return {
    role,
    isAuthority: role === Role.AUTHORITY,
    isAdmin: role === Role.ORGANIZATION_ADMIN,
  };
}
`);

/* ════════════════════════ DOMAIN ════════════════════════ */
write(RM + 'domain/enums/memberRole.js', String.raw`
export const MemberRole = Object.freeze({
  LEADER: 'LEADER',
  DRIVER: 'DRIVER',
  MEDIC: 'MEDIC',
  VOLUNTEER: 'VOLUNTEER',
});
`);

write(RM + 'domain/entities/Brigade.js', String.raw`
import { BrigadeStatus } from '../enums/brigadeStatus.js';

export class Brigade {
  constructor({ id, name, code = null, status, latitude = null, longitude = null, memberCount = null }) {
    this.id = id;
    this.name = name;
    this.code = code;
    this.status = status;
    this.latitude = latitude; // base / última posición GPS
    this.longitude = longitude;
    this.memberCount = memberCount; // null si el listado no lo trae
    Object.freeze(this);
  }

  get isDeployed() { return this.status === BrigadeStatus.ASSIGNED; }
  get isAvailable() { return this.status === BrigadeStatus.AVAILABLE; }
  get isOffDuty() { return this.status === BrigadeStatus.OFF_DUTY; }
  get hasPosition() { return this.latitude !== null && this.longitude !== null; }
}
`);

write(RM + 'domain/entities/BrigadeMember.js', String.raw`
export class BrigadeMember {
  constructor({ id, name, role, userId = null }) {
    this.id = id;
    this.name = name;
    this.role = role;     // LEADER | DRIVER | MEDIC | VOLUNTEER
    this.userId = userId; // cuenta FIELD_BRIGADE con la que entra a la App de Campo, si tiene
    Object.freeze(this);
  }

  get isLeader() { return this.role === 'LEADER'; }
}
`);

write(RM + 'domain/entities/BrigadeDetail.js', String.raw`
import { BrigadeStatus } from '../enums/brigadeStatus.js';

// Una brigada con sus miembros y la misión (asignación) en curso:
// assignment = { planId, zoneId, zoneName, score, etaMinutes, distanceKm, resources: [{ name, quantity, unit }], startedAt } | null
export class BrigadeDetail {
  constructor({ id, name, code = null, status, latitude = null, longitude = null, members = [], assignment = null }) {
    this.id = id;
    this.name = name;
    this.code = code;
    this.status = status;
    this.latitude = latitude;
    this.longitude = longitude;
    this.members = members;
    this.assignment = assignment;
    Object.freeze(this);
  }

  get isDeployed() { return this.status === BrigadeStatus.ASSIGNED; }
  get isOffDuty() { return this.status === BrigadeStatus.OFF_DUTY; }
  get hasPosition() { return this.latitude !== null && this.longitude !== null; }
  // Sin líder no recibe misiones (el backend solo asigna brigadas disponibles con un líder).
  get hasLeader() { return this.members.some((member) => member.isLeader); }
}
`);

write(RM + 'domain/services/filterBrigades.js', String.raw`
import { BrigadeStatus } from '../enums/brigadeStatus.js';

export const BrigadeTab = Object.freeze({ ALL: 'all', ASSIGNED: 'assigned', AVAILABLE: 'available', OFF_DUTY: 'offDuty' });

const STATUS_OF_TAB = {
  [BrigadeTab.ASSIGNED]: BrigadeStatus.ASSIGNED,
  [BrigadeTab.AVAILABLE]: BrigadeStatus.AVAILABLE,
  [BrigadeTab.OFF_DUTY]: BrigadeStatus.OFF_DUTY,
};

const normalize = (value) =>
  String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function countByTab(brigades) {
  const count = (tab) => brigades.filter((brigade) => brigade.status === STATUS_OF_TAB[tab]).length;
  return {
    [BrigadeTab.ALL]: brigades.length,
    [BrigadeTab.ASSIGNED]: count(BrigadeTab.ASSIGNED),
    [BrigadeTab.AVAILABLE]: count(BrigadeTab.AVAILABLE),
    [BrigadeTab.OFF_DUTY]: count(BrigadeTab.OFF_DUTY),
  };
}

// Pestaña de estado + búsqueda por nombre o código (sin distinguir tildes ni mayúsculas).
export function filterBrigades(brigades, { tab = BrigadeTab.ALL, search = '' } = {}) {
  const query = normalize(search.trim());
  return brigades.filter((brigade) => {
    if (tab !== BrigadeTab.ALL && brigade.status !== STATUS_OF_TAB[tab]) return false;
    if (!query) return true;
    return normalize(brigade.name).includes(query) || normalize(brigade.code).includes(query);
  });
}
`);

write(RM + 'domain/repositories/brigadeRepository.js', String.raw`
// Contrato. Backend (Resource Management), brigadas de la organización del usuario:
//   GET    /brigades?status=                         por nombre; AVAILABLE | ASSIGNED | OFF_DUTY
//   GET    /brigades/{id}                            con miembros y asignación en curso
//   POST   /brigades                                 crea (ORGANIZATION_ADMIN); nace AVAILABLE
//   POST   /brigades/{id}/members                    agrega un miembro (LEADER, DRIVER, MEDIC, VOLUNTEER)
//   DELETE /brigades/{id}/members/{memberId}         quita un miembro
//   PATCH  /brigades/{id}/availability               AVAILABLE u OFF_DUTY (ASSIGNED nunca se pone a mano)
export class BrigadeRepository {
  async findAll() { throw new Error('BrigadeRepository.findAll no implementado'); }
  async findById() { throw new Error('BrigadeRepository.findById no implementado'); }
  async create() { throw new Error('BrigadeRepository.create no implementado'); }
  async addMember() { throw new Error('BrigadeRepository.addMember no implementado'); }
  async removeMember() { throw new Error('BrigadeRepository.removeMember no implementado'); }
  async setAvailability() { throw new Error('BrigadeRepository.setAvailability no implementado'); }
}
`);

/* ════════════════════════ APPLICATION ════════════════════════ */
write(RM + 'application/useCases/getBrigadeList.js', String.raw`
export class GetBrigadeList {
  constructor(brigadeRepository) {
    this.brigadeRepository = brigadeRepository;
  }

  async execute() {
    const brigades = await this.brigadeRepository.findAll();
    return [...brigades].sort((a, b) => a.name.localeCompare(b.name));
  }
}
`);

write(RM + 'application/useCases/getBrigadeDetail.js', String.raw`
export class GetBrigadeDetail {
  constructor(brigadeRepository) {
    this.brigadeRepository = brigadeRepository;
  }

  execute(brigadeId) {
    return this.brigadeRepository.findById(brigadeId);
  }
}
`);

write(RM + 'application/useCases/createBrigade.js', String.raw`
export class CreateBrigade {
  constructor(brigadeRepository) {
    this.brigadeRepository = brigadeRepository;
  }

  // Errores de validación: nameRequired, locationInvalid.
  async execute({ name, code, latitude, longitude }) {
    const cleanName = (name ?? '').trim();
    if (!cleanName) throw new Error('nameRequired');
    const lat = Number(latitude);
    const lng = Number(longitude);
    const valid = String(latitude ?? '').trim() !== '' && String(longitude ?? '').trim() !== '' &&
      Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    if (!valid) throw new Error('locationInvalid');
    return this.brigadeRepository.create({
      name: cleanName,
      code: (code ?? '').trim() || null,
      latitude: lat,
      longitude: lng,
    });
  }
}
`);

write(RM + 'application/useCases/addBrigadeMember.js', String.raw`
import { MemberRole } from '../../domain/enums/memberRole.js';

export class AddBrigadeMember {
  constructor(brigadeRepository) {
    this.brigadeRepository = brigadeRepository;
  }

  // Errores de validación: memberNameRequired, roleInvalid.
  async execute({ brigadeId, name, role }) {
    const cleanName = (name ?? '').trim();
    if (!cleanName) throw new Error('memberNameRequired');
    if (!Object.values(MemberRole).includes(role)) throw new Error('roleInvalid');
    return this.brigadeRepository.addMember(brigadeId, { name: cleanName, role });
  }
}
`);

write(RM + 'application/useCases/removeBrigadeMember.js', String.raw`
export class RemoveBrigadeMember {
  constructor(brigadeRepository) {
    this.brigadeRepository = brigadeRepository;
  }

  execute({ brigadeId, memberId }) {
    return this.brigadeRepository.removeMember(brigadeId, memberId);
  }
}
`);

write(RM + 'application/useCases/setBrigadeAvailability.js', String.raw`
import { BrigadeStatus } from '../../domain/enums/brigadeStatus.js';

export class SetBrigadeAvailability {
  constructor(brigadeRepository) {
    this.brigadeRepository = brigadeRepository;
  }

  // Solo AVAILABLE u OFF_DUTY: ASSIGNED lo pone el sistema al aprobar un plan.
  async execute({ brigadeId, status }) {
    if (status !== BrigadeStatus.AVAILABLE && status !== BrigadeStatus.OFF_DUTY) throw new Error('statusInvalid');
    return this.brigadeRepository.setAvailability(brigadeId, status);
  }
}
`);

/* ════════════════════════ INFRASTRUCTURE ════════════════════════ */
write(RM + 'infrastructure/mappers/brigadeMapper.js', String.raw`
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

// El README describe estos recursos en prosa; se leen los nombres más probables de cada campo.
// Si el backend usa otros, solo hay que ajustar las dos funciones siguientes.
const toMember = (dto) =>
  new BrigadeMember({
    id: dto.id,
    name: dto.name ?? dto.fullName ?? dto.displayName ?? '—',
    role: String(dto.role ?? '').toUpperCase(),
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
`);

write(RM + 'infrastructure/http/brigadeHttpRepository.js', String.raw`
import { BrigadeRepository } from '../../domain/repositories/brigadeRepository.js';
import { toBrigade, toBrigadeDetail } from '../mappers/brigadeMapper.js';
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

export class BrigadeHttpRepository extends BrigadeRepository {
  async findAll() {
    const { data } = await call(() => httpClient.get('/brigades'));
    return asList(data).map(toBrigade);
  }

  async findById(brigadeId) {
    const { data } = await call(() => httpClient.get('/brigades/' + brigadeId));
    return toBrigadeDetail(data);
  }

  async create({ name, code, latitude, longitude }) {
    const body = { name, baseLocation: { latitude, longitude } };
    if (code) body.code = code;
    const { data } = await call(() => httpClient.post('/brigades', body));
    return data?.id ?? null;
  }

  async addMember(brigadeId, { name, role }) {
    await call(() => httpClient.post('/brigades/' + brigadeId + '/members', { name, role }));
  }

  async removeMember(brigadeId, memberId) {
    await call(() => httpClient.delete('/brigades/' + brigadeId + '/members/' + memberId));
  }

  async setAvailability(brigadeId, status) {
    await call(() => httpClient.patch('/brigades/' + brigadeId + '/availability', { status }));
  }
}
`);

write(RM + 'infrastructure/mock/brigadeMockRepository.js', String.raw`
import { BrigadeRepository } from '../../domain/repositories/brigadeRepository.js';
import { toBrigade, toBrigadeDetail } from '../mappers/brigadeMapper.js';
import { delay } from '@shared/infrastructure/mock/delay.js';

const NAMES = [
  'Alfa', 'Bravo', 'Charlie', 'Delta', 'Eco', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliett', 'Kilo', 'Lima',
  'Mike', 'November', 'Oscar', 'Papa', 'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'Xray',
];
const PEOPLE = ['M. Quispe', 'R. Torres', 'L. Vargas', 'J. Rojas', 'A. Salas', 'C. Huamán', 'P. Ccori', 'D. Mendoza'];
const ROLES = ['LEADER', 'MEDIC', 'VOLUNTEER', 'DRIVER', 'VOLUNTEER'];
const ZONES = [
  ['zn-01', 'Sector Santa Rosa', 94], ['zn-02', 'Villa Esperanza', 91], ['zn-03', 'Quebrada Carossio', 88],
  ['zn-04', 'Las Terrazas', 72], ['zn-05', 'Huaycán Bajo', 67], ['zn-06', 'Cerro Candela', 54],
];

const problem = (status, detail) => Object.assign(new Error(detail), { status, detail });

// 24 brigadas: 17 en misión, 5 disponibles y 2 fuera de servicio, repartidas alrededor de Chosica.
const buildDtos = () =>
  NAMES.map((name, i) => {
    const status = i < 17 ? 'ASSIGNED' : i < 22 ? 'AVAILABLE' : 'OFF_DUTY';
    const size = 3 + (i % 3);
    const members = Array.from({ length: size }, (_, k) => ({
      id: 'mb-' + i + '-' + k,
      name: PEOPLE[(i + k) % PEOPLE.length],
      role: i === 19 && k === 0 ? 'VOLUNTEER' : ROLES[k % ROLES.length], // br-20 sin líder
    }));
    const [zoneId, zoneName, score] = ZONES[i % ZONES.length];
    return {
      id: 'br-' + String(i + 1).padStart(2, '0'),
      name: 'Brigada ' + name,
      code: 'BRG-' + name.slice(0, 4).toUpperCase() + '-' + String(i + 1).padStart(2, '0'),
      status,
      baseLocation: { latitude: -11.94 + Math.sin(i * 2.4) * 0.024, longitude: -76.69 + Math.cos(i * 1.7) * 0.026 },
      members,
      assignment: status !== 'ASSIGNED' ? null : {
        planId: 'pl-' + String(i + 1).padStart(4, '0'), zoneId, zoneName, score,
        etaMinutes: 12 + ((i * 7) % 30), distanceKm: Math.round((3 + ((i * 13) % 90) / 10) * 10) / 10,
        items: [
          { resourceName: 'Agua embotellada', quantity: 20 + i, unit: 'bidones' },
          { resourceName: 'Kits de alimentos', quantity: 40 + i * 2, unit: 'kits' },
        ],
        assignedAt: '2026-11-11T20:30:00',
      },
    };
  });

export class BrigadeMockRepository extends BrigadeRepository {
  constructor() {
    super();
    this.dtos = buildDtos(); // en memoria: los cambios duran hasta recargar la página
    this.sequence = 0;
  }

  find(brigadeId) {
    const dto = this.dtos.find((item) => item.id === brigadeId);
    if (!dto) throw problem(404, 'Brigada no encontrada');
    return dto;
  }

  async findAll() {
    await delay(400);
    return this.dtos.map(toBrigade);
  }

  async findById(brigadeId) {
    await delay(300);
    return toBrigadeDetail(this.find(brigadeId));
  }

  async create({ name, code, latitude, longitude }) {
    await delay(500);
    if (this.dtos.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      throw problem(409, 'Ya existe una brigada con ese nombre en tu organización.');
    }
    this.sequence += 1;
    const id = 'br-new-' + this.sequence;
    this.dtos.push({
      id, name, code: code ?? 'BRG-' + name.slice(0, 4).toUpperCase() + '-' + (90 + this.sequence),
      status: 'AVAILABLE', baseLocation: { latitude, longitude }, members: [], assignment: null,
    });
    this.dtos.sort((a, b) => a.name.localeCompare(b.name));
    return id;
  }

  async addMember(brigadeId, { name, role }) {
    await delay(400);
    const dto = this.find(brigadeId);
    this.sequence += 1;
    dto.members.push({ id: 'mb-new-' + this.sequence, name, role });
  }

  async removeMember(brigadeId, memberId) {
    await delay(400);
    const dto = this.find(brigadeId);
    const member = dto.members.find((item) => item.id === memberId);
    if (!member) throw problem(404, 'Miembro no encontrado');
    const leaders = dto.members.filter((item) => item.role === 'LEADER');
    if (dto.status === 'ASSIGNED' && member.role === 'LEADER' && leaders.length === 1) {
      throw problem(422, 'No se puede quitar al último líder mientras la brigada está asignada.');
    }
    dto.members = dto.members.filter((item) => item.id !== memberId);
  }

  async setAvailability(brigadeId, status) {
    await delay(400);
    const dto = this.find(brigadeId);
    if (dto.status === 'ASSIGNED') throw problem(409, 'No se puede cambiar la disponibilidad mientras la brigada está asignada.');
    dto.status = status;
  }
}
`);

write(RM + 'infrastructure/container.js', String.raw`
import { BrigadeMockRepository } from './mock/brigadeMockRepository.js';
import { BrigadeHttpRepository } from './http/brigadeHttpRepository.js';
import { GetBrigadeOverview } from '../application/useCases/getBrigadeOverview.js';
import { GetBrigadeList } from '../application/useCases/getBrigadeList.js';
import { GetBrigadeDetail } from '../application/useCases/getBrigadeDetail.js';
import { CreateBrigade } from '../application/useCases/createBrigade.js';
import { AddBrigadeMember } from '../application/useCases/addBrigadeMember.js';
import { RemoveBrigadeMember } from '../application/useCases/removeBrigadeMember.js';
import { SetBrigadeAvailability } from '../application/useCases/setBrigadeAvailability.js';
import { env } from '@shared/infrastructure/config/env.js';

const brigadeRepository = env.useMocks ? new BrigadeMockRepository() : new BrigadeHttpRepository();

export const getBrigadeOverviewUseCase = new GetBrigadeOverview(brigadeRepository);
export const getBrigadeListUseCase = new GetBrigadeList(brigadeRepository);
export const getBrigadeDetailUseCase = new GetBrigadeDetail(brigadeRepository);
export const createBrigadeUseCase = new CreateBrigade(brigadeRepository);
export const addBrigadeMemberUseCase = new AddBrigadeMember(brigadeRepository);
export const removeBrigadeMemberUseCase = new RemoveBrigadeMember(brigadeRepository);
export const setBrigadeAvailabilityUseCase = new SetBrigadeAvailability(brigadeRepository);
`);

/* ════════════════════════ PRESENTATION: HOOKS ════════════════════════ */
write(RM + 'presentation/hooks/useBrigadeList.js', String.raw`
import { useQuery } from '@tanstack/react-query';
import { getBrigadeListUseCase } from '../../infrastructure/container.js';

export function useBrigadeList() {
  return useQuery({
    queryKey: ['brigades', 'list'],
    queryFn: () => getBrigadeListUseCase.execute(),
  });
}
`);

write(RM + 'presentation/hooks/useBrigadeDetail.js', String.raw`
import { useQuery } from '@tanstack/react-query';
import { getBrigadeDetailUseCase } from '../../infrastructure/container.js';

export function useBrigadeDetail(brigadeId) {
  return useQuery({
    queryKey: ['brigades', 'detail', brigadeId],
    queryFn: () => getBrigadeDetailUseCase.execute(brigadeId),
    enabled: Boolean(brigadeId),
  });
}
`);

const mutationHook = (name, useCase, doc, call) => `
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ${useCase} } from '../../infrastructure/container.js';

// ${doc}
export function ${name}() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ${call},
    // Refresca la lista, el detalle y el resumen del tablero.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brigades'] }),
  });
}
`;
write(RM + 'presentation/hooks/useCreateBrigade.js',
  mutationHook('useCreateBrigade', 'createBrigadeUseCase', 'mutate({ name, code, latitude, longitude }): crea una brigada disponible.', '(values) => createBrigadeUseCase.execute(values)'));
write(RM + 'presentation/hooks/useAddBrigadeMember.js',
  mutationHook('useAddBrigadeMember', 'addBrigadeMemberUseCase', 'mutate({ brigadeId, name, role }): agrega un miembro.', '(values) => addBrigadeMemberUseCase.execute(values)'));
write(RM + 'presentation/hooks/useRemoveBrigadeMember.js',
  mutationHook('useRemoveBrigadeMember', 'removeBrigadeMemberUseCase', 'mutate({ brigadeId, memberId }): quita un miembro.', '(values) => removeBrigadeMemberUseCase.execute(values)'));
write(RM + 'presentation/hooks/useSetBrigadeAvailability.js',
  mutationHook('useSetBrigadeAvailability', 'setBrigadeAvailabilityUseCase', 'mutate({ brigadeId, status }): pone la brigada en servicio o fuera de servicio.', '(values) => setBrigadeAvailabilityUseCase.execute(values)'));

/* ════════════════════════ PRESENTATION: UTILS + COMPONENTS ════════════════════════ */
write(RM + 'presentation/utils/brigadeFormat.js', String.raw`
import { humanize } from '@shared/utils/formatters.js';

export const statusLabel = (t, status) => t('brigades.status.' + status, { defaultValue: humanize(status) });
export const roleLabel = (t, role) => t('brigades.roles.' + role, { defaultValue: humanize(role) });

// "M. Quispe" -> "MQ"; "Brigada Alfa" -> "AL"
export function initials(name) {
  const words = String(name ?? '').replace(/^Brigada\s+/i, '').split(/\s+/).filter(Boolean);
  const value = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '').slice(0, 2);
  return value.toUpperCase() || '—';
}

const VALIDATION = ['nameRequired', 'locationInvalid', 'memberNameRequired', 'roleInvalid', 'statusInvalid'];

// El backend responde application/problem+json: se muestra su "detail" tal cual; si no hay, un texto según el caso.
export function brigadeErrorMessage(t, error) {
  if (!error) return null;
  if (VALIDATION.includes(error.message)) return t('brigades.errors.' + error.message);
  if (error.detail) return error.detail;
  if (error.status === 403) return t('brigades.errors.forbidden');
  return t('brigades.errors.generic');
}
`);

write(RM + 'presentation/components/brigadeList.jsx', String.raw`
import { useTranslation } from 'react-i18next';
import { BrigadeTab } from '../../domain/services/filterBrigades.js';
import { statusLabel } from '../utils/brigadeFormat.js';

const TABS = [BrigadeTab.ALL, BrigadeTab.ASSIGNED, BrigadeTab.AVAILABLE, BrigadeTab.OFF_DUTY];

export default function BrigadeList({ brigades, counts, tab, onTab, search, onSearch, selectedId, onSelect, loading }) {
  const { t } = useTranslation('resourceManagement');

  return (
    <section className="fl-card" aria-labelledby="fl-list-title">
      <h2 id="fl-list-title" className="fl-h2">{t('brigades.list.title')}</h2>

      <label className="fl-search">
        <span className="fl-sr">{t('brigades.list.search')}</span>
        <input
          type="search" value={search} placeholder={t('brigades.list.search')}
          onChange={(event) => onSearch(event.target.value)}
        />
      </label>

      <div className="fl-tabs" role="group" aria-label={t('brigades.list.filters')}>
        {TABS.map((key) => (
          <button
            key={key} type="button" className="fl-tab" aria-pressed={tab === key} onClick={() => onTab(key)}
          >
            {t('brigades.tabs.' + key)} <span className="fl-tab__count">{counts[key] ?? 0}</span>
          </button>
        ))}
      </div>

      <ul className="fl-list">
        {loading && [0, 1, 2, 3].map((n) => <li key={n}><span className="fl-skel" /></li>)}
        {!loading && brigades.length === 0 && <li className="fl-empty">{t('brigades.list.empty')}</li>}
        {!loading && brigades.map((brigade) => (
          <li key={brigade.id}>
            <button
              type="button" className={'fl-brigade' + (brigade.id === selectedId ? ' is-selected' : '')}
              aria-pressed={brigade.id === selectedId} onClick={() => onSelect(brigade.id)}
            >
              <span className="fl-brigade__top">
                <strong>{brigade.name}</strong>
                <span className={'fl-chip fl-chip--' + brigade.status.toLowerCase()}>{statusLabel(t, brigade.status)}</span>
              </span>
              <span className="fl-brigade__meta">
                {[brigade.code, brigade.memberCount !== null ? t('brigades.list.members', { count: brigade.memberCount }) : null]
                  .filter(Boolean).join(' · ')}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
`);

write(RM + 'presentation/components/brigadeMission.jsx', String.raw`
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@shared/utils/formatters.js';

// Centro de la pantalla: la misión en curso de la brigada seleccionada. Las misiones no se crean aquí:
// nacen al aprobar un plan de distribución (Priorización IA → zona → Asignar brigada).
export default function BrigadeMission({ detail, onOpenZone, onOpenPrioritization }) {
  const { t, i18n } = useTranslation('resourceManagement');
  const lng = i18n.resolvedLanguage;
  const brigade = detail.data;
  const assignment = brigade?.assignment ?? null;

  return (
    <section className="fl-card" aria-labelledby="fl-mission-title">
      <h2 id="fl-mission-title" className="fl-h2">{t('brigades.mission.title')}</h2>

      {detail.isLoading && <span className="fl-skel fl-skel--block" />}
      {detail.isError && <p className="fl-error" role="alert">{detail.error?.detail ?? t('brigades.loadError')}</p>}

      {brigade && assignment && (
        <div className="fl-mission">
          <div className="fl-mission__head">
            <div>
              <span className="fl-label">{t('brigades.mission.zone')}</span>
              <p className="fl-mission__zone">{assignment.zoneName ?? '—'}</p>
            </div>
            {assignment.score !== null && assignment.score !== undefined && (
              <span className="fl-score">{Math.round(assignment.score)}</span>
            )}
          </div>

          <dl className="fl-facts">
            {assignment.etaMinutes !== null && (
              <div><dt>{t('brigades.mission.eta')}</dt><dd>{t('brigades.mission.minutes', { count: assignment.etaMinutes })}</dd></div>
            )}
            {assignment.distanceKm !== null && (
              <div><dt>{t('brigades.mission.distance')}</dt><dd>{formatNumber(assignment.distanceKm, lng)} km</dd></div>
            )}
          </dl>

          {assignment.resources.length > 0 && (
            <div>
              <span className="fl-label">{t('brigades.mission.resources')}</span>
              <ul className="fl-resources">
                {assignment.resources.map((resource) => (
                  <li key={resource.name}>
                    <span>{resource.name}</span>
                    <strong>
                      {resource.quantity !== null ? formatNumber(resource.quantity, lng) : '—'}
                      {resource.unit ? ' ' + resource.unit : ''}
                    </strong>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {assignment.zoneId && (
            <button type="button" className="fl-btn-outline" onClick={() => onOpenZone(assignment.zoneId)}>
              {t('brigades.mission.openZone')}
            </button>
          )}
        </div>
      )}

      {brigade && !assignment && (
        <div className="fl-mission fl-mission--empty">
          <p>{t('brigades.mission.none')}</p>
          <p className="fl-note">{t('brigades.mission.noneHint')}</p>
          <button type="button" className="fl-btn-lime" onClick={onOpenPrioritization}>
            {t('brigades.mission.goPrioritization')}
          </button>
        </div>
      )}
    </section>
  );
}
`);

write(RM + 'presentation/components/brigadeDetailPanel.jsx', String.raw`
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BrigadeStatus } from '../../domain/enums/brigadeStatus.js';
import { MemberRole } from '../../domain/enums/memberRole.js';
import { useAddBrigadeMember } from '../hooks/useAddBrigadeMember.js';
import { useRemoveBrigadeMember } from '../hooks/useRemoveBrigadeMember.js';
import { useSetBrigadeAvailability } from '../hooks/useSetBrigadeAvailability.js';
import { brigadeErrorMessage, initials, roleLabel, statusLabel } from '../utils/brigadeFormat.js';

export default function BrigadeDetailPanel({ detail, canManage }) {
  const { t } = useTranslation('resourceManagement');
  const addMember = useAddBrigadeMember();
  const removeMember = useRemoveBrigadeMember();
  const setAvailability = useSetBrigadeAvailability();
  const [name, setName] = useState('');
  const [role, setRole] = useState(MemberRole.VOLUNTEER);
  const [failure, setFailure] = useState(null);
  const brigade = detail.data;

  const run = (mutation, values, onSuccess) => {
    setFailure(null);
    mutation.mutate(values, { onSuccess, onError: setFailure });
  };

  const submitMember = (event) => {
    event.preventDefault();
    run(addMember, { brigadeId: brigade.id, name, role }, () => setName(''));
  };

  const busy = addMember.isPending || removeMember.isPending || setAvailability.isPending;
  const error = brigadeErrorMessage(t, failure);

  return (
    <aside className="fl-card" aria-labelledby="fl-detail-title">
      {detail.isLoading && <span className="fl-skel fl-skel--block" />}
      {detail.isError && <p className="fl-error" role="alert">{detail.error?.detail ?? t('brigades.loadError')}</p>}

      {brigade && (
        <>
          <header className="fl-detail__head">
            <span className="fl-avatar" aria-hidden="true">{initials(brigade.name)}</span>
            <div>
              <h2 id="fl-detail-title" className="fl-h2 fl-h2--tight">{brigade.name}</h2>
              <span className={'fl-chip fl-chip--' + brigade.status.toLowerCase()}>{statusLabel(t, brigade.status)}</span>
            </div>
          </header>

          <dl className="fl-facts">
            {brigade.code && <div><dt>{t('brigades.detail.code')}</dt><dd>{brigade.code}</dd></div>}
            <div>
              <dt>{t('brigades.detail.base')}</dt>
              <dd>{brigade.hasPosition ? brigade.latitude.toFixed(4) + ', ' + brigade.longitude.toFixed(4) : '—'}</dd>
            </div>
          </dl>

          {!brigade.hasLeader && <p className="fl-warning">{t('brigades.detail.noLeader')}</p>}

          <div>
            <span className="fl-label">{t('brigades.detail.members')}</span>
            {brigade.members.length === 0 && <p className="fl-note">{t('brigades.detail.noMembers')}</p>}
            <ul className="fl-members">
              {brigade.members.map((member) => (
                <li key={member.id}>
                  <span className="fl-avatar fl-avatar--sm" aria-hidden="true">{initials(member.name)}</span>
                  <span className="fl-members__name">{member.name}</span>
                  <span className="fl-members__role">{roleLabel(t, member.role)}</span>
                  {canManage && (
                    <button
                      type="button" className="fl-icon-btn" disabled={busy}
                      aria-label={t('brigades.detail.remove', { name: member.name })}
                      onClick={() => run(removeMember, { brigadeId: brigade.id, memberId: member.id })}
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {canManage && (
            <form className="fl-add" onSubmit={submitMember} noValidate>
              <span className="fl-label">{t('brigades.detail.addMember')}</span>
              <div className="fl-add__row">
                <input
                  value={name} onChange={(event) => setName(event.target.value)}
                  placeholder={t('brigades.detail.memberName')} aria-label={t('brigades.detail.memberName')}
                />
                <select value={role} onChange={(event) => setRole(event.target.value)} aria-label={t('brigades.detail.memberRole')}>
                  {Object.values(MemberRole).map((value) => (
                    <option key={value} value={value}>{roleLabel(t, value)}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="fl-btn-outline" disabled={busy}>
                {addMember.isPending ? t('brigades.detail.adding') : t('brigades.detail.add')}
              </button>
            </form>
          )}

          {canManage && (
            <div className="fl-availability">
              {brigade.isDeployed ? (
                <p className="fl-note">{t('brigades.detail.lockedWhileAssigned')}</p>
              ) : (
                <button
                  type="button" className="fl-btn-lime" disabled={busy}
                  onClick={() => run(setAvailability, {
                    brigadeId: brigade.id,
                    status: brigade.isOffDuty ? BrigadeStatus.AVAILABLE : BrigadeStatus.OFF_DUTY,
                  })}
                >
                  {brigade.isOffDuty ? t('brigades.detail.putInService') : t('brigades.detail.putOffDuty')}
                </button>
              )}
            </div>
          )}

          {!canManage && <p className="fl-note">{t('brigades.detail.readOnly')}</p>}
          {error && <p className="fl-error" role="alert">{error}</p>}
        </>
      )}
    </aside>
  );
}
`);

write(RM + 'presentation/components/newBrigadeDialog.jsx', String.raw`
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateBrigade } from '../hooks/useCreateBrigade.js';
import { brigadeErrorMessage } from '../utils/brigadeFormat.js';

export default function NewBrigadeDialog({ onClose, onCreated }) {
  const { t } = useTranslation('resourceManagement');
  const [values, setValues] = useState({ name: '', code: '', latitude: '', longitude: '' });
  const mutation = useCreateBrigade();
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
    mutation.mutate(values, { onSuccess: (id) => onCreated(id) });
  };
  const message = brigadeErrorMessage(t, mutation.error);

  return (
    <>
      <div className="fl-backdrop" onClick={onClose} aria-hidden="true" />
      <form className="fl-dialog" role="dialog" aria-modal="true" aria-labelledby="fl-new-title" onSubmit={submit} noValidate>
        <h2 id="fl-new-title" className="fl-h2">{t('brigades.new.title')}</h2>
        <p className="fl-note">{t('brigades.new.hint')}</p>

        <label className="fl-field">
          <span>{t('brigades.new.name')}</span>
          <input ref={nameRef} value={values.name} onChange={change('name')} />
        </label>
        <label className="fl-field">
          <span>{t('brigades.new.code')}</span>
          <input value={values.code} onChange={change('code')} placeholder={t('brigades.new.codePlaceholder')} />
        </label>
        <div className="fl-field-row">
          <label className="fl-field">
            <span>{t('brigades.new.latitude')}</span>
            <input value={values.latitude} onChange={change('latitude')} inputMode="decimal" placeholder="-11.9367" />
          </label>
          <label className="fl-field">
            <span>{t('brigades.new.longitude')}</span>
            <input value={values.longitude} onChange={change('longitude')} inputMode="decimal" placeholder="-76.7012" />
          </label>
        </div>

        {message && <p className="fl-error" role="alert">{message}</p>}
        <div className="fl-actions">
          <button type="submit" className="fl-btn-lime" disabled={mutation.isPending}>
            {mutation.isPending ? t('brigades.new.saving') : t('brigades.new.create')}
          </button>
          <button type="button" className="fl-btn-outline" onClick={onClose} disabled={mutation.isPending}>
            {t('brigades.new.cancel')}
          </button>
        </div>
      </form>
    </>
  );
}
`);

write(RM + 'presentation/pages/fieldLogisticsPage.jsx', String.raw`
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { routes } from '@app/router/routes.js';
import { usePermissions } from '@bc/identityAccess/presentation/hooks/usePermissions.js';
import { BrigadeTab, countByTab, filterBrigades } from '../../domain/services/filterBrigades.js';
import { useBrigadeList } from '../hooks/useBrigadeList.js';
import { useBrigadeDetail } from '../hooks/useBrigadeDetail.js';
import BrigadeList from '../components/brigadeList.jsx';
import BrigadeMission from '../components/brigadeMission.jsx';
import BrigadeDetailPanel from '../components/brigadeDetailPanel.jsx';
import NewBrigadeDialog from '../components/newBrigadeDialog.jsx';
import '../styles/fieldLogistics.css';

export default function FieldLogisticsPage() {
  const { t } = useTranslation('resourceManagement');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin } = usePermissions();

  const list = useBrigadeList();
  const [tab, setTab] = useState(BrigadeTab.ALL);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const brigades = useMemo(() => list.data ?? [], [list.data]);
  const counts = useMemo(() => countByTab(brigades), [brigades]);
  const visible = useMemo(() => filterBrigades(brigades, { tab, search }), [brigades, tab, search]);

  // La brigada abierta vive en la URL (?brigade=); si no hay o ya no existe, se abre la primera de la lista.
  const requested = searchParams.get('brigade');
  const selectedId = brigades.some((brigade) => brigade.id === requested) ? requested : visible[0]?.id ?? null;
  const select = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set('brigade', id);
    setSearchParams(next, { replace: true });
  };

  const detail = useBrigadeDetail(selectedId);

  return (
    <div className="fl">
      <header className="fl-head">
        <div>
          <h1>{t('brigades.title')}</h1>
          <p>{t('brigades.subtitle', { deployed: counts[BrigadeTab.ASSIGNED], total: counts[BrigadeTab.ALL] })}</p>
        </div>
        {isAdmin && (
          <button type="button" className="fl-btn-lime" onClick={() => setCreating(true)}>{t('brigades.new.open')}</button>
        )}
      </header>

      {list.isError && (
        <p className="fl-alert" role="alert">
          {t('brigades.loadError')}{' '}
          <button type="button" className="fl-link-btn" onClick={() => list.refetch()}>{t('brigades.retry')}</button>
        </p>
      )}

      <div className="fl-grid">
        <BrigadeList
          brigades={visible} counts={counts} tab={tab} onTab={setTab} search={search} onSearch={setSearch}
          selectedId={selectedId} onSelect={select} loading={list.isLoading}
        />
        {selectedId ? (
          <>
            <BrigadeMission
              detail={detail}
              onOpenZone={(zoneId) => navigate(routes.prioritization + '?zone=' + zoneId)}
              onOpenPrioritization={() => navigate(routes.prioritization)}
            />
            <BrigadeDetailPanel detail={detail} canManage={isAdmin} />
          </>
        ) : (
          !list.isLoading && <p className="fl-card fl-empty fl-grid__rest">{t('brigades.noSelection')}</p>
        )}
      </div>

      {creating && (
        <NewBrigadeDialog
          onClose={() => setCreating(false)}
          onCreated={(id) => { setCreating(false); setTab(BrigadeTab.ALL); setSearch(''); if (id) select(id); }}
        />
      )}
    </div>
  );
}
`);

write(RM + 'presentation/styles/fieldLogistics.css', String.raw`
.fl { display: grid; gap: var(--space-3); }
.fl-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

.fl-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.fl-head h1 { margin: 0 0 4px; font-size: 1.75rem; font-weight: 700; letter-spacing: -0.02em; }
.fl-head p { margin: 0; color: var(--night-100); }

.fl-alert { margin: 0; padding: 12px 16px; border: 1px solid rgba(255, 77, 77, 0.35); border-radius: 12px; background: rgba(255, 77, 77, 0.1); color: #ffb3b3; font-size: 0.875rem; }
.fl-error { margin: 8px 0 0; color: #ff9b9b; font-size: 0.875rem; }
.fl-note { margin: 8px 0 0; font-size: 0.8125rem; color: var(--night-100); }
.fl-warning { margin: 0; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255, 176, 32, 0.4); background: rgba(255, 176, 32, 0.08); color: #ffcf70; font-size: 0.8125rem; }
.fl-label { display: block; margin-bottom: 6px; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-sky); }
.fl-h2 { margin: 0 0 14px; font-size: 1.0625rem; font-weight: 700; }
.fl-h2--tight { margin: 0 0 6px; }

.fl-btn-lime, .fl-btn-outline { min-height: 44px; padding: 0 20px; border-radius: 10px; font: inherit; font-weight: 700; cursor: pointer; transition: filter 0.2s, background 0.2s, transform 0.2s; }
.fl-btn-lime { border: 0; background: var(--color-lime); color: var(--night-600); }
.fl-btn-lime:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); }
.fl-btn-outline { border: 1.5px solid rgba(255, 255, 255, 0.85); background: transparent; color: #fff; }
.fl-btn-outline:hover:not(:disabled) { background: rgba(255, 255, 255, 0.08); }
.fl-btn-lime:disabled, .fl-btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }
.fl-link-btn { padding: 0; border: 0; background: transparent; color: var(--color-sky); font: inherit; text-decoration: underline; cursor: pointer; }
.fl-btn-lime:focus-visible, .fl-btn-outline:focus-visible, .fl-link-btn:focus-visible, .fl-tab:focus-visible, .fl-brigade:focus-visible, .fl-icon-btn:focus-visible { outline: 2px solid var(--color-sky); outline-offset: 2px; }

.fl-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr) minmax(0, 1fr); gap: var(--space-3); align-items: start; }
.fl-grid__rest { grid-column: span 2; }
.fl-card { min-width: 0; display: grid; align-content: start; gap: 14px; padding: 20px; border: 1px solid var(--cc-line); border-radius: 16px; background: var(--cc-card); }
.fl-card > .fl-h2 { margin-bottom: 0; }

.fl-search input { width: 100%; height: 44px; padding: 0 14px; border: 0; border-radius: 10px; background: var(--cc-card-inner); color: #fff; font: inherit; }
.fl-search input:focus-visible { outline: 2px solid var(--color-royal); }
.fl-tabs { display: flex; flex-wrap: wrap; gap: 8px; }
.fl-tab { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 12px; border: 1px solid var(--cc-line); border-radius: 999px; background: transparent; color: var(--night-100); font: inherit; font-size: 0.8125rem; cursor: pointer; }
.fl-tab[aria-pressed='true'] { border-color: var(--color-lime); color: var(--color-lime); background: rgba(190, 242, 100, 0.08); font-weight: 700; }
.fl-tab__count { opacity: 0.8; font-variant-numeric: tabular-nums; }

.fl-list { display: grid; gap: 10px; max-height: 560px; margin: 0; padding: 0 4px 0 0; overflow-y: auto; list-style: none; }
.fl-brigade { display: grid; gap: 6px; width: 100%; padding: 14px 16px; border: 1px solid transparent; border-radius: 12px; background: var(--cc-card-inner); color: #fff; font: inherit; text-align: left; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
.fl-brigade:hover { background: rgba(255, 255, 255, 0.06); }
.fl-brigade.is-selected { border-color: var(--color-lime); }
.fl-brigade__top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.fl-brigade__meta { font-size: 0.8125rem; color: var(--night-100); }
.fl-empty { padding: 24px 8px; text-align: center; color: var(--night-100); }

.fl-chip { display: inline-flex; align-items: center; min-height: 22px; padding: 0 10px; border-radius: 999px; background: rgba(255, 255, 255, 0.1); font-size: 0.75rem; font-weight: 700; white-space: nowrap; }
.fl-chip--assigned { background: rgba(133, 213, 246, 0.16); color: var(--color-sky); }
.fl-chip--available { background: rgba(190, 242, 100, 0.16); color: var(--color-lime); }
.fl-chip--off_duty { background: rgba(255, 255, 255, 0.1); color: var(--night-100); }

.fl-mission { display: grid; gap: 16px; }
.fl-mission--empty { padding: 8px 0; justify-items: start; }
.fl-mission--empty p { margin: 0; }
.fl-mission__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.fl-mission__zone { margin: 0; font-size: 1.25rem; font-weight: 700; }
.fl-score { display: inline-grid; place-items: center; min-width: 40px; height: 28px; padding: 0 10px; border-radius: 999px; background: var(--color-lime); color: var(--night-600); font-size: 0.875rem; font-weight: 700; }
.fl-resources { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.fl-resources li { display: flex; justify-content: space-between; gap: 12px; padding: 10px 12px; border-radius: 10px; background: var(--cc-card-inner); font-size: 0.875rem; }

.fl-facts { display: grid; gap: 8px; margin: 0; }
.fl-facts div { display: flex; justify-content: space-between; gap: 16px; font-size: 0.875rem; }
.fl-facts dt { color: var(--night-100); }
.fl-facts dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }

.fl-detail__head { display: flex; align-items: center; gap: 14px; }
.fl-avatar { display: grid; place-items: center; flex: none; width: 48px; height: 48px; border-radius: 50%; background: var(--color-royal); font-weight: 700; }
.fl-avatar--sm { width: 32px; height: 32px; font-size: 0.75rem; }
.fl-members { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
.fl-members li { display: flex; align-items: center; gap: 10px; }
.fl-members__name { flex: 1; min-width: 0; font-size: 0.9375rem; }
.fl-members__role { color: var(--night-100); font-size: 0.8125rem; }
.fl-icon-btn { display: grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: 8px; background: transparent; color: var(--night-100); font-size: 1.125rem; cursor: pointer; }
.fl-icon-btn:hover:not(:disabled) { background: rgba(255, 107, 107, 0.16); color: #ff9b9b; }
.fl-icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.fl-add { display: grid; gap: 10px; }
.fl-add__row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
.fl-add input { min-width: 0; }
.fl-add input, .fl-add select, .fl-field input { height: 40px; padding: 0 12px; border: 1px solid var(--cc-line); border-radius: 10px; background: var(--cc-card-inner); color: #fff; font: inherit; }
.fl-add select option { background: var(--cc-card); }
.fl-add input:focus-visible, .fl-add select:focus-visible, .fl-field input:focus-visible { outline: 2px solid var(--color-royal); }

.fl-skel { display: block; height: 64px; border-radius: 12px; background: linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.1), rgba(255,255,255,0.04)); background-size: 200% 100%; animation: cc-shimmer 1.4s linear infinite; }
.fl-skel--block { height: 140px; }

.fl-backdrop { position: fixed; inset: 0; z-index: 40; background: rgba(5, 5, 30, 0.6); }
.fl-dialog { position: fixed; z-index: 41; top: 50%; left: 50%; display: grid; gap: 12px; width: min(440px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow-y: auto; padding: 24px; border: 1px solid var(--cc-line); border-radius: 16px; background: var(--cc-card); transform: translate(-50%, -50%); }
.fl-dialog .fl-h2 { margin: 0; }
.fl-field { display: grid; gap: 6px; font-size: 0.8125rem; font-weight: 500; }
.fl-field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.fl-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 4px; }

@media (max-width: 1180px) {
  .fl-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr); }
  .fl-grid > :nth-child(3) { grid-column: 1 / -1; }
  .fl-grid__rest { grid-column: span 1; }
}
@media (max-width: 760px) {
  .fl-grid { grid-template-columns: 1fr; }
  .fl-field-row, .fl-actions { grid-template-columns: 1fr; }
  .fl-list { max-height: 420px; }
}
`);

/* ════════════════════════ I18N ════════════════════════ */
mergeJson(RM + 'presentation/i18n/es.json', {
  fieldLogistics: { title: 'Logística de campo' },
  brigades: {
    title: 'Logística de Campo y Brigadas',
    subtitle: '{{deployed}} de {{total}} brigadas desplegadas',
    loadError: 'No se pudo cargar la información de brigadas.',
    retry: 'Reintentar',
    noSelection: 'Todavía no hay brigadas. Crea la primera para empezar.',
    status: { AVAILABLE: 'Disponible', ASSIGNED: 'En misión', OFF_DUTY: 'Fuera de servicio' },
    roles: { LEADER: 'Líder', DRIVER: 'Conductor', MEDIC: 'Paramédico', VOLUNTEER: 'Voluntario' },
    tabs: { all: 'Todas', assigned: 'En misión', available: 'Disponibles', offDuty: 'Fuera de servicio' },
    list: {
      title: 'Brigadas activas',
      search: 'Buscar brigada o código',
      filters: 'Filtrar por estado',
      empty: 'No hay brigadas con ese filtro.',
      members: '{{count}} pers.',
    },
    mission: {
      title: 'Misión en curso',
      zone: 'Zona de destino',
      eta: 'Llegada estimada',
      minutes: '{{count}} min',
      distance: 'Distancia',
      resources: 'Recursos a entregar',
      openZone: 'Ver zona en Priorización IA',
      none: 'Esta brigada no tiene una misión en curso.',
      noneHint: 'Las misiones nacen al aprobar un plan de distribución: la IA elige la brigada libre más cercana con un líder.',
      goPrioritization: 'Ir a Priorización IA',
    },
    detail: {
      code: 'Código',
      base: 'Base (GPS)',
      members: 'Miembros',
      noMembers: 'Esta brigada todavía no tiene miembros.',
      noLeader: 'Sin líder: la IA no le asignará misiones hasta que tenga uno.',
      remove: 'Quitar a {{name}}',
      addMember: 'Agregar miembro',
      memberName: 'Nombre',
      memberRole: 'Rol',
      add: 'Agregar',
      adding: 'Agregando...',
      putOffDuty: 'Poner fuera de servicio',
      putInService: 'Poner en servicio',
      lockedWhileAssigned: 'No se puede cambiar la disponibilidad mientras la brigada está en misión.',
      readOnly: 'Tu rol solo permite consultar. Las brigadas las administra el administrador de la organización.',
    },
    new: {
      open: 'Nueva brigada',
      title: 'Nueva brigada',
      hint: 'Nace disponible. Agrega al menos un líder para que pueda recibir misiones.',
      name: 'Nombre',
      code: 'Código (opcional)',
      codePlaceholder: 'Se genera si lo dejas vacío',
      latitude: 'Latitud de la base',
      longitude: 'Longitud de la base',
      create: 'Crear brigada',
      saving: 'Creando...',
      cancel: 'Cancelar',
    },
    errors: {
      nameRequired: 'Escribe el nombre de la brigada.',
      locationInvalid: 'Escribe una latitud (−90 a 90) y una longitud (−180 a 180) válidas.',
      memberNameRequired: 'Escribe el nombre del miembro.',
      roleInvalid: 'Elige un rol válido.',
      statusInvalid: 'Estado no válido.',
      forbidden: 'Solo el administrador de la organización puede modificar brigadas.',
      generic: 'No se pudo completar la operación. Inténtalo nuevamente.',
    },
  },
});

mergeJson(RM + 'presentation/i18n/en.json', {
  fieldLogistics: { title: 'Field logistics' },
  brigades: {
    title: 'Field Logistics and Brigades',
    subtitle: '{{deployed}} of {{total}} brigades deployed',
    loadError: 'Could not load the brigade information.',
    retry: 'Retry',
    noSelection: 'There are no brigades yet. Create the first one to get started.',
    status: { AVAILABLE: 'Available', ASSIGNED: 'On mission', OFF_DUTY: 'Off duty' },
    roles: { LEADER: 'Leader', DRIVER: 'Driver', MEDIC: 'Paramedic', VOLUNTEER: 'Volunteer' },
    tabs: { all: 'All', assigned: 'On mission', available: 'Available', offDuty: 'Off duty' },
    list: {
      title: 'Active brigades',
      search: 'Search brigade or code',
      filters: 'Filter by status',
      empty: 'No brigades match this filter.',
      members: '{{count}} people',
    },
    mission: {
      title: 'Current mission',
      zone: 'Destination zone',
      eta: 'Estimated arrival',
      minutes: '{{count}} min',
      distance: 'Distance',
      resources: 'Resources to deliver',
      openZone: 'View zone in AI Prioritization',
      none: 'This brigade has no mission in progress.',
      noneHint: 'Missions start when a distribution plan is approved: the AI picks the nearest free brigade with a leader.',
      goPrioritization: 'Go to AI Prioritization',
    },
    detail: {
      code: 'Code',
      base: 'Base (GPS)',
      members: 'Members',
      noMembers: 'This brigade has no members yet.',
      noLeader: 'No leader: the AI will not assign it missions until it has one.',
      remove: 'Remove {{name}}',
      addMember: 'Add member',
      memberName: 'Name',
      memberRole: 'Role',
      add: 'Add',
      adding: 'Adding...',
      putOffDuty: 'Set off duty',
      putInService: 'Put in service',
      lockedWhileAssigned: 'Availability cannot be changed while the brigade is on a mission.',
      readOnly: 'Your role is read-only. Brigades are managed by the organization administrator.',
    },
    new: {
      open: 'New brigade',
      title: 'New brigade',
      hint: 'It starts available. Add at least one leader so it can receive missions.',
      name: 'Name',
      code: 'Code (optional)',
      codePlaceholder: 'Generated if left empty',
      latitude: 'Base latitude',
      longitude: 'Base longitude',
      create: 'Create brigade',
      saving: 'Creating...',
      cancel: 'Cancel',
    },
    errors: {
      nameRequired: 'Enter the brigade name.',
      locationInvalid: 'Enter a valid latitude (−90 to 90) and longitude (−180 to 180).',
      memberNameRequired: 'Enter the member name.',
      roleInvalid: 'Choose a valid role.',
      statusInvalid: 'Invalid status.',
      forbidden: 'Only the organization administrator can change brigades.',
      generic: 'The operation could not be completed. Please try again.',
    },
  },
});

console.log('\nListo. Reinicia "npm run dev" y entra a Brigadas (menú lateral). Con administrador@... puedes crear brigadas y editar miembros.');
