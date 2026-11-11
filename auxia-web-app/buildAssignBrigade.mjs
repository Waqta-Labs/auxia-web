// Asignar brigada (W_03 → drawer): plan de distribución de la zona, aprobación y asignación de brigada.
// Uso (en la raíz del proyecto, después de buildPrioritization.mjs): node buildAssignBrigade.mjs
// Crea archivos nuevos y modifica: scoreDrawer.jsx, prioritizationPage.jsx, container.js (emergencyManagement),
// prioritization.css (agrega estilos al final) e i18n es/en (mezcla; incluye la etiqueta de la variable "needs" del modelo).
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
// Reemplaza un fragmento exacto. Si ya estaba aplicado lo salta; si no lo encuentra, aborta.
const patch = (path, pairs) => {
  if (!existsSync(path)) throw new Error('No existe ' + path + '. ¿Corriste buildPrioritization.mjs antes y estás en la raíz del proyecto?');
  let text = readFileSync(path, 'utf8');
  for (const [from, to] of pairs) {
    if (to && text.includes(to)) continue;  // ya aplicado (el script se puede correr más de una vez)
    if (text.includes(from)) text = text.replace(from, () => to);
    else if (to !== '') throw new Error('No encontré el fragmento esperado en ' + path + ':\n' + from);
  }
  writeFileSync(path, text);
  console.log('~ ' + path);
};

const EM = 'src/boundedContexts/emergencyManagement/';

/* ════════════════════════ DOMAIN ════════════════════════ */
write(EM + 'domain/enums/planStatus.js', String.raw`
// Estado de un plan de distribución. Un plan nace PROPOSED; al aprobarse se le asigna brigada;
// al registrarse su entrega pasa a EXECUTED.
export const PlanStatus = Object.freeze({
  PROPOSED: 'PROPOSED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXECUTED: 'EXECUTED',
});
`);

write(EM + 'domain/entities/DistributionPlan.js', String.raw`
import { PlanStatus } from '../enums/planStatus.js';

// Plan de distribución de una zona: qué recursos se le entregan y qué brigada los lleva.
export class DistributionPlan {
  constructor({
    id, zoneId = null, status, coverage = null, justification = null,
    items = [], brigade = null, createdAt = null,
  }) {
    this.id = id;
    this.zoneId = zoneId;
    this.status = status;
    this.coverage = coverage;           // número (0–1 o 0–100) o texto (FULL, PARTIAL, NONE), según venga del backend
    this.justification = justification; // explicación de la IA
    this.items = items;                 // [{ resourceId, name, unit, recommended, quantity }]
    this.brigade = brigade;             // { id, name } | null
    this.createdAt = createdAt;         // epoch ms | null
    Object.freeze(this);
  }

  get isProposed() { return this.status === PlanStatus.PROPOSED; }
  get isApproved() { return this.status === PlanStatus.APPROVED; }
  get hasBrigade() { return this.brigade !== null; }
  // Aprobado pero sin brigada: faltó una brigada libre con líder al aprobar.
  get needsBrigade() { return this.isApproved && !this.hasBrigade; }
}
`);

write(EM + 'domain/services/pickCurrentPlan.js', String.raw`
import { PlanStatus } from '../enums/planStatus.js';

// De todos los planes de una zona, el que importa ahora: uno propuesto (por decidir),
// luego uno aprobado (por entregar) y, si no hay, el más reciente (rechazado o ejecutado).
export function pickCurrentPlan(plans) {
  if (!plans.length) return null;
  const recentFirst = [...plans].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  return (
    recentFirst.find((plan) => plan.status === PlanStatus.PROPOSED) ??
    recentFirst.find((plan) => plan.status === PlanStatus.APPROVED) ??
    recentFirst[0]
  );
}
`);

write(EM + 'domain/repositories/distributionPlanRepository.js', String.raw`
// Contrato. Backend (Emergency Management):
//   GET  /zones/{zoneId}/distribution-plans            historial de planes de la zona
//   GET  /distribution-plans/{planId}                  plan con cantidades recomendadas y actuales
//   POST /emergencies/{emergencyId}/distribution-plans la IA reparte el inventario entre las zonas priorizadas
//   POST /distribution-plans/{planId}/approve          aprueba (y asigna la brigada más cercana)
//   POST /distribution-plans/{planId}/reject           rechaza, con motivo
//   POST /distribution-plans/{planId}/brigade-assignment  reintenta la asignación de un plan aprobado sin brigada
export class DistributionPlanRepository {
  async findByZone() { throw new Error('DistributionPlanRepository.findByZone no implementado'); }
  async findById() { throw new Error('DistributionPlanRepository.findById no implementado'); }
  async recommend() { throw new Error('DistributionPlanRepository.recommend no implementado'); }
  async approve() { throw new Error('DistributionPlanRepository.approve no implementado'); }
  async reject() { throw new Error('DistributionPlanRepository.reject no implementado'); }
  async assignBrigade() { throw new Error('DistributionPlanRepository.assignBrigade no implementado'); }
}
`);

/* ════════════════════════ APPLICATION ════════════════════════ */
write(EM + 'application/useCases/getZoneDistributionPlan.js', String.raw`
import { pickCurrentPlan } from '../../domain/services/pickCurrentPlan.js';

export class GetZoneDistributionPlan {
  constructor(distributionPlanRepository) {
    this.distributionPlanRepository = distributionPlanRepository;
  }

  // Devuelve el plan vigente de la zona con sus cantidades, o null si la zona no tiene ninguno.
  async execute(zoneId) {
    const plans = await this.distributionPlanRepository.findByZone(zoneId);
    const current = pickCurrentPlan(plans);
    if (!current) return null;
    try {
      return await this.distributionPlanRepository.findById(current.id);
    } catch {
      return current; // el historial ya trae lo esencial; el detalle es un extra
    }
  }
}
`);

write(EM + 'application/useCases/recommendDistribution.js', String.raw`
export class RecommendDistribution {
  constructor(distributionPlanRepository) {
    this.distributionPlanRepository = distributionPlanRepository;
  }

  async execute(emergencyId) {
    if (!emergencyId) throw new Error('emergencyRequired');
    return this.distributionPlanRepository.recommend(emergencyId);
  }
}
`);

write(EM + 'application/useCases/approveDistributionPlan.js', String.raw`
export class ApproveDistributionPlan {
  constructor(distributionPlanRepository) {
    this.distributionPlanRepository = distributionPlanRepository;
  }

  execute(planId) {
    return this.distributionPlanRepository.approve(planId);
  }
}
`);

write(EM + 'application/useCases/rejectDistributionPlan.js', String.raw`
export class RejectDistributionPlan {
  constructor(distributionPlanRepository) {
    this.distributionPlanRepository = distributionPlanRepository;
  }

  async execute({ planId, reason }) {
    const text = (reason ?? '').trim();
    if (!text) throw new Error('reasonRequired');
    return this.distributionPlanRepository.reject(planId, text);
  }
}
`);

write(EM + 'application/useCases/assignBrigadeToPlan.js', String.raw`
export class AssignBrigadeToPlan {
  constructor(distributionPlanRepository) {
    this.distributionPlanRepository = distributionPlanRepository;
  }

  execute(planId) {
    return this.distributionPlanRepository.assignBrigade(planId);
  }
}
`);

/* ════════════════════════ INFRASTRUCTURE ════════════════════════ */
write(EM + 'infrastructure/mappers/distributionPlanMapper.js', String.raw`
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
`);

write(EM + 'infrastructure/http/distributionPlanHttpRepository.js', String.raw`
import { DistributionPlanRepository } from '../../domain/repositories/distributionPlanRepository.js';
import { toDistributionPlan } from '../mappers/distributionPlanMapper.js';
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

export class DistributionPlanHttpRepository extends DistributionPlanRepository {
  async findByZone(zoneId) {
    const { data } = await call(() => httpClient.get('/zones/' + zoneId + '/distribution-plans'));
    return asList(data).map(toDistributionPlan);
  }

  async findById(planId) {
    const { data } = await call(() => httpClient.get('/distribution-plans/' + planId));
    return toDistributionPlan(data);
  }

  // Un solo reparto cubre toda la emergencia: se crea un plan PROPOSED por cada zona que recibe algo.
  async recommend(emergencyId) {
    await call(() => httpClient.post('/emergencies/' + emergencyId + '/distribution-plans'));
  }

  async approve(planId) {
    await call(() => httpClient.post('/distribution-plans/' + planId + '/approve'));
  }

  async reject(planId, reason) {
    await call(() => httpClient.post('/distribution-plans/' + planId + '/reject', { reason }));
  }

  async assignBrigade(planId) {
    await call(() => httpClient.post('/distribution-plans/' + planId + '/brigade-assignment'));
  }
}
`);

write(EM + 'infrastructure/mock/distributionPlanMockRepository.js', String.raw`
import { DistributionPlanRepository } from '../../domain/repositories/distributionPlanRepository.js';
import { toDistributionPlan } from '../mappers/distributionPlanMapper.js';
import { delay } from '@shared/infrastructure/mock/delay.js';
import { zoneDtos } from './fixtures.js';

const problem = (status, detail) => Object.assign(new Error(detail), { status, detail });

const RESOURCES = {
  WATER: { resourceName: 'Agua embotellada', unit: 'bidones', perPerson: 0.1 },
  FOOD: { resourceName: 'Kits de alimentos', unit: 'kits', perPerson: 0.25 },
  SHELTER: { resourceName: 'Carpas familiares', unit: 'unidades', perPerson: 0.2 },
  HYGIENE: { resourceName: 'Kits de higiene', unit: 'kits', perPerson: 0.25 },
  MEDICINE: { resourceName: 'Botiquines', unit: 'unidades', perPerson: 0.15 },
};

const BRIGADES = [{ id: 'br-01', name: 'Brigada Alfa' }, { id: 'br-02', name: 'Brigada Bravo' }];

// Zona sin brigada libre al aprobar (para probar el reintento); el primer reintento falla y el segundo funciona.
const NO_BRIGADE_ZONE = 'zn-05';

export class DistributionPlanMockRepository extends DistributionPlanRepository {
  constructor() {
    super();
    this.plans = new Map();   // planId -> dto
    this.retries = new Map(); // planId -> intentos de asignación
    this.sequence = 0;
  }

  async findByZone(zoneId) {
    await delay(350);
    return [...this.plans.values()].filter((plan) => plan.zoneId === zoneId).reverse().map(toDistributionPlan);
  }

  async findById(planId) {
    await delay(250);
    const plan = this.plans.get(planId);
    if (!plan) throw problem(404, 'Plan no encontrado');
    return toDistributionPlan(plan);
  }

  async recommend() {
    await delay(900);
    if ([...this.plans.values()].some((plan) => plan.status === 'PROPOSED')) {
      throw problem(409, 'Hay planes propuestos sin decidir. Apruébalos o recházalos antes de pedir una nueva recomendación.');
    }
    const candidates = zoneDtos.filter((zone) => zone.score !== null && zone.status !== 'SERVED');
    for (const zone of candidates) {
      const items = zone.needs.filter((need) => RESOURCES[need]).map((need) => {
        const resource = RESOURCES[need];
        const quantity = Math.max(1, Math.round(zone.peopleAffected * resource.perPerson));
        return { resourceId: 'rs-' + need, resourceName: resource.resourceName, unit: resource.unit, recommendedQuantity: quantity, quantity };
      });
      if (!items.length) continue;
      this.sequence += 1;
      const id = 'pl-' + String(this.sequence).padStart(4, '0');
      this.plans.set(id, {
        id, zoneId: zone.id, status: 'PROPOSED',
        coverage: zone.score > 60 ? 'FULL' : 'PARTIAL',
        justification: zone.name + ' tiene score ' + Math.round(zone.score) + ' y ' + zone.peopleAffected +
          ' personas afectadas; se reparte según sus necesidades y el stock disponible.',
        items, brigade: null, createdAt: new Date().toISOString().slice(0, 19),
      });
    }
  }

  async approve(planId) {
    await delay(600);
    const plan = this.plans.get(planId);
    if (!plan) throw problem(404, 'Plan no encontrado');
    if (plan.status !== 'PROPOSED') throw problem(409, 'El plan ya fue decidido.');
    plan.status = 'APPROVED';
    plan.brigade = plan.zoneId === NO_BRIGADE_ZONE ? null : BRIGADES[this.sequence % BRIGADES.length];
  }

  async reject(planId, reason) {
    await delay(450);
    const plan = this.plans.get(planId);
    if (!plan) throw problem(404, 'Plan no encontrado');
    if (!reason) throw problem(400, 'El motivo es obligatorio.');
    plan.status = 'REJECTED';
  }

  async assignBrigade(planId) {
    await delay(600);
    const plan = this.plans.get(planId);
    if (!plan) throw problem(404, 'Plan no encontrado');
    if (plan.brigade) throw problem(409, 'El plan ya tiene una brigada asignada.');
    const attempts = (this.retries.get(planId) ?? 0) + 1;
    this.retries.set(planId, attempts);
    if (attempts === 1) throw problem(422, 'No hay ninguna brigada libre con líder en este momento.');
    plan.brigade = BRIGADES[0];
  }
}
`);

write(EM + 'infrastructure/container.js', String.raw`
import { EmergencyMockRepository } from './mock/emergencyMockRepository.js';
import { ZoneMockRepository } from './mock/zoneMockRepository.js';
import { FieldReportMockRepository } from './mock/fieldReportMockRepository.js';
import { DistributionPlanMockRepository } from './mock/distributionPlanMockRepository.js';
import { EmergencyHttpRepository } from './http/emergencyHttpRepository.js';
import { ZoneHttpRepository } from './http/zoneHttpRepository.js';
import { FieldReportHttpRepository } from './http/fieldReportHttpRepository.js';
import { DistributionPlanHttpRepository } from './http/distributionPlanHttpRepository.js';
import { GetActiveEmergency } from '../application/useCases/getActiveEmergency.js';
import { GetZoneRanking } from '../application/useCases/getZoneRanking.js';
import { GetFieldReportSummary } from '../application/useCases/getFieldReportSummary.js';
import { GetZonePriorityDetail } from '../application/useCases/getZonePriorityDetail.js';
import { OverrideZoneScore } from '../application/useCases/overrideZoneScore.js';
import { RemoveManualPriority } from '../application/useCases/removeManualPriority.js';
import { GetZoneDistributionPlan } from '../application/useCases/getZoneDistributionPlan.js';
import { RecommendDistribution } from '../application/useCases/recommendDistribution.js';
import { ApproveDistributionPlan } from '../application/useCases/approveDistributionPlan.js';
import { RejectDistributionPlan } from '../application/useCases/rejectDistributionPlan.js';
import { AssignBrigadeToPlan } from '../application/useCases/assignBrigadeToPlan.js';
import { env } from '@shared/infrastructure/config/env.js';

const emergencyRepository = env.useMocks ? new EmergencyMockRepository() : new EmergencyHttpRepository();
const zoneRepository = env.useMocks ? new ZoneMockRepository() : new ZoneHttpRepository();
const fieldReportRepository = env.useMocks ? new FieldReportMockRepository() : new FieldReportHttpRepository();
const distributionPlanRepository = env.useMocks ? new DistributionPlanMockRepository() : new DistributionPlanHttpRepository();

export const getActiveEmergencyUseCase = new GetActiveEmergency(emergencyRepository);
export const getZoneRankingUseCase = new GetZoneRanking(zoneRepository);
export const getFieldReportSummaryUseCase = new GetFieldReportSummary(fieldReportRepository);
export const getZonePriorityDetailUseCase = new GetZonePriorityDetail(zoneRepository);
export const overrideZoneScoreUseCase = new OverrideZoneScore(zoneRepository);
export const removeManualPriorityUseCase = new RemoveManualPriority(zoneRepository);
export const getZoneDistributionPlanUseCase = new GetZoneDistributionPlan(distributionPlanRepository);
export const recommendDistributionUseCase = new RecommendDistribution(distributionPlanRepository);
export const approveDistributionPlanUseCase = new ApproveDistributionPlan(distributionPlanRepository);
export const rejectDistributionPlanUseCase = new RejectDistributionPlan(distributionPlanRepository);
export const assignBrigadeToPlanUseCase = new AssignBrigadeToPlan(distributionPlanRepository);
`);

/* ════════════════════════ PRESENTATION: HOOKS ════════════════════════ */
write(EM + 'presentation/hooks/useZoneDistributionPlan.js', String.raw`
import { useQuery } from '@tanstack/react-query';
import { getZoneDistributionPlanUseCase } from '../../infrastructure/container.js';

// Plan vigente de una zona (o null). Cuelga de ['zones'] para refrescarse junto con el ranking.
export function useZoneDistributionPlan(zoneId) {
  return useQuery({
    queryKey: ['zones', 'plan', zoneId],
    queryFn: () => getZoneDistributionPlanUseCase.execute(zoneId),
    enabled: Boolean(zoneId),
  });
}
`);

const mutationHook = (name, useCase, argsDoc, call) => `
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ${useCase} } from '../../infrastructure/container.js';

// ${argsDoc}
export function ${name}() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ${call},
    // Refresca el plan de la zona, el ranking y el tablero.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['zones'] }),
  });
}
`;
write(EM + 'presentation/hooks/useRecommendDistribution.js',
  mutationHook('useRecommendDistribution', 'recommendDistributionUseCase', 'mutate(emergencyId): la IA reparte el inventario entre las zonas.', '(emergencyId) => recommendDistributionUseCase.execute(emergencyId)'));
write(EM + 'presentation/hooks/useApproveDistributionPlan.js',
  mutationHook('useApproveDistributionPlan', 'approveDistributionPlanUseCase', 'mutate(planId): aprueba el plan; el backend asigna la brigada.', '(planId) => approveDistributionPlanUseCase.execute(planId)'));
write(EM + 'presentation/hooks/useRejectDistributionPlan.js',
  mutationHook('useRejectDistributionPlan', 'rejectDistributionPlanUseCase', 'mutate({ planId, reason }): rechaza el plan con un motivo.', '({ planId, reason }) => rejectDistributionPlanUseCase.execute({ planId, reason })'));
write(EM + 'presentation/hooks/useAssignBrigadeToPlan.js',
  mutationHook('useAssignBrigadeToPlan', 'assignBrigadeToPlanUseCase', 'mutate(planId): reintenta la asignación de brigada de un plan aprobado.', '(planId) => assignBrigadeToPlanUseCase.execute(planId)'));

/* ════════════════════════ PRESENTATION: UTILS + COMPONENTS ════════════════════════ */
write(EM + 'presentation/utils/planFormat.js', String.raw`
import { humanize } from '@shared/utils/formatters.js';

// Cobertura: el backend puede mandar un número (0–1 o 0–100) o una etiqueta (FULL, PARTIAL, NONE).
export function coverageLabel(t, coverage) {
  if (coverage === null || coverage === undefined || coverage === '') return null;
  if (typeof coverage === 'number') return Math.round(coverage <= 1 ? coverage * 100 : coverage) + '%';
  return t('plan.coverage.' + String(coverage).toUpperCase(), { defaultValue: humanize(coverage) });
}

export const statusLabel = (t, status) => t('plan.status.' + status, { defaultValue: humanize(status) });

// El backend responde application/problem+json: se muestra su "detail" tal cual; si no hay, un texto según el caso.
export function planErrorMessage(t, error) {
  if (!error) return null;
  if (error.message === 'reasonRequired') return t('plan.reject.reasonRequired');
  if (error.detail) return error.detail;
  if (error.status === 403) return t('plan.errors.forbidden');
  return t('plan.errors.generic');
}
`);

write(EM + 'presentation/components/rejectPlanForm.jsx', String.raw`
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRejectDistributionPlan } from '../hooks/useRejectDistributionPlan.js';
import { planErrorMessage } from '../utils/planFormat.js';

export default function RejectPlanForm({ planId, onDone, onCancel }) {
  const { t } = useTranslation('emergencyManagement');
  const [reason, setReason] = useState('');
  const mutation = useRejectDistributionPlan();

  const handleSubmit = (event) => {
    event.preventDefault();
    mutation.mutate({ planId, reason }, { onSuccess: onDone });
  };

  const message = planErrorMessage(t, mutation.error);

  return (
    <form className="pz-override" onSubmit={handleSubmit} noValidate>
      <h3 className="pz-h3">{t('plan.reject.title')}</h3>
      <p className="pz-note">{t('plan.reject.hint')}</p>
      <label className="pz-field">
        <span>{t('plan.reject.label')}</span>
        <textarea rows="3" value={reason} autoFocus onChange={(e) => setReason(e.target.value)} />
      </label>
      {message && <p className="pz-error" role="alert">{message}</p>}
      <div className="pz-actions">
        <button type="submit" className="pz-btn-lime" disabled={mutation.isPending}>
          {mutation.isPending ? t('plan.reject.saving') : t('plan.reject.confirm')}
        </button>
        <button type="button" className="pz-btn-outline" onClick={onCancel} disabled={mutation.isPending}>
          {t('plan.cancel')}
        </button>
      </div>
    </form>
  );
}
`);

write(EM + 'presentation/components/assignBrigadePanel.jsx', String.raw`
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@shared/utils/formatters.js';
import { useActiveEmergency } from '../hooks/useActiveEmergency.js';
import { useZoneDistributionPlan } from '../hooks/useZoneDistributionPlan.js';
import { useRecommendDistribution } from '../hooks/useRecommendDistribution.js';
import { useApproveDistributionPlan } from '../hooks/useApproveDistributionPlan.js';
import { useAssignBrigadeToPlan } from '../hooks/useAssignBrigadeToPlan.js';
import { coverageLabel, planErrorMessage, statusLabel } from '../utils/planFormat.js';
import RejectPlanForm from './rejectPlanForm.jsx';

// Vista "Asignar brigada" del drawer. El despacho no es un botón suelto: la IA propone un plan de
// distribución, la autoridad lo aprueba y el backend asigna la brigada libre más cercana.
export default function AssignBrigadePanel({ zoneId, zone, onBack }) {
  const { t, i18n } = useTranslation('emergencyManagement');
  const lng = i18n.resolvedLanguage;
  const emergency = useActiveEmergency();
  const planQuery = useZoneDistributionPlan(zoneId);
  const recommend = useRecommendDistribution();
  const approve = useApproveDistributionPlan();
  const assign = useAssignBrigadeToPlan();
  const [rejecting, setRejecting] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [failure, setFailure] = useState(null); // último error de recomendar / aprobar / asignar

  useEffect(() => {
    setRejecting(false);
    setGenerated(false);
    setFailure(null);
  }, [zoneId]);

  const plan = planQuery.data ?? null;
  const hasScore = zone?.urgencyScore !== null && zone?.urgencyScore !== undefined;
  const canGenerate = !plan || plan.status === 'REJECTED' || plan.status === 'EXECUTED';
  const coverage = plan ? coverageLabel(t, plan.coverage) : null;
  const number = (value) => (value === null || value === undefined ? '—' : formatNumber(value, lng));

  // Ejecuta una mutación mostrando solo el error de la última acción.
  const run = (mutation, argument, onSuccess) => {
    setFailure(null);
    mutation.mutate(argument, { onSuccess, onError: setFailure });
  };
  const generate = () => {
    setGenerated(false);
    run(recommend, emergency.data?.id, () => setGenerated(true));
  };

  const error = planErrorMessage(t, failure);
  const busy = recommend.isPending || approve.isPending || assign.isPending;

  return (
    <>
      <button type="button" className="pz-link-btn pz-back" onClick={onBack}>← {t('plan.back')}</button>
      <div>
        <h3 className="pz-h3">{t('plan.title')}</h3>
        <p className="pz-note">{t('plan.intro')}</p>
      </div>

      {planQuery.isLoading && (
        <>
          <span className="pz-skel pz-skel--block" />
          <span className="pz-skel pz-skel--block" />
        </>
      )}

      {planQuery.isError && <p className="pz-error" role="alert">{planQuery.error?.detail ?? t('plan.loadError')}</p>}

      {plan && (
        <section className="pz-box pz-plan">
          <div className="pz-plan__head">
            <span className={'pz-chip pz-chip--' + plan.status.toLowerCase()}>{statusLabel(t, plan.status)}</span>
            {coverage && <span className="pz-note">{t('plan.coverage.label')}: {coverage}</span>}
          </div>

          {plan.items.length > 0 && (
            <table className="pz-items">
              <thead>
                <tr>
                  <th scope="col">{t('plan.items.resource')}</th>
                  <th scope="col">{t('plan.items.recommended')}</th>
                  <th scope="col">{t('plan.items.quantity')}</th>
                </tr>
              </thead>
              <tbody>
                {plan.items.map((item) => (
                  <tr key={item.resourceId ?? item.name}>
                    <td>{item.name}</td>
                    <td>{number(item.recommended)}{item.unit ? ' ' + item.unit : ''}</td>
                    <td><strong>{number(item.quantity)}{item.unit ? ' ' + item.unit : ''}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {plan.justification && (
            <div>
              <span className="pz-label">{t('plan.justification')}</span>
              <p>{plan.justification}</p>
            </div>
          )}
        </section>
      )}

      {plan?.isProposed && !rejecting && (
        <div className="pz-stack">
          <p className="pz-note">{t('plan.approveHint')}</p>
          <div className="pz-actions">
            <button type="button" className="pz-btn-lime" disabled={busy} onClick={() => run(approve, plan.id)}>
              {approve.isPending ? t('plan.approving') : t('plan.approve')}
            </button>
            <button type="button" className="pz-btn-outline" disabled={busy} onClick={() => { setFailure(null); setRejecting(true); }}>
              {t('plan.rejectAction')}
            </button>
          </div>
        </div>
      )}

      {plan?.isProposed && rejecting && (
        <RejectPlanForm planId={plan.id} onDone={() => setRejecting(false)} onCancel={() => setRejecting(false)} />
      )}

      {plan?.needsBrigade && (
        <section className="pz-box pz-box--manual">
          <span className="pz-label">{t('plan.noBrigade.title')}</span>
          <p>{t('plan.noBrigade.text')}</p>
          <button type="button" className="pz-btn-lime pz-stack-gap" disabled={busy} onClick={() => run(assign, plan.id)}>
            {assign.isPending ? t('plan.noBrigade.assigning') : t('plan.noBrigade.retry')}
          </button>
        </section>
      )}

      {plan?.isApproved && plan.hasBrigade && (
        <section className="pz-box pz-box--ok">
          <span className="pz-label">{t('plan.assigned.title')}</span>
          <p className="pz-brigade">{plan.brigade.name ?? t('plan.assigned.unnamed')}</p>
          <p className="pz-note">{t('plan.assigned.text')}</p>
        </section>
      )}

      {plan?.status === 'EXECUTED' && <p className="pz-note">{t('plan.executed')}</p>}
      {plan?.status === 'REJECTED' && <p className="pz-note">{t('plan.rejectedNote')}</p>}

      {canGenerate && !planQuery.isLoading && (
        <div className="pz-stack">
          {!plan && <p>{t('plan.none')}</p>}
          <p className="pz-note">{t('plan.generateHint')}</p>
          {!hasScore && <p className="pz-note">{t('plan.noScore')}</p>}
          {generated && !plan?.isProposed && <p className="pz-note">{t('plan.noneAfter')}</p>}
          <button type="button" className="pz-btn-lime" disabled={busy || !hasScore || !emergency.data?.id} onClick={generate}>
            {recommend.isPending ? t('plan.generating') : t('plan.generate')}
          </button>
        </div>
      )}

      {error && <p className="pz-error" role="alert">{error}</p>}
    </>
  );
}
`);

/* ════════════════════════ PATCHES ════════════════════════ */
patch(EM + 'presentation/components/scoreDrawer.jsx', [
  ["import OverrideScoreForm from './overrideScoreForm.jsx';",
    "import OverrideScoreForm from './overrideScoreForm.jsx';\nimport AssignBrigadePanel from './assignBrigadePanel.jsx';"],
  ['{ zoneId, row, canManage, onClose, onAssign }', '{ zoneId, row, canManage, onClose }'],
  ['  const [overriding, setOverriding] = useState(false);\n',
    "  const [overriding, setOverriding] = useState(false);\n  const [view, setView] = useState('detail'); // 'detail' | 'assign'\n"],
  ['    setOverriding(false);\n  }, [zoneId]);', "    setOverriding(false);\n    setView('detail');\n  }, [zoneId]);"],
  ['<div className="pz-drawer__body">',
    '<div className="pz-drawer__body">\n          {view === \'assign\' ? (\n            <AssignBrigadePanel zoneId={zoneId} zone={zone} onBack={() => setView(\'detail\')} />\n          ) : (\n          <>'],
  ['        </div>\n\n        <footer className="pz-drawer__foot">',
    '          </>\n          )}\n        </div>\n\n        <footer className="pz-drawer__foot" hidden={view === \'assign\'}>'],
  ['onClick={() => onAssign(zoneId)}', "onClick={() => setView('assign')}"],
]);

patch(EM + 'presentation/pages/prioritizationPage.jsx', [
  ["import { useNavigate, useSearchParams } from 'react-router-dom';", "import { useSearchParams } from 'react-router-dom';"],
  ["import { routes } from '@app/router/routes.js';\n", ''],
  ['  const navigate = useNavigate();\n', ''],
  ["          // El despacho se hace con un plan de distribución (pantalla de Logística).\n          onAssign={(zoneId) => navigate(routes.logistics + '?zone=' + zoneId)}\n", ''],
]);

const css = EM + 'presentation/styles/prioritization.css';
const marker = '/* ── Asignar brigada ── */';
if (!readFileSync(css, 'utf8').includes(marker)) {
  writeFileSync(css, readFileSync(css, 'utf8').replace(/\s*$/, '\n') + String.raw`
${marker}
.pz-back { justify-self: start; }
.pz-stack { display: grid; gap: 10px; }
.pz-stack-gap { margin-top: 12px; }
.pz-plan { display: grid; gap: 14px; }
.pz-plan__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.pz-chip { display: inline-flex; align-items: center; min-height: 24px; padding: 0 10px; border-radius: 999px; font-size: 0.75rem; font-weight: 700; background: rgba(255, 255, 255, 0.1); }
.pz-chip--proposed { background: rgba(125, 211, 252, 0.16); color: var(--color-sky); }
.pz-chip--approved, .pz-chip--executed { background: rgba(190, 242, 100, 0.16); color: var(--color-lime); }
.pz-chip--rejected { background: rgba(255, 107, 107, 0.16); color: #ff8a8a; }
.pz-items { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.pz-items th { padding: 0 0 6px; text-align: right; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--night-100); }
.pz-items th:first-child, .pz-items td:first-child { text-align: left; }
.pz-items td { padding: 7px 0; border-top: 1px solid var(--cc-line); text-align: right; font-variant-numeric: tabular-nums; }
.pz-box--ok { border: 1px solid rgba(190, 242, 100, 0.4); background: rgba(190, 242, 100, 0.08); }
.pz-box--ok .pz-label { color: var(--color-lime); }
.pz-brigade { font-size: 1.125rem; font-weight: 700; margin: 2px 0; }
`);
  console.log('~ ' + css);
}

/* ════════════════════════ I18N ════════════════════════ */
mergeJson(EM + 'presentation/i18n/es.json', {
  features: { needs: 'Necesidades reportadas' },
  plan: {
    back: 'Volver al detalle',
    title: 'Plan de distribución',
    intro: 'Qué recursos recibe esta zona y qué brigada los lleva.',
    status: { PROPOSED: 'Propuesto', APPROVED: 'Aprobado', REJECTED: 'Rechazado', EXECUTED: 'Entregado' },
    coverage: { label: 'Cobertura', FULL: 'Total', PARTIAL: 'Parcial', NONE: 'Sin cobertura' },
    items: { resource: 'Recurso', recommended: 'Recomendado', quantity: 'A entregar' },
    justification: 'Justificación de la IA',
    approve: 'Aprobar y asignar brigada',
    approving: 'Aprobando...',
    approveHint: 'Al aprobar, la IA elige la brigada libre más cercana con un líder y se abre la entrega en la App de Campo.',
    rejectAction: 'Rechazar',
    cancel: 'Cancelar',
    reject: {
      title: 'Rechazar plan',
      hint: 'Se libera el inventario reservado. El motivo queda en el historial de la zona.',
      label: 'Motivo',
      confirm: 'Confirmar rechazo',
      saving: 'Rechazando...',
      reasonRequired: 'Escribe el motivo del rechazo.',
    },
    noBrigade: {
      title: 'Aprobado sin brigada',
      text: 'No había una brigada libre con líder al aprobar. Cuando haya una disponible, vuelve a intentarlo.',
      retry: 'Asignar brigada',
      assigning: 'Asignando...',
    },
    assigned: {
      title: 'Brigada asignada',
      unnamed: 'Brigada asignada',
      text: 'La entrega ya está abierta para la App de Campo.',
    },
    executed: 'La entrega de este plan ya fue registrada.',
    rejectedNote: 'El último plan de esta zona fue rechazado.',
    none: 'Esta zona todavía no tiene un plan de distribución.',
    generateHint: 'La IA reparte el inventario de tu organización entre todas las zonas con puntaje y necesidades, así que se crean planes para varias zonas a la vez. Cada plan queda propuesto hasta que lo apruebes o rechaces.',
    noScore: 'Esta zona aún no tiene puntaje: la IA no puede incluirla en el reparto.',
    noneAfter: 'La IA no creó un plan nuevo para esta zona. Es lo esperado si ya está cubierta o no tiene necesidades pendientes; también puede faltar puntaje, necesidades reportadas o inventario. Los planes de otras zonas sí pudieron crearse.',
    generate: 'Generar recomendación con IA',
    generating: 'Generando...',
    loadError: 'No se pudo cargar el plan de la zona.',
    errors: {
      forbidden: 'Solo una autoridad activa puede decidir sobre los planes.',
      generic: 'No se pudo completar la operación. Inténtalo nuevamente.',
    },
  },
});

mergeJson(EM + 'presentation/i18n/en.json', {
  features: { needs: 'Reported needs' },
  plan: {
    back: 'Back to details',
    title: 'Distribution plan',
    intro: 'Which resources this zone receives and which brigade carries them.',
    status: { PROPOSED: 'Proposed', APPROVED: 'Approved', REJECTED: 'Rejected', EXECUTED: 'Delivered' },
    coverage: { label: 'Coverage', FULL: 'Full', PARTIAL: 'Partial', NONE: 'None' },
    items: { resource: 'Resource', recommended: 'Recommended', quantity: 'To deliver' },
    justification: 'AI justification',
    approve: 'Approve and assign brigade',
    approving: 'Approving...',
    approveHint: 'On approval, the AI picks the nearest free brigade with a leader and the delivery opens in the Field App.',
    rejectAction: 'Reject',
    cancel: 'Cancel',
    reject: {
      title: 'Reject plan',
      hint: 'The reserved inventory is released. The reason stays in the zone history.',
      label: 'Reason',
      confirm: 'Confirm rejection',
      saving: 'Rejecting...',
      reasonRequired: 'Write the reason for the rejection.',
    },
    noBrigade: {
      title: 'Approved without a brigade',
      text: 'No free brigade with a leader was available at approval. Try again when one is.',
      retry: 'Assign brigade',
      assigning: 'Assigning...',
    },
    assigned: {
      title: 'Brigade assigned',
      unnamed: 'Brigade assigned',
      text: 'The delivery is now open for the Field App.',
    },
    executed: 'The delivery of this plan has already been registered.',
    rejectedNote: 'The last plan of this zone was rejected.',
    none: 'This zone has no distribution plan yet.',
    generateHint: "The AI splits your organization's inventory among every zone with a score and needs, so plans are created for several zones at once. Each plan stays proposed until you approve or reject it.",
    noScore: 'This zone has no score yet: the AI cannot include it in the split.',
    noneAfter: 'The AI created no new plan for this zone. That is expected if it is already covered or has no pending needs; a score, reported needs or inventory may also be missing. Plans for other zones may have been created.',
    generate: 'Generate AI recommendation',
    generating: 'Generating...',
    loadError: 'Could not load the zone plan.',
    errors: {
      forbidden: 'Only an active authority can decide on plans.',
      generic: 'The operation could not be completed. Please try again.',
    },
  },
});

console.log('\nListo. Reinicia "npm run dev" y abre Priorización IA → una zona → "Asignar brigada".');
