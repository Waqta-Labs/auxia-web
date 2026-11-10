// Dashboard (W_01) con datos mock + acceso de desarrollo (jane.doe / 123456).
// Uso (en la raíz del proyecto): node buildDashboard.mjs
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

const BC = 'src/boundedContexts/';
const EM = BC + 'emergencyManagement/';
const RM = BC + 'resourceManagement/';
const TR = BC + 'traceability/';
const IA = BC + 'identityAccess/';

/* ════════════════════════ SHARED ════════════════════════ */
write('src/shared/infrastructure/mock/delay.js', String.raw`
// Simula la latencia de red de los repositorios mock.
export const delay = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms));
`);

write('src/shared/utils/formatters.js', String.raw`
export const formatNumber = (value, lng) => new Intl.NumberFormat(lng).format(value);

export const formatPercent = (value, lng) =>
  new Intl.NumberFormat(lng, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value) + '%';

export const truncateHash = (hash, head = 6, tail = 4) =>
  hash && hash.length > head + tail ? hash.slice(0, head) + '…' + hash.slice(-tail) : hash;
`);

write('src/shared/presentation/components/kpiCard.jsx', String.raw`
export default function KpiCard({ label, value, hint, tone, loading = false }) {
  return (
    <article className="kpi">
      <h3 className="kpi__label">{label}</h3>
      {loading ? (
        <span className="skeleton" style={{ height: 40, width: '60%' }} />
      ) : (
        <p className={'kpi__value' + (tone ? ' kpi__value--' + tone : '')}>{value ?? '—'}</p>
      )}
      <p className="kpi__hint">
        {loading ? <span className="skeleton" style={{ height: 14, width: '45%' }} /> : hint}
      </p>
    </article>
  );
}
`);

write('src/shared/presentation/components/languageSwitcher.css', String.raw`
.lang-pill { display: inline-flex; align-items: center; gap: 2px; margin-left: auto; padding: 4px 6px 4px 12px; border: 1.5px solid var(--gray-50); border-radius: 999px; color: var(--gray-300); background: var(--color-white); }
.lang-pill__btn { min-width: 36px; min-height: 32px; padding: 0 10px; border: 0; border-radius: 999px; background: transparent; color: inherit; font: inherit; font-size: 0.8125rem; font-weight: var(--fw-bold); cursor: pointer; transition: background 0.2s, color 0.2s; }
.lang-pill__btn:hover { background: var(--royal-50); }
.lang-pill__btn[aria-pressed='true'] { background: var(--color-night); color: var(--color-white); }
.lang-pill__btn:focus-visible { outline: 2px solid var(--color-sky); outline-offset: 1px; }
`);

/* Mueve los estilos del pill a un CSS propio del componente (el login ya no debe cargarlos) */
{
  const sw = 'src/shared/presentation/components/languageSwitcher.jsx';
  if (existsSync(sw)) {
    let s = readFileSync(sw, 'utf8');
    if (!s.includes('languageSwitcher.css')) {
      s = s.replace("import { useTranslation } from 'react-i18next';", "import { useTranslation } from 'react-i18next';\nimport './languageSwitcher.css';");
      writeFileSync(sw, s);
      console.log('~ ' + sw);
    }
  }
  const css = BC + 'identityAccess/presentation/styles/signIn.css';
  if (existsSync(css)) {
    let c = readFileSync(css, 'utf8');
    c = c.replace(/\/\* ── Selector de idioma \(pill\) ── \*\/\n(\.lang-pill[^\n]*\n)+/, '');
    writeFileSync(css, c);
    console.log('~ ' + css);
  }
}

/* ════════════════════════ IDENTITY ACCESS (acceso de desarrollo) ════════════════════════ */
write(IA + 'domain/entities/AuthSession.js', String.raw`
export class AuthSession {
  constructor({ token, expiresAt = null, role, organizationId, displayName = null, organizationName = null }) {
    this.token = token;
    this.expiresAt = expiresAt; // epoch en milisegundos, o null si el backend no lo informa
    this.role = role;
    this.organizationId = organizationId;
    this.displayName = displayName;
    this.organizationName = organizationName;
    Object.freeze(this);
  }

  isExpired(now = Date.now()) {
    return this.expiresAt !== null && now >= this.expiresAt;
  }
}
`);

write(IA + 'infrastructure/http/devAuthRepository.js', String.raw`
import { AuthRepository } from '../../domain/repositories/authRepository.js';
import { AuthSession } from '../../domain/entities/AuthSession.js';
import { Role } from '../../domain/enums/role.js';

// ⚠ ACCESO DE DESARROLLO ("backdoor"): solo se activa con "npm run dev" (import.meta.env.DEV).
// Cualquier otra credencial se delega al repositorio real. Borrar este archivo y su uso en
// container.js cuando el login contra el backend sea el único camino.
const DEV_USER = 'jane.doe';
const DEV_PASSWORD = '123456';
const DEV_SESSION_MS = 8 * 60 * 60 * 1000;

export class DevAuthRepository extends AuthRepository {
  constructor(realRepository) {
    super();
    this.realRepository = realRepository;
  }

  async signIn({ email, password }) {
    if (email.toLowerCase() === DEV_USER && password === DEV_PASSWORD) {
      return new AuthSession({
        token: 'dev-token',
        expiresAt: Date.now() + DEV_SESSION_MS,
        role: Role.AUTHORITY,
        organizationId: 'dev-organization',
        displayName: 'Jane Doe',
        organizationName: 'Defensa Civil',
      });
    }
    return this.realRepository.signIn({ email, password });
  }
}
`);

write(IA + 'infrastructure/container.js', String.raw`
import { AuthHttpRepository } from './http/authHttpRepository.js';
import { DevAuthRepository } from './http/devAuthRepository.js';
import { SignIn } from '../application/useCases/signIn.js';

const httpRepository = new AuthHttpRepository();
// En desarrollo, jane.doe / 123456 entra sin backend.
const authRepository = import.meta.env.DEV ? new DevAuthRepository(httpRepository) : httpRepository;

export const signInUseCase = new SignIn(authRepository);
`);

/* ════════════════════════ EMERGENCY MANAGEMENT ════════════════════════ */
write(EM + 'domain/enums/emergencyStatus.js', String.raw`
export const EmergencyStatus = Object.freeze({ ACTIVE: 'ACTIVE', CLOSED: 'CLOSED' });
`);

write(EM + 'domain/enums/needCategory.js', String.raw`
export const NeedCategory = Object.freeze({
  MEDICAL: 'MEDICAL',
  RESCUE: 'RESCUE',
  FOOD: 'FOOD',
  WATER: 'WATER',
  SHELTER: 'SHELTER',
});
`);

write(EM + 'domain/entities/Emergency.js', String.raw`
import { EmergencyStatus } from '../enums/emergencyStatus.js';

export class Emergency {
  constructor({ id, name, type, status, district = null, startedAt = null }) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.status = status;
    this.district = district;
    this.startedAt = startedAt; // epoch ms
    Object.freeze(this);
  }

  get isActive() {
    return this.status === EmergencyStatus.ACTIVE;
  }
}
`);

write(EM + 'domain/entities/Zone.js', String.raw`
// Umbrales del Urgency Score (0-100). El tablero marca "crítico" por encima de 85.
export const CRITICAL_SCORE = 85;
export const HIGH_SCORE = 60;
export const MODERATE_SCORE = 40;

export class Zone {
  constructor({
    id, emergencyId, name, latitude = null, longitude = null,
    urgencyScore = null, needs = [], reasons = [], manualPriority = false,
  }) {
    this.id = id;
    this.emergencyId = emergencyId;
    this.name = name;
    this.latitude = latitude;
    this.longitude = longitude;
    this.urgencyScore = urgencyScore; // null: la zona aún no tiene puntaje
    this.needs = needs;               // NeedCategory[]
    this.reasons = reasons;           // [{ key, value }] derivadas de topFeatures
    this.manualPriority = manualPriority;
    Object.freeze(this);
  }

  get isCritical() {
    return this.urgencyScore !== null && this.urgencyScore > CRITICAL_SCORE;
  }

  get hasPosition() {
    return this.latitude !== null && this.longitude !== null;
  }

  get level() {
    if (this.urgencyScore === null) return 'unscored';
    if (this.urgencyScore > CRITICAL_SCORE) return 'critical';
    if (this.urgencyScore >= HIGH_SCORE) return 'high';
    if (this.urgencyScore >= MODERATE_SCORE) return 'moderate';
    return 'low';
  }
}
`);

write(EM + 'domain/entities/FieldReportSummary.js', String.raw`
export class FieldReportSummary {
  constructor({ total, relayed }) {
    this.total = total;     // reportes de campo activos
    this.relayed = relayed; // los que llegaron retransmitidos por Mesh (sin conexión)
    Object.freeze(this);
  }

  get relayedShare() {
    return this.total > 0 ? this.relayed / this.total : 0;
  }
}
`);

write(EM + 'domain/repositories/emergencyRepository.js', String.raw`
// Contrato. Backend: GET /api/v1/emergencies (activas, la más reciente primero).
export class EmergencyRepository {
  async findActive() {
    throw new Error('EmergencyRepository.findActive no implementado');
  }
}
`);

write(EM + 'domain/repositories/zoneRepository.js', String.raw`
// Contrato. Backend: GET /api/v1/emergencies/{emergencyId}/zones (ranking de urgencia, US-06).
export class ZoneRepository {
  // eslint-disable-next-line no-unused-vars
  async findRanking(emergencyId) {
    throw new Error('ZoneRepository.findRanking no implementado');
  }
}
`);

write(EM + 'domain/repositories/fieldReportRepository.js', String.raw`
// Contrato. Backend: GET /api/v1/emergencies/{emergencyId}/field-reports
// (el total y la parte retransmitida por Mesh se derivan del listado).
export class FieldReportRepository {
  // eslint-disable-next-line no-unused-vars
  async summarize(emergencyId) {
    throw new Error('FieldReportRepository.summarize no implementado');
  }
}
`);

write(EM + 'application/useCases/getActiveEmergency.js', String.raw`
export class GetActiveEmergency {
  constructor(emergencyRepository) {
    this.emergencyRepository = emergencyRepository;
  }

  // La emergencia en curso es la activa más reciente; null si no hay ninguna.
  async execute() {
    const active = await this.emergencyRepository.findActive();
    return active[0] ?? null;
  }
}
`);

write(EM + 'application/useCases/getZoneRanking.js', String.raw`
export class GetZoneRanking {
  constructor(zoneRepository) {
    this.zoneRepository = zoneRepository;
  }

  // Prioridad manual primero, luego mayor Urgency Score; sin puntaje al final.
  async execute(emergencyId) {
    const zones = await this.zoneRepository.findRanking(emergencyId);
    return [...zones].sort((a, b) => {
      if (a.manualPriority !== b.manualPriority) return a.manualPriority ? -1 : 1;
      return (b.urgencyScore ?? -1) - (a.urgencyScore ?? -1);
    });
  }
}
`);

write(EM + 'application/useCases/getFieldReportSummary.js', String.raw`
export class GetFieldReportSummary {
  constructor(fieldReportRepository) {
    this.fieldReportRepository = fieldReportRepository;
  }

  execute(emergencyId) {
    return this.fieldReportRepository.summarize(emergencyId);
  }
}
`);

write(EM + 'infrastructure/mappers/emergencyMapper.js', String.raw`
import { Emergency } from '../../domain/entities/Emergency.js';
import { Zone } from '../../domain/entities/Zone.js';
import { FieldReportSummary } from '../../domain/entities/FieldReportSummary.js';

// Único lugar a ajustar cuando se conecte el backend real: DTO -> entidad.

export function toEmergency(dto) {
  return new Emergency({
    id: dto.id,
    name: dto.name,
    type: dto.type,
    status: dto.status,
    district: dto.district ?? null,
    startedAt: dto.startDate ? new Date(dto.startDate).getTime() : null,
  });
}

export function toZone(dto) {
  return new Zone({
    id: dto.id,
    emergencyId: dto.emergencyId,
    name: dto.name,
    latitude: dto.latitude ?? null,
    longitude: dto.longitude ?? null,
    urgencyScore: dto.urgencyScore ?? null,
    needs: dto.needs ?? [],
    // topFeatures del AI Service: cada variable que sumó puntos -> motivo legible en la UI.
    reasons: (dto.topFeatures ?? []).map((f) => ({ key: f.feature, value: f.value })),
    manualPriority: Boolean(dto.manualPriority),
  });
}

export function toFieldReportSummary(reports) {
  return new FieldReportSummary({
    total: reports.length,
    relayed: reports.filter((r) => r.relay && r.relay.hops > 0).length,
  });
}
`);

write(EM + 'infrastructure/mock/fixtures.js', String.raw`
// Datos de prueba con la forma (aproximada) de las respuestas del backend.
// Cuando se conecte la API real se reemplaza este archivo por repositorios HTTP.

export const emergencyDtos = [
  {
    id: 'em-0001',
    name: 'Inundación Sector Norte',
    type: 'FLOOD',
    status: 'ACTIVE',
    district: 'Lurigancho-Chosica',
    startDate: '2026-11-08T06:30:00Z',
  },
];

const z = (id, name, latitude, longitude, urgencyScore, needs, topFeatures, manualPriority = false) => ({
  id, emergencyId: 'em-0001', name, latitude, longitude, urgencyScore, needs, topFeatures, manualPriority,
});

export const zoneDtos = [
  z('zn-01', 'Sector Santa Rosa', -11.9367, -76.7012, 94, ['MEDICAL', 'WATER'], [
    { feature: 'children', value: 3 }, { feature: 'noSignal', value: 4 }, { feature: 'accessCut', value: true },
  ]),
  z('zn-02', 'Villa Esperanza', -11.9455, -76.6838, 91, ['RESCUE'], [
    { feature: 'elderly', value: 1 }, { feature: 'isolatedZone', value: true }, { feature: 'noAid', value: 2 },
  ]),
  z('zn-03', 'Quebrada Carossio', -11.929, -76.689, 88, ['FOOD', 'SHELTER'], [
    { feature: 'families', value: 42 }, { feature: 'waterShortage', value: true }, { feature: 'accessCut', value: true },
  ]),
  z('zn-04', 'Las Terrazas', -11.95, -76.708, 72, ['MEDICAL'], [
    { feature: 'injured', value: 4 }, { feature: 'noSignal', value: 2 },
  ]),
  z('zn-05', 'Huaycán Bajo', -11.955, -76.69, 67, ['WATER'], [
    { feature: 'children', value: 6 }, { feature: 'noAid', value: 6 },
  ]),
  z('zn-06', 'Cerro Candela', -11.921, -76.705, 54, ['FOOD'], [{ feature: 'families', value: 15 }]),
  z('zn-07', 'Pedregal Alto', -11.94, -76.67, 41, ['WATER'], [{ feature: 'waterShortage', value: true }]),
  z('zn-08', 'Los Cedros', -11.926, -76.674, null, ['SHELTER'], []),
];

// Reportes de campo: la parte retransmitida por Mesh trae "relay.hops".
export const fieldReportDtos = Array.from({ length: 1248 }, (_, i) => ({
  id: 'fr-' + i,
  relay: i % 20 < 17 ? { hops: 1 + (i % 3) } : null,
}));
`);

write(EM + 'infrastructure/mock/emergencyMockRepository.js', String.raw`
import { EmergencyRepository } from '../../domain/repositories/emergencyRepository.js';
import { toEmergency } from '../mappers/emergencyMapper.js';
import { delay } from '@shared/infrastructure/mock/delay.js';
import { emergencyDtos } from './fixtures.js';

export class EmergencyMockRepository extends EmergencyRepository {
  async findActive() {
    await delay();
    return emergencyDtos.map(toEmergency);
  }
}
`);

write(EM + 'infrastructure/mock/zoneMockRepository.js', String.raw`
import { ZoneRepository } from '../../domain/repositories/zoneRepository.js';
import { toZone } from '../mappers/emergencyMapper.js';
import { delay } from '@shared/infrastructure/mock/delay.js';
import { zoneDtos } from './fixtures.js';

export class ZoneMockRepository extends ZoneRepository {
  async findRanking(emergencyId) {
    await delay(500);
    return zoneDtos.filter((dto) => dto.emergencyId === emergencyId).map(toZone);
  }
}
`);

write(EM + 'infrastructure/mock/fieldReportMockRepository.js', String.raw`
import { FieldReportRepository } from '../../domain/repositories/fieldReportRepository.js';
import { toFieldReportSummary } from '../mappers/emergencyMapper.js';
import { delay } from '@shared/infrastructure/mock/delay.js';
import { fieldReportDtos } from './fixtures.js';

export class FieldReportMockRepository extends FieldReportRepository {
  // eslint-disable-next-line no-unused-vars
  async summarize(emergencyId) {
    await delay(450);
    return toFieldReportSummary(fieldReportDtos);
  }
}
`);

write(EM + 'infrastructure/container.js', String.raw`
import { EmergencyMockRepository } from './mock/emergencyMockRepository.js';
import { ZoneMockRepository } from './mock/zoneMockRepository.js';
import { FieldReportMockRepository } from './mock/fieldReportMockRepository.js';
import { GetActiveEmergency } from '../application/useCases/getActiveEmergency.js';
import { GetZoneRanking } from '../application/useCases/getZoneRanking.js';
import { GetFieldReportSummary } from '../application/useCases/getFieldReportSummary.js';

// Composición. Para usar el backend real, cambiar los repositorios mock por sus versiones HTTP.
const emergencyRepository = new EmergencyMockRepository();
const zoneRepository = new ZoneMockRepository();
const fieldReportRepository = new FieldReportMockRepository();

export const getActiveEmergencyUseCase = new GetActiveEmergency(emergencyRepository);
export const getZoneRankingUseCase = new GetZoneRanking(zoneRepository);
export const getFieldReportSummaryUseCase = new GetFieldReportSummary(fieldReportRepository);
`);

write(EM + 'presentation/hooks/useActiveEmergency.js', String.raw`
import { useQuery } from '@tanstack/react-query';
import { getActiveEmergencyUseCase } from '../../infrastructure/container.js';

export function useActiveEmergency() {
  return useQuery({
    queryKey: ['emergency', 'active'],
    queryFn: () => getActiveEmergencyUseCase.execute(),
  });
}
`);

write(EM + 'presentation/hooks/useZoneRanking.js', String.raw`
import { useQuery } from '@tanstack/react-query';
import { getZoneRankingUseCase } from '../../infrastructure/container.js';

export function useZoneRanking(emergencyId) {
  return useQuery({
    queryKey: ['zones', 'ranking', emergencyId],
    queryFn: () => getZoneRankingUseCase.execute(emergencyId),
    enabled: Boolean(emergencyId),
  });
}
`);

write(EM + 'presentation/hooks/useFieldReportSummary.js', String.raw`
import { useQuery } from '@tanstack/react-query';
import { getFieldReportSummaryUseCase } from '../../infrastructure/container.js';

export function useFieldReportSummary(emergencyId) {
  return useQuery({
    queryKey: ['fieldReports', 'summary', emergencyId],
    queryFn: () => getFieldReportSummaryUseCase.execute(emergencyId),
    enabled: Boolean(emergencyId),
  });
}
`);

write(EM + 'presentation/components/urgencyHeatMap.jsx', String.raw`
import { useMemo, useState } from 'react';
import { MapContainer, TileLayer, Circle, CircleMarker, Pane, Tooltip } from 'react-leaflet';
import { useTranslation } from 'react-i18next';
import 'leaflet/dist/leaflet.css';

const LEVEL_COLORS = {
  critical: '#ff4d4d',
  high: '#ffb020',
  moderate: '#85d5f6',
  low: '#4750dd',
  unscored: '#989b96',
};
const DEFAULT_CENTER = [-11.94, -76.69];
const heatRadius = (zone) => 140 + (zone.urgencyScore ?? 30) * 3.5; // metros

export default function UrgencyHeatMap({ zones = [], brigades = [], loading = false }) {
  const { t } = useTranslation('emergencyManagement');
  const [layers, setLayers] = useState({ zones: true, coverage: true, brigades: true });
  const toggle = (key) => setLayers((current) => ({ ...current, [key]: !current[key] }));

  const placedZones = useMemo(() => zones.filter((z) => z.hasPosition), [zones]);
  const placedBrigades = useMemo(() => brigades.filter((b) => b.hasPosition), [brigades]);

  const center = useMemo(() => {
    if (placedZones.length === 0) return DEFAULT_CENTER;
    const lat = placedZones.reduce((sum, z) => sum + z.latitude, 0) / placedZones.length;
    const lng = placedZones.reduce((sum, z) => sum + z.longitude, 0) / placedZones.length;
    return [lat, lng];
  }, [placedZones]);

  const chips = [
    { key: 'zones', color: 'var(--color-coral)', label: t('map.layers.zones') },
    { key: 'coverage', color: 'var(--color-emerald)', label: t('map.layers.coverage') },
    { key: 'brigades', color: 'var(--color-lime)', label: t('map.layers.brigades') },
  ];

  return (
    <section className="panel map-panel" aria-label={t('map.title')}>
      {loading ? (
        <div className="skeleton heatmap" />
      ) : (
        <MapContainer className="heatmap" center={center} zoom={14} scrollWheelZoom={false}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution="&copy; OpenStreetMap contributors &copy; CARTO"
          />

          {layers.coverage &&
            placedBrigades.filter((b) => !b.isOffDuty).map((b) => (
              <Circle
                key={b.id + '-cover'}
                center={[b.latitude, b.longitude]}
                radius={450}
                pathOptions={{ color: '#05c274', weight: 1, dashArray: '4 6', fillColor: '#05c274', fillOpacity: 0.06 }}
              />
            ))}

          {layers.zones && (
            <Pane name="heat" style={{ zIndex: 410, filter: 'blur(14px)' }}>
              {placedZones.map((z) => (
                <Circle
                  key={z.id + '-heat'}
                  center={[z.latitude, z.longitude]}
                  radius={heatRadius(z)}
                  pathOptions={{ stroke: false, fillColor: LEVEL_COLORS[z.level], fillOpacity: 0.6 }}
                />
              ))}
            </Pane>
          )}

          {layers.zones && (
            <Pane name="zonePoints" style={{ zIndex: 450 }}>
              {placedZones.map((z) => (
                <CircleMarker
                  key={z.id + '-point'}
                  center={[z.latitude, z.longitude]}
                  radius={z.isCritical ? 7 : 5}
                  pathOptions={{ color: '#ffffff', weight: 1.5, fillColor: LEVEL_COLORS[z.level], fillOpacity: 1 }}
                >
                  <Tooltip>{z.name + ' · ' + (z.urgencyScore ?? '—')}</Tooltip>
                </CircleMarker>
              ))}
            </Pane>
          )}

          {layers.brigades && (
            <Pane name="brigadePoints" style={{ zIndex: 460 }}>
              {placedBrigades.map((b) => (
                <CircleMarker
                  key={b.id + '-gps'}
                  center={[b.latitude, b.longitude]}
                  radius={5}
                  pathOptions={{
                    color: '#10103a',
                    weight: 1.5,
                    fillColor: b.isAvailable ? '#bcfb89' : b.isDeployed ? '#85d5f6' : '#989b96',
                    fillOpacity: 1,
                  }}
                >
                  <Tooltip>{b.name}</Tooltip>
                </CircleMarker>
              ))}
            </Pane>
          )}
        </MapContainer>
      )}

      <div className="map-chips" role="group" aria-label={t('map.title')}>
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            className="chip"
            aria-pressed={layers[chip.key]}
            onClick={() => toggle(chip.key)}
          >
            <i className="chip__dot" style={{ background: chip.color }} />
            {chip.label}
          </button>
        ))}
      </div>
      <p className="map-caption">{t('map.caption')}</p>
    </section>
  );
}
`);

write(EM + 'presentation/components/priorityList.jsx', String.raw`
import { useTranslation } from 'react-i18next';

function reasonText(t, reason) {
  const options = { value: reason.value, defaultValue: reason.key };
  if (typeof reason.value === 'number') options.count = reason.value;
  return t('reasons.' + reason.key, options);
}

export default function PriorityList({ zones = [], loading = false, onAssign }) {
  const { t } = useTranslation('emergencyManagement');

  return (
    <section className="panel prio-panel">
      <header className="panel__head">
        <h2 className="panel__title">{t('priority.title')}</h2>
        <span className="panel__note">{t('priority.subtitle')}</span>
      </header>

      <div className="prio">
        {loading && [0, 1, 2].map((i) => (
          <div key={i} className="skeleton" style={{ height: 170, borderRadius: 12 }} />
        ))}

        {!loading && zones.length === 0 && <p className="muted">{t('priority.empty')}</p>}

        {!loading && zones.map((zone) => (
          <article key={zone.id} className="prio-card">
            <header className="prio-card__head">
              <span className={'score score--' + zone.level}>{zone.urgencyScore ?? '—'}</span>
              <h3 className="prio-card__name">{zone.name}</h3>
              {zone.needs[0] && (
                <span className="tag">{t('needs.' + zone.needs[0], { defaultValue: zone.needs[0] })}</span>
              )}
            </header>
            <div className="prio-why">
              <span className="prio-why__label">{t('priority.why')}</span>
              <p>{zone.reasons.length > 0 ? zone.reasons.map((r) => reasonText(t, r)).join(', ') : '—'}</p>
            </div>
            <button type="button" className="btn-lime" onClick={() => onAssign?.(zone)}>
              {t('priority.assign')}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
`);

mergeJson(EM + 'presentation/i18n/es.json', {
  map: {
    title: 'Mapa de calor de auxilio',
    layers: { zones: 'Zonas afectadas', coverage: 'Cobertura', brigades: 'Brigadas GPS' },
    caption: 'Mapa de calor de auxilio · intensidad creciente →',
  },
  priority: {
    title: 'Priorización IA',
    subtitle: 'Orden por Urgency Score',
    why: 'Por qué está priorizada',
    assign: 'Asignar brigada',
    empty: 'Aún no hay zonas con puntaje de urgencia.',
  },
  needs: { MEDICAL: 'Médico', RESCUE: 'Rescate', FOOD: 'Alimentos', WATER: 'Agua', SHELTER: 'Refugio' },
  reasons: {
    children_one: '{{count}} niño', children_other: '{{count}} niños',
    elderly_one: '{{count}} adulto mayor', elderly_other: '{{count}} adultos mayores',
    injured_one: '{{count}} herido', injured_other: '{{count}} heridos',
    families_one: '{{count}} familia afectada', families_other: '{{count}} familias afectadas',
    noSignal: 'sin señal {{value}} h',
    noAid: '{{value}} h sin atención',
    accessCut: 'acceso cortado',
    isolatedZone: 'zona aislada',
    waterShortage: 'sin agua potable',
  },
});
mergeJson(EM + 'presentation/i18n/en.json', {
  map: {
    title: 'Aid heat map',
    layers: { zones: 'Affected zones', coverage: 'Coverage', brigades: 'Brigades GPS' },
    caption: 'Aid heat map · increasing intensity →',
  },
  priority: {
    title: 'AI Prioritization',
    subtitle: 'Sorted by Urgency Score',
    why: 'Why it is prioritized',
    assign: 'Assign brigade',
    empty: 'No zones with an urgency score yet.',
  },
  needs: { MEDICAL: 'Medical', RESCUE: 'Rescue', FOOD: 'Food', WATER: 'Water', SHELTER: 'Shelter' },
  reasons: {
    children_one: '{{count}} child', children_other: '{{count}} children',
    elderly_one: '{{count}} elderly person', elderly_other: '{{count}} elderly people',
    injured_one: '{{count}} injured person', injured_other: '{{count}} injured people',
    families_one: '{{count}} family affected', families_other: '{{count}} families affected',
    noSignal: 'no signal for {{value}} h',
    noAid: '{{value}} h without aid',
    accessCut: 'access cut off',
    isolatedZone: 'isolated zone',
    waterShortage: 'no drinking water',
  },
});

/* ════════════════════════ RESOURCE MANAGEMENT ════════════════════════ */
write(RM + 'domain/enums/brigadeStatus.js', String.raw`
export const BrigadeStatus = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  ASSIGNED: 'ASSIGNED',
  OFF_DUTY: 'OFF_DUTY',
});
`);

write(RM + 'domain/entities/Brigade.js', String.raw`
import { BrigadeStatus } from '../enums/brigadeStatus.js';

export class Brigade {
  constructor({ id, name, code = null, status, latitude = null, longitude = null }) {
    this.id = id;
    this.name = name;
    this.code = code;
    this.status = status;
    this.latitude = latitude; // base / última posición GPS
    this.longitude = longitude;
    Object.freeze(this);
  }

  get isDeployed() { return this.status === BrigadeStatus.ASSIGNED; }
  get isAvailable() { return this.status === BrigadeStatus.AVAILABLE; }
  get isOffDuty() { return this.status === BrigadeStatus.OFF_DUTY; }
  get hasPosition() { return this.latitude !== null && this.longitude !== null; }
}
`);

write(RM + 'domain/repositories/brigadeRepository.js', String.raw`
// Contrato. Backend: GET /api/v1/brigades (de la organización del usuario; filtro opcional ?status=).
export class BrigadeRepository {
  async findAll() {
    throw new Error('BrigadeRepository.findAll no implementado');
  }
}
`);

write(RM + 'application/useCases/getBrigadeOverview.js', String.raw`
export class GetBrigadeOverview {
  constructor(brigadeRepository) {
    this.brigadeRepository = brigadeRepository;
  }

  async execute() {
    const brigades = await this.brigadeRepository.findAll();
    return {
      brigades,
      total: brigades.length,
      deployed: brigades.filter((b) => b.isDeployed).length,
      available: brigades.filter((b) => b.isAvailable).length,
    };
  }
}
`);

write(RM + 'infrastructure/mappers/brigadeMapper.js', String.raw`
import { Brigade } from '../../domain/entities/Brigade.js';

export function toBrigade(dto) {
  return new Brigade({
    id: dto.id,
    name: dto.name,
    code: dto.code ?? null,
    status: dto.status,
    latitude: dto.baseLocation?.latitude ?? null,
    longitude: dto.baseLocation?.longitude ?? null,
  });
}
`);

write(RM + 'infrastructure/mock/brigadeMockRepository.js', String.raw`
import { BrigadeRepository } from '../../domain/repositories/brigadeRepository.js';
import { toBrigade } from '../mappers/brigadeMapper.js';
import { delay } from '@shared/infrastructure/mock/delay.js';

const NAMES = [
  'Alfa', 'Bravo', 'Charlie', 'Delta', 'Eco', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliett', 'Kilo', 'Lima',
  'Mike', 'November', 'Oscar', 'Papa', 'Quebec', 'Romeo', 'Sierra', 'Tango', 'Uniform', 'Victor', 'Whiskey', 'Xray',
];

// 24 brigadas: 18 desplegadas, 6 disponibles, repartidas alrededor de Chosica.
const dtos = NAMES.map((name, i) => ({
  id: 'br-' + String(i + 1).padStart(2, '0'),
  name: 'Brigada ' + name,
  code: 'BRG-' + name.slice(0, 4).toUpperCase() + '-' + String(i + 1).padStart(2, '0'),
  status: i < 18 ? 'ASSIGNED' : 'AVAILABLE',
  baseLocation: {
    latitude: -11.94 + Math.sin(i * 2.4) * 0.024,
    longitude: -76.69 + Math.cos(i * 1.7) * 0.026,
  },
}));

export class BrigadeMockRepository extends BrigadeRepository {
  async findAll() {
    await delay(400);
    return dtos.map(toBrigade);
  }
}
`);

write(RM + 'infrastructure/container.js', String.raw`
import { BrigadeMockRepository } from './mock/brigadeMockRepository.js';
import { GetBrigadeOverview } from '../application/useCases/getBrigadeOverview.js';

const brigadeRepository = new BrigadeMockRepository();

export const getBrigadeOverviewUseCase = new GetBrigadeOverview(brigadeRepository);
`);

write(RM + 'presentation/hooks/useBrigadeOverview.js', String.raw`
import { useQuery } from '@tanstack/react-query';
import { getBrigadeOverviewUseCase } from '../../infrastructure/container.js';

export function useBrigadeOverview() {
  return useQuery({
    queryKey: ['brigades', 'overview'],
    queryFn: () => getBrigadeOverviewUseCase.execute(),
  });
}
`);

/* ════════════════════════ TRACEABILITY ════════════════════════ */
write(TR + 'domain/enums/deliveryStatus.js', String.raw`
// INITIATED: brigada en camino · REGISTERED: entregada, anclando · CERTIFIED: validada en blockchain
// FAILED: el anclaje falló y se reintenta cada 5 min.
export const DeliveryStatus = Object.freeze({
  INITIATED: 'INITIATED',
  REGISTERED: 'REGISTERED',
  CERTIFIED: 'CERTIFIED',
  FAILED: 'FAILED',
});
`);

write(TR + 'domain/entities/Delivery.js', String.raw`
export const EXPLORER_TX_URL = 'https://sepolia.etherscan.io/tx/';

export class Delivery {
  constructor({ id, status, transactionHash = null, originName = null, destinationName = null }) {
    this.id = id;
    this.status = status;
    this.transactionHash = transactionHash;
    this.originName = originName;
    this.destinationName = destinationName;
    Object.freeze(this);
  }

  get explorerUrl() {
    return this.transactionHash ? EXPLORER_TX_URL + this.transactionHash : null;
  }
}
`);

write(TR + 'domain/entities/VerificationStats.js', String.raw`
export class VerificationStats {
  constructor({ verified, total }) {
    this.verified = verified; // entregas validadas en blockchain
    this.total = total;       // entregas registradas
    Object.freeze(this);
  }

  // Porcentaje (0-100) con un decimal; null si aún no hay entregas.
  get percentage() {
    return this.total > 0 ? Math.round((this.verified / this.total) * 1000) / 10 : null;
  }
}
`);

write(TR + 'domain/repositories/deliveryRepository.js', String.raw`
// Contrato. Backend: GET /api/v1/deliveries?zoneId= (por zona). El tablero necesita las entregas
// más recientes de toda la emergencia y un conteo de verificadas: se compondrá en el backend
// o sumando las entregas de cada zona.
export class DeliveryRepository {
  // eslint-disable-next-line no-unused-vars
  async findRecent({ limit }) {
    throw new Error('DeliveryRepository.findRecent no implementado');
  }

  async getVerificationStats() {
    throw new Error('DeliveryRepository.getVerificationStats no implementado');
  }
}
`);

write(TR + 'application/useCases/getRecentDeliveries.js', String.raw`
export class GetRecentDeliveries {
  constructor(deliveryRepository) {
    this.deliveryRepository = deliveryRepository;
  }

  execute({ limit = 5 } = {}) {
    return this.deliveryRepository.findRecent({ limit });
  }
}
`);

write(TR + 'application/useCases/getVerificationStats.js', String.raw`
export class GetVerificationStats {
  constructor(deliveryRepository) {
    this.deliveryRepository = deliveryRepository;
  }

  execute() {
    return this.deliveryRepository.getVerificationStats();
  }
}
`);

write(TR + 'infrastructure/mappers/deliveryMapper.js', String.raw`
import { Delivery } from '../../domain/entities/Delivery.js';
import { VerificationStats } from '../../domain/entities/VerificationStats.js';
import { DeliveryStatus } from '../../domain/enums/deliveryStatus.js';

export function toDelivery(dto) {
  return new Delivery({
    id: dto.id,
    // El backend informa el estado de la entrega y, aparte, el del anclaje (PENDING / FAILED).
    status: dto.anchoringStatus === 'FAILED' ? DeliveryStatus.FAILED : dto.status,
    transactionHash: dto.transactionHash ?? null,
    originName: dto.originName ?? null,
    destinationName: dto.destinationName ?? null,
  });
}

export function toVerificationStats(dto) {
  return new VerificationStats({ verified: dto.verified, total: dto.total });
}
`);

write(TR + 'infrastructure/mock/deliveryMockRepository.js', String.raw`
import { DeliveryRepository } from '../../domain/repositories/deliveryRepository.js';
import { toDelivery, toVerificationStats } from '../mappers/deliveryMapper.js';
import { delay } from '@shared/infrastructure/mock/delay.js';

const fakeHash = (head, tail) => '0x' + head + '0'.repeat(64 - head.length - tail.length) + tail;

const deliveryDtos = [
  {
    id: 'dl-0001', status: 'CERTIFIED', transactionHash: fakeHash('7f3a', 'c91e'),
    originName: 'Almacén Central', destinationName: 'Brigada Alfa · Santa Rosa',
  },
  {
    id: 'dl-0002', status: 'INITIATED', transactionHash: fakeHash('2b9d', 'a47f'),
    originName: 'Centro de Acopio Norte', destinationName: 'Brigada Bravo · Villa Esperanza',
  },
  {
    id: 'dl-0003', status: 'CERTIFIED', transactionHash: fakeHash('91c4', '03de'),
    originName: 'Almacén Central', destinationName: 'Albergue Municipal',
  },
  {
    id: 'dl-0004', status: 'REGISTERED', transactionHash: fakeHash('c07e', '5b12'),
    originName: 'Almacén Central', destinationName: 'Brigada Delta · Quebrada Carossio',
  },
];

export class DeliveryMockRepository extends DeliveryRepository {
  async findRecent({ limit }) {
    await delay(500);
    return deliveryDtos.slice(0, limit).map(toDelivery);
  }

  async getVerificationStats() {
    await delay(450);
    return toVerificationStats({ verified: 492, total: 500 }); // 98.4 %
  }
}
`);

write(TR + 'infrastructure/container.js', String.raw`
import { DeliveryMockRepository } from './mock/deliveryMockRepository.js';
import { GetRecentDeliveries } from '../application/useCases/getRecentDeliveries.js';
import { GetVerificationStats } from '../application/useCases/getVerificationStats.js';

const deliveryRepository = new DeliveryMockRepository();

export const getRecentDeliveriesUseCase = new GetRecentDeliveries(deliveryRepository);
export const getVerificationStatsUseCase = new GetVerificationStats(deliveryRepository);
`);

write(TR + 'presentation/hooks/useRecentDeliveries.js', String.raw`
import { useQuery } from '@tanstack/react-query';
import { getRecentDeliveriesUseCase } from '../../infrastructure/container.js';

export function useRecentDeliveries({ limit = 5 } = {}) {
  return useQuery({
    queryKey: ['deliveries', 'recent', limit],
    queryFn: () => getRecentDeliveriesUseCase.execute({ limit }),
  });
}
`);

write(TR + 'presentation/hooks/useVerificationStats.js', String.raw`
import { useQuery } from '@tanstack/react-query';
import { getVerificationStatsUseCase } from '../../infrastructure/container.js';

export function useVerificationStats() {
  return useQuery({
    queryKey: ['deliveries', 'verificationStats'],
    queryFn: () => getVerificationStatsUseCase.execute(),
  });
}
`);

write(TR + 'presentation/components/deliveriesTable.jsx', String.raw`
import { useTranslation } from 'react-i18next';
import { truncateHash } from '@shared/utils/formatters.js';

export default function DeliveriesTable({ deliveries = [], loading = false }) {
  const { t } = useTranslation('traceability');

  return (
    <section className="panel">
      <header className="panel__head">
        <h2 className="panel__title">{t('ledger.title')}</h2>
        <span className="panel__note">{t('ledger.subtitle')}</span>
      </header>

      <div className="ledger-wrap">
        <table className="ledger">
          <thead>
            <tr>
              <th scope="col">{t('ledger.columns.hash')}</th>
              <th scope="col">{t('ledger.columns.origin')}</th>
              <th scope="col">{t('ledger.columns.destination')}</th>
              <th scope="col">{t('ledger.columns.status')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && [0, 1, 2].map((i) => (
              <tr key={i}>
                <td colSpan={4}><span className="skeleton" style={{ height: 20 }} /></td>
              </tr>
            ))}

            {!loading && deliveries.length === 0 && (
              <tr><td colSpan={4} className="muted">{t('ledger.empty')}</td></tr>
            )}

            {!loading && deliveries.map((d) => (
              <tr key={d.id}>
                <td>
                  {d.explorerUrl ? (
                    <a className="ledger__hash" href={d.explorerUrl} target="_blank" rel="noreferrer" title={d.transactionHash}>
                      {truncateHash(d.transactionHash)}
                    </a>
                  ) : '—'}
                </td>
                <td>{d.originName ?? '—'}</td>
                <td>{d.destinationName ?? '—'}</td>
                <td>
                  <span className={'status status--' + d.status}>{t('ledger.status.' + d.status)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
`);

mergeJson(TR + 'presentation/i18n/es.json', {
  ledger: {
    title: 'Trazabilidad Blockchain e Inventario',
    subtitle: 'Registros inmutables',
    columns: { hash: 'Hash de transacción', origin: 'Origen', destination: 'Destino', status: 'Estado' },
    status: { INITIATED: 'En camino', REGISTERED: 'Anclando', CERTIFIED: 'Validado', FAILED: 'Reintentando' },
    empty: 'Todavía no hay entregas registradas.',
  },
});
mergeJson(TR + 'presentation/i18n/en.json', {
  ledger: {
    title: 'Blockchain Traceability and Inventory',
    subtitle: 'Immutable records',
    columns: { hash: 'Transaction hash', origin: 'Origin', destination: 'Destination', status: 'Status' },
    status: { INITIATED: 'On the way', REGISTERED: 'Anchoring', CERTIFIED: 'Validated', FAILED: 'Retrying' },
    empty: 'No deliveries registered yet.',
  },
});

/* ════════════════════════ APP: LAYOUT + DASHBOARD ════════════════════════ */
write('src/app/layouts/commandCenter/commandCenterLayout.jsx', String.raw`
import { Outlet } from 'react-router-dom';
import Sidebar from './sidebar.jsx';
import Topbar from './topbar.jsx';
import './commandCenter.css';

export default function CommandCenterLayout() {
  return (
    <div className="cc">
      <Sidebar />
      <div className="cc__main">
        <Topbar />
        <main className="cc__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
`);

write('src/app/layouts/commandCenter/sidebar.jsx', String.raw`
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@bc/identityAccess/presentation/hooks/useAuth.js';
import { useActiveEmergency } from '@bc/emergencyManagement/presentation/hooks/useActiveEmergency.js';
import { routes, routeRoles } from '@app/router/routes.js';
import logo from '@assets/logos/12.svg';

const navItems = [
  { to: routes.dashboard, key: 'dashboard', end: true },
  { to: routes.gisMap, key: 'gisMap', roles: routeRoles.gisMap },
  { to: routes.prioritization, key: 'prioritization', roles: routeRoles.prioritization },
  { to: routes.inventory, key: 'inventory', roles: routeRoles.inventory },
  { to: routes.logistics, key: 'logistics', roles: routeRoles.logistics },
  { to: routes.audit, key: 'audit', roles: routeRoles.audit },
];

const icons = {
  dashboard: (<><rect x="3" y="3" width="7" height="9" rx="2" /><rect x="14" y="3" width="7" height="5" rx="2" /><rect x="14" y="12" width="7" height="9" rx="2" /><rect x="3" y="16" width="7" height="5" rx="2" /></>),
  gisMap: (<><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></>),
  prioritization: (<path d="M5 20V11M12 20V4M19 20v-6" />),
  inventory: (<><path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v10l9 4 9-4V7M12 11v10" /></>),
  logistics: (<><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17.5" cy="9.5" r="2.4" /><path d="M17 14.2c2.5.2 4.5 2.2 4.5 4.8" /></>),
  audit: (<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>),
};

const initials = (name) =>
  (name ?? '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

export default function Sidebar() {
  const { t } = useTranslation();
  const { session, signOut } = useAuth();
  const emergency = useActiveEmergency();
  const visibleItems = navItems.filter((item) => !item.roles || item.roles.includes(session.role));
  const userName = session.displayName ?? t('roles.' + session.role);

  return (
    <aside className="cc-side">
      <div className="cc-side__logo">
        <img src={logo} alt={t('appName')} />
      </div>

      <div className="cc-crisis">
        <span className="cc-crisis__label">{t('sidebar.activeCrisis')}</span>
        {emergency.isPending ? (
          <span className="skeleton" style={{ height: 18, width: '80%' }} />
        ) : emergency.data ? (
          <>
            <strong className="cc-crisis__name">{emergency.data.name}</strong>
            <span className="cc-live">{t('sidebar.live')}</span>
          </>
        ) : (
          <strong className="cc-crisis__name">{t('sidebar.noCrisis')}</strong>
        )}
      </div>

      <nav className="cc-nav" aria-label={t('sidebar.navLabel')}>
        {visibleItems.map((item) => (
          <NavLink key={item.key} to={item.to} end={item.end}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {icons[item.key]}
            </svg>
            {t('nav.' + item.key)}
          </NavLink>
        ))}
      </nav>

      <div className="cc-user">
        <span className="cc-user__avatar" aria-hidden="true">{initials(userName)}</span>
        <div className="cc-user__info">
          <strong>{userName}</strong>
          <span>{session.organizationName ?? t('roles.' + session.role)}</span>
        </div>
        <button type="button" className="cc-user__out" onClick={signOut} aria-label={t('actions.signOut')} title={t('actions.signOut')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M16 8l4 4-4 4M20 12H9" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
`);

write('src/app/layouts/commandCenter/topbar.jsx', String.raw`
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@shared/presentation/components/languageSwitcher.jsx';

export default function Topbar() {
  const { t } = useTranslation();

  return (
    <header className="cc-top">
      <label className="cc-search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
          strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <input type="search" placeholder={t('topbar.searchPlaceholder')} aria-label={t('topbar.searchPlaceholder')} />
      </label>

      <span className="cc-top__spacer" />
      <span className="cc-realtime">{t('topbar.realtime')}</span>
      <LanguageSwitcher variant="pill" />
      {/* Pendiente: conectar con el protocolo de alarma general del backend. */}
      <button type="button" className="cc-alarm">{t('topbar.generalAlarm')}</button>
    </header>
  );
}
`);

write('src/app/layouts/commandCenter/commandCenter.css', String.raw`
.cc {
  --cc-bg: #10103a;
  --cc-sidebar: #0b0b2e;
  --cc-card: var(--color-night);
  --cc-card-inner: #15154d;
  --cc-line: rgba(255, 255, 255, 0.08);
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  min-height: 100vh;
  background: var(--cc-bg);
  color: #f4f5ff;
}
.cc .muted { color: var(--night-100); }
.cc a { color: var(--color-sky); }
.cc__main { display: flex; flex-direction: column; min-width: 0; }
.cc__content { flex: 1; padding: var(--space-3) var(--space-4) var(--space-5); }

/* Sidebar */
.cc-side {
  position: sticky; top: 0; height: 100vh;
  display: flex; flex-direction: column; gap: var(--space-3);
  padding: var(--space-4) var(--space-3);
  background: var(--cc-sidebar);
  border-right: 1px solid var(--cc-line);
}
.cc-side__logo { display: flex; justify-content: center; padding-bottom: var(--space-2); }
.cc-side__logo img { height: 96px; width: auto; }

.cc-crisis { display: grid; gap: 4px; padding: 12px 16px; border-radius: 12px; background: var(--cc-card); }
.cc-crisis__label { font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-sky); }
.cc-crisis__name { font-weight: 700; }
.cc-live { display: inline-flex; align-items: center; gap: 6px; font-size: 0.75rem; font-weight: 700; color: var(--color-coral); }
.cc-live::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: currentColor; animation: cc-blink 1.4s ease-in-out infinite; }

.cc-nav { display: flex; flex-direction: column; gap: 4px; flex: 1; overflow-y: auto; }
.cc-nav a {
  display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 0 12px;
  border-radius: 10px; color: var(--night-100); text-decoration: none; font-weight: 500;
  transition: background 0.2s, color 0.2s;
}
.cc-nav a:hover { background: rgba(255, 255, 255, 0.05); color: #fff; }
.cc-nav a.active { background: var(--cc-card); color: #fff; box-shadow: inset 3px 0 0 var(--color-royal); }
.cc-nav a.active svg { color: var(--color-sky); }
.cc-nav a:focus-visible, .cc-user__out:focus-visible, .cc-alarm:focus-visible { outline: 2px solid var(--color-sky); outline-offset: 2px; }

.cc-user { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 12px; background: var(--cc-card); }
.cc-user__avatar { display: grid; place-items: center; flex: none; width: 36px; height: 36px; border-radius: 50%; background: var(--color-royal); font-size: 0.8125rem; font-weight: 700; }
.cc-user__info { display: grid; min-width: 0; flex: 1; font-size: 0.8125rem; }
.cc-user__info strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cc-user__info span { color: var(--night-100); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cc-user__out { display: grid; place-items: center; width: 36px; height: 36px; border: 0; border-radius: 8px; background: transparent; color: var(--night-100); cursor: pointer; }
.cc-user__out:hover { background: rgba(255, 255, 255, 0.08); color: #fff; }

/* Topbar */
.cc-top { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--cc-line); }
.cc-top__spacer { flex: 1; }
.cc-search { display: flex; align-items: center; gap: 10px; flex: 1; max-width: 520px; height: 44px; padding: 0 16px; border-radius: 10px; background: var(--cc-card); color: var(--night-100); }
.cc-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: #fff; font: inherit; }
.cc-search input::placeholder { color: var(--night-100); }
.cc-search:focus-within { box-shadow: 0 0 0 2px var(--color-royal); }
.cc-realtime { display: inline-flex; align-items: center; gap: 8px; color: var(--color-emerald); font-size: 0.875rem; font-weight: 500; white-space: nowrap; }
.cc-realtime::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: currentColor; box-shadow: 0 0 8px currentColor; animation: cc-blink 2s ease-in-out infinite; }
.cc-alarm { height: 44px; padding: 0 24px; border: 0; border-radius: 10px; background: var(--color-coral); color: #fff; font: inherit; font-weight: 700; cursor: pointer; transition: filter 0.2s; }
.cc-alarm:hover { filter: brightness(1.08); }

.cc .lang-pill { margin-left: 0; background: var(--cc-card); border-color: var(--cc-line); color: var(--night-100); }
.cc .lang-pill__btn:hover { background: rgba(255, 255, 255, 0.08); }
.cc .lang-pill__btn[aria-pressed='true'] { background: var(--color-royal); color: #fff; }

@keyframes cc-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
@keyframes cc-shimmer { to { background-position: -200% 0; } }

@media (max-width: 860px) {
  .cc { grid-template-columns: 1fr; }
  .cc-side { position: static; height: auto; border-right: 0; border-bottom: 1px solid var(--cc-line); }
  .cc-side__logo img { height: 64px; }
  .cc-nav { flex-direction: row; overflow-x: auto; flex: none; }
  .cc-nav a { white-space: nowrap; }
  .cc-top { flex-wrap: wrap; }
  .cc-search { max-width: none; order: 3; flex-basis: 100%; }
  .cc-top__spacer { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .cc *, .cc *::before { animation: none !important; transition: none !important; }
}
`);

write('src/app/pages/dashboard/dashboardPage.jsx', String.raw`
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import KpiCard from '@shared/presentation/components/kpiCard.jsx';
import { formatNumber, formatPercent } from '@shared/utils/formatters.js';
import { routes } from '@app/router/routes.js';
import { CRITICAL_SCORE } from '@bc/emergencyManagement/domain/entities/Zone.js';
import { useActiveEmergency } from '@bc/emergencyManagement/presentation/hooks/useActiveEmergency.js';
import { useZoneRanking } from '@bc/emergencyManagement/presentation/hooks/useZoneRanking.js';
import { useFieldReportSummary } from '@bc/emergencyManagement/presentation/hooks/useFieldReportSummary.js';
import { useBrigadeOverview } from '@bc/resourceManagement/presentation/hooks/useBrigadeOverview.js';
import { useRecentDeliveries } from '@bc/traceability/presentation/hooks/useRecentDeliveries.js';
import { useVerificationStats } from '@bc/traceability/presentation/hooks/useVerificationStats.js';
import UrgencyHeatMap from '@bc/emergencyManagement/presentation/components/urgencyHeatMap.jsx';
import PriorityList from '@bc/emergencyManagement/presentation/components/priorityList.jsx';
import DeliveriesTable from '@bc/traceability/presentation/components/deliveriesTable.jsx';
import './dashboard.css';

const TOP_PRIORITIES = 3;
const RECENT_DELIVERIES = 3;

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const lng = i18n.resolvedLanguage;
  const navigate = useNavigate();

  const emergency = useActiveEmergency();
  const emergencyId = emergency.data?.id;
  const ranking = useZoneRanking(emergencyId);
  const reports = useFieldReportSummary(emergencyId);
  const brigades = useBrigadeOverview();
  const deliveries = useRecentDeliveries({ limit: RECENT_DELIVERIES });
  const verification = useVerificationStats();

  const zones = ranking.data ?? [];
  const criticalCount = zones.filter((z) => z.isCritical).length;
  const verifiedPct = verification.data?.percentage;

  // La asignación de brigada pasa por un plan de distribución (recomendar -> aprobar): por ahora
  // se envía a la bandeja de priorización con la zona elegida.
  const handleAssign = (zone) => navigate(routes.prioritization + '?zone=' + zone.id);

  return (
    <div className="db">
      <section className="db-kpis" aria-label={t('dashboard.title')}>
        <KpiCard
          label={t('dashboard.kpi.activeRequests')}
          loading={reports.isPending}
          value={reports.data ? formatNumber(reports.data.total, lng) : null}
          hint={reports.data && t('dashboard.kpi.offlineShare', { percent: Math.round(reports.data.relayedShare * 100) })}
        />
        <KpiCard
          tone="lime"
          label={t('dashboard.kpi.criticalCases')}
          loading={ranking.isPending}
          value={ranking.data ? criticalCount : null}
          hint={t('dashboard.kpi.criticalHint', { threshold: CRITICAL_SCORE })}
        />
        <KpiCard
          label={t('dashboard.kpi.deployedBrigades')}
          loading={brigades.isPending}
          value={brigades.data ? brigades.data.deployed + '/' + brigades.data.total : null}
          hint={brigades.data && t('dashboard.kpi.availableBrigades', { count: brigades.data.available })}
        />
        <KpiCard
          label={t('dashboard.kpi.verifiedSupplies')}
          loading={verification.isPending}
          value={verifiedPct != null ? formatPercent(verifiedPct, lng) : null}
          hint={t('dashboard.kpi.verifiedHint')}
        />
      </section>

      <div className="db-grid">
        <UrgencyHeatMap zones={zones} brigades={brigades.data?.brigades} loading={ranking.isPending || brigades.isPending} />
        <PriorityList zones={zones.slice(0, TOP_PRIORITIES)} loading={ranking.isPending} onAssign={handleAssign} />
      </div>

      <DeliveriesTable deliveries={deliveries.data} loading={deliveries.isPending} />
    </div>
  );
}
`);

write('src/app/pages/dashboard/dashboard.css', String.raw`
.db { display: grid; gap: var(--space-3); }

/* KPIs */
.db-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-3); }
.kpi { display: grid; gap: 6px; padding: 20px; border: 1px solid var(--cc-line); border-radius: 16px; background: var(--cc-card); }
.kpi__label { margin: 0; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-sky); }
.kpi__value { margin: 0; font-size: 2.25rem; font-weight: 700; line-height: 1.1; letter-spacing: -0.02em; }
.kpi__value--lime { color: var(--color-lime); }
.kpi__hint { margin: 0; min-height: 20px; font-size: 0.8125rem; color: var(--night-100); }

.skeleton {
  display: block; border-radius: 8px;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.06));
  background-size: 200% 100%;
  animation: cc-shimmer 1.4s linear infinite;
}

/* Paneles */
.db-grid { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(320px, 1fr); gap: var(--space-3); }
.panel { padding: 20px; border: 1px solid var(--cc-line); border-radius: 16px; background: var(--cc-card); }
.panel__head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.panel__title { margin: 0; font-size: 1.125rem; font-weight: 700; }
.panel__note { font-size: 0.8125rem; color: var(--night-100); }

/* Mapa */
.map-panel { position: relative; min-height: 440px; padding: 0; overflow: hidden; background: #0b0b2e; }
.heatmap { position: absolute; inset: 0; }
.map-panel .leaflet-container { background: #0b0b2e; font: inherit; }
.map-panel .leaflet-tooltip { background: var(--cc-sidebar); color: #fff; border: 1px solid var(--cc-line); box-shadow: none; }
.map-panel .leaflet-control-attribution { background: rgba(11, 11, 46, 0.7); color: var(--night-100); }
.map-panel .leaflet-control-attribution a { color: var(--color-sky); }
.map-chips { position: absolute; top: 16px; left: 16px; z-index: 1000; display: flex; flex-wrap: wrap; gap: 8px; }
.chip {
  display: inline-flex; align-items: center; gap: 8px; height: 32px; padding: 0 12px;
  border: 1px solid var(--cc-line); border-radius: 999px;
  background: rgba(16, 16, 58, 0.88); color: #fff; font: inherit; font-size: 0.8125rem; font-weight: 500;
  cursor: pointer; backdrop-filter: blur(6px); transition: opacity 0.2s;
}
.chip[aria-pressed='false'] { opacity: 0.45; }
.chip:focus-visible { outline: 2px solid var(--color-sky); outline-offset: 2px; }
.chip__dot { width: 8px; height: 8px; border-radius: 50%; }
.map-caption { position: absolute; left: 16px; bottom: 12px; z-index: 1000; margin: 0; padding: 2px 8px; border-radius: 6px; background: rgba(11, 11, 46, 0.7); font-size: 0.75rem; color: var(--night-100); pointer-events: none; }

/* Priorización */
.prio { display: grid; gap: 12px; }
.prio-card { display: grid; gap: 12px; padding: 16px; border-radius: 12px; background: var(--cc-card-inner); }
.prio-card__head { display: flex; align-items: center; gap: 12px; }
.prio-card__name { flex: 1; margin: 0; font-size: 1rem; font-weight: 700; }
.score { display: inline-grid; place-items: center; min-width: 36px; height: 24px; padding: 0 10px; border-radius: 999px; font-size: 0.8125rem; font-weight: 700; color: var(--night-600); background: var(--color-lime); }
.score--high { background: #ffb020; }
.score--moderate { background: var(--color-sky); }
.score--low, .score--unscored { background: var(--gray-100); }
.tag { padding: 3px 10px; border-radius: 999px; background: rgba(133, 213, 246, 0.16); color: var(--color-sky); font-size: 0.75rem; font-weight: 500; }
.prio-why { padding: 10px 12px; border-radius: 10px; background: rgba(0, 0, 0, 0.28); }
.prio-why__label { display: block; margin-bottom: 4px; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-sky); }
.prio-why p { margin: 0; font-size: 0.875rem; }
.btn-lime { height: 44px; border: 0; border-radius: 10px; background: var(--color-lime); color: var(--night-600); font: inherit; font-weight: 700; cursor: pointer; transition: filter 0.2s, transform 0.2s; }
.btn-lime:hover { filter: brightness(1.06); transform: translateY(-1px); }
.btn-lime:focus-visible { outline: 3px solid var(--color-sky); outline-offset: 2px; }

/* Tabla de trazabilidad */
.ledger-wrap { overflow-x: auto; }
.ledger { width: 100%; border-collapse: collapse; }
.ledger th { padding: 12px 16px; text-align: left; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-sky); background: rgba(0, 0, 0, 0.25); }
.ledger th:first-child { border-radius: 10px 0 0 10px; }
.ledger th:last-child { border-radius: 0 10px 10px 0; }
.ledger td { padding: 14px 16px; border-bottom: 1px solid var(--cc-line); font-size: 0.9375rem; }
.ledger tr:last-child td { border-bottom: 0; }
.ledger__hash { color: #fff !important; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; text-decoration: none; }
.ledger__hash:hover { text-decoration: underline; }
.status { display: inline-block; padding: 3px 12px; border-radius: 999px; font-size: 0.75rem; font-weight: 500; }
.status--CERTIFIED { background: rgba(5, 194, 116, 0.18); color: var(--color-emerald); }
.status--INITIATED { background: rgba(71, 80, 221, 0.4); color: var(--color-sky); }
.status--REGISTERED { background: rgba(133, 213, 246, 0.16); color: var(--color-sky); }
.status--FAILED { background: rgba(255, 77, 77, 0.16); color: var(--color-coral); }

@media (max-width: 1180px) {
  .db-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .db-grid { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .db-kpis { grid-template-columns: 1fr; }
  .cc__content { padding: var(--space-3); }
}
`);

/* ════════════════════════ i18n comunes ════════════════════════ */
mergeJson('src/i18n/locales/es/common.json', {
  nav: { dashboard: 'Dashboard', gisMap: 'Mapa GIS', prioritization: 'Priorización IA', inventory: 'Inventario', logistics: 'Brigadas', audit: 'Trazabilidad Blockchain' },
  sidebar: { activeCrisis: 'Crisis activa', live: 'En vivo', noCrisis: 'Sin crisis activa', navLabel: 'Navegación principal' },
  topbar: { searchPlaceholder: 'Buscar GPS, ID de reporte, brigada', realtime: 'Modo Tiempo Real Activo', generalAlarm: 'Alarma General' },
  roles: { ORGANIZATION_ADMIN: 'Administrador de organización', AUTHORITY: 'Autoridad', FIELD_BRIGADE: 'Brigada de campo', AUDITOR: 'Auditor' },
  dashboard: {
    title: 'Centro de Mando',
    kpi: {
      activeRequests: 'Solicitudes activas',
      offlineShare: '{{percent}}% reportadas offline',
      criticalCases: 'Casos críticos',
      criticalHint: 'Score IA > {{threshold}}',
      deployedBrigades: 'Brigadas desplegadas',
      availableBrigades_one: '{{count}} disponible',
      availableBrigades_other: '{{count}} disponibles',
      verifiedSupplies: 'Suministros verificados',
      verifiedHint: 'Validados en Blockchain',
    },
  },
});
mergeJson('src/i18n/locales/en/common.json', {
  nav: { dashboard: 'Dashboard', gisMap: 'GIS Map', prioritization: 'AI Prioritization', inventory: 'Inventory', logistics: 'Brigades', audit: 'Blockchain Traceability' },
  sidebar: { activeCrisis: 'Active crisis', live: 'Live', noCrisis: 'No active crisis', navLabel: 'Main navigation' },
  topbar: { searchPlaceholder: 'Search GPS, report ID, brigade', realtime: 'Real-Time Mode Active', generalAlarm: 'General Alarm' },
  roles: { ORGANIZATION_ADMIN: 'Organization administrator', AUTHORITY: 'Authority', FIELD_BRIGADE: 'Field brigade', AUDITOR: 'Auditor' },
  dashboard: {
    title: 'Command Center',
    kpi: {
      activeRequests: 'Active requests',
      offlineShare: '{{percent}}% reported offline',
      criticalCases: 'Critical cases',
      criticalHint: 'AI score > {{threshold}}',
      deployedBrigades: 'Deployed brigades',
      availableBrigades_one: '{{count}} available',
      availableBrigades_other: '{{count}} available',
      verifiedSupplies: 'Verified supplies',
      verifiedHint: 'Validated on Blockchain',
    },
  },
});

/* ════════════════════════ Logo del sidebar (12.svg): sin fondo y recortado ════════════════════════ */
{
  const file = 'src/assets/logos/12.svg';
  if (existsSync(file)) {
    let svg = readFileSync(file, 'utf8');
    svg = svg.replace(/<rect x="-150"[^>]*\/>/g, '');
    svg = svg.replace(/<svg([^>]*?)>/, (m, attrs) => {
      const clean = attrs.replace(/\s(width|height|viewBox)="[^"]*"/g, '').replace(/\s+/g, ' ');
      return '<svg' + clean + ' width="775" height="535" viewBox="290 425 775 535">';
    });
    writeFileSync(file, svg);
    console.log('~ ' + file);
  } else {
    console.log('! Falta src/assets/logos/12.svg (logo del sidebar)');
  }
}

console.log('\nListo. Reinicia "npm run dev" y entra con jane.doe / 123456.');
