// Trazabilidad Blockchain (W_06): ledger de entregas, ficha de trazabilidad, verificación e informe PDF.
// Uso (en la raíz del proyecto): node buildTraceability.mjs
// Reescribe en traceability: Delivery, deliveryRepository, deliveryHttpRepository, deliveryMockRepository,
// container y auditLedgerPage. Agrega estilos propios (auditLedger.css) e i18n es/en (mezcla).
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

const TR = 'src/boundedContexts/traceability/';
const SHARED = 'src/shared/';

if (!existsSync(TR + 'domain/entities/Delivery.js') || !existsSync('src/boundedContexts/emergencyManagement/presentation/hooks/useZoneRanking.js')) {
  throw new Error('Corre este script en la raíz del proyecto, después de buildPrioritization.mjs.');
}

/* ════════════════════════ SHARED ════════════════════════ */
write(SHARED + 'presentation/utils/saveBlob.js', String.raw`
// Descarga un archivo generado en memoria (por ejemplo, un PDF que devolvió el backend).
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
`);

/* ════════════════════════ DOMAIN ════════════════════════ */
write(TR + 'domain/entities/Delivery.js', String.raw`
export const EXPLORER_TX_URL = 'https://sepolia.etherscan.io/tx/';

export class Delivery {
  constructor({ id, zoneId, zoneName = null, status, transactionHash = null, deliveredAt = null }) {
    this.id = id;
    this.zoneId = zoneId;
    this.zoneName = zoneName;
    this.status = status;                   // INITIATED | REGISTERED | CERTIFIED | FAILED
    this.transactionHash = transactionHash; // null hasta que se envía el anclaje
    this.deliveredAt = deliveredAt;         // epoch ms; null mientras la brigada va en camino
    Object.freeze(this);
  }

  get explorerUrl() {
    return this.transactionHash ? EXPLORER_TX_URL + this.transactionHash : null;
  }

  withZoneName(zoneName) {
    return new Delivery({ ...this, zoneName });
  }
}
`);

write(TR + 'domain/entities/DeliveryDetail.js', String.raw`
import { EXPLORER_TX_URL } from './Delivery.js';

// Una entrega con sus recursos, evidencias (por hash) y estado del anclaje (GET /deliveries/{id}).
// items = [{ name, planned, quantity, unit }] · evidences = [{ hash, type }]
export class DeliveryDetail {
  constructor({
    id, zoneId, zoneName = null, status, deliveredAt = null, openedAt = null,
    recordHash = null, transactionHash = null, anchoredAt = null, items = [], evidences = [],
  }) {
    this.id = id;
    this.zoneId = zoneId;
    this.zoneName = zoneName;
    this.status = status;
    this.deliveredAt = deliveredAt;       // epoch ms
    this.openedAt = openedAt;             // epoch ms; cuándo se abrió la misión, si el backend lo informa
    this.recordHash = recordHash;         // SHA-256 del registro canónico de la entrega
    this.transactionHash = transactionHash;
    this.anchoredAt = anchoredAt;         // epoch ms
    this.items = items;
    this.evidences = evidences;
    Object.freeze(this);
  }

  get explorerUrl() {
    return this.transactionHash ? EXPLORER_TX_URL + this.transactionHash : null;
  }
}
`);

write(TR + 'domain/entities/VerificationResult.js', String.raw`
// Resultado de GET /deliveries/{id}/verify: ¿el hash de hoy coincide con el de la blockchain?
export class VerificationResult {
  constructor({ verified, recordHash = null, chainHash = null }) {
    this.verified = verified;
    this.recordHash = recordHash; // recalculado ahora
    this.chainHash = chainHash;   // el que está en la blockchain
    Object.freeze(this);
  }
}
`);

write(TR + 'domain/repositories/deliveryRepository.js', String.raw`
// Contrato. Backend (Traceability):
//   GET /deliveries?zoneId=                      entregas de una zona, la más reciente primero
//   GET /deliveries/{id}                         entrega con recursos, evidencias (por hash) y anclaje
//   GET /deliveries/{id}/verify                  público: compara el hash actual con el de la blockchain
//   GET /deliveries/report?zoneId=&from=&to=     PDF de auditoría (parámetros opcionales)
export class DeliveryRepository {
  async findByZone() { throw new Error('DeliveryRepository.findByZone no implementado'); }
  async findById() { throw new Error('DeliveryRepository.findById no implementado'); }
  async verify() { throw new Error('DeliveryRepository.verify no implementado'); }
  async downloadReport() { throw new Error('DeliveryRepository.downloadReport no implementado'); }
}
`);

write(TR + 'domain/services/filterDeliveries.js', String.raw`
import { DeliveryStatus } from '../enums/deliveryStatus.js';

export const DeliveryTab = Object.freeze({
  ALL: 'all', IN_TRANSIT: 'inTransit', ANCHORING: 'anchoring', VERIFIED: 'verified', RETRYING: 'retrying',
});
export const Period = Object.freeze({ WEEK: '7d', MONTH: '30d', ALL: 'all' });
export const PERIOD_DAYS = { [Period.WEEK]: 7, [Period.MONTH]: 30 };

const STATUS_OF_TAB = {
  [DeliveryTab.IN_TRANSIT]: DeliveryStatus.INITIATED,
  [DeliveryTab.ANCHORING]: DeliveryStatus.REGISTERED,
  [DeliveryTab.VERIFIED]: DeliveryStatus.CERTIFIED,
  [DeliveryTab.RETRYING]: DeliveryStatus.FAILED,
};

const normalize = (value) =>
  String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function countByTab(deliveries) {
  const count = (tab) => deliveries.filter((d) => d.status === STATUS_OF_TAB[tab]).length;
  return {
    [DeliveryTab.ALL]: deliveries.length,
    [DeliveryTab.IN_TRANSIT]: count(DeliveryTab.IN_TRANSIT),
    [DeliveryTab.ANCHORING]: count(DeliveryTab.ANCHORING),
    [DeliveryTab.VERIFIED]: count(DeliveryTab.VERIFIED),
    [DeliveryTab.RETRYING]: count(DeliveryTab.RETRYING),
  };
}

// Pestaña de estado + período + búsqueda (código público, hash de transacción o zona). Las entregas
// que van en camino no tienen fecha de entrega: siempre entran en el período.
export function filterDeliveries(deliveries, { tab = DeliveryTab.ALL, search = '', period = Period.ALL, now = Date.now() } = {}) {
  const query = normalize(search.trim());
  const days = PERIOD_DAYS[period];
  const since = days ? now - days * 86400000 : null;
  return deliveries.filter((delivery) => {
    if (tab !== DeliveryTab.ALL && delivery.status !== STATUS_OF_TAB[tab]) return false;
    if (since !== null && delivery.deliveredAt !== null && delivery.deliveredAt < since) return false;
    if (!query) return true;
    return [delivery.id, delivery.transactionHash, delivery.zoneName].some((value) => normalize(value).includes(query));
  });
}

// Fecha (AAAA-MM-DD) de hace N días, para el parámetro "from" del informe.
export function periodStart(period, now = Date.now()) {
  const days = PERIOD_DAYS[period];
  return days ? new Date(now - days * 86400000).toISOString().slice(0, 10) : null;
}
`);

/* ════════════════════════ APPLICATION ════════════════════════ */
write(TR + 'application/useCases/getDeliveryLedger.js', String.raw`
export class GetDeliveryLedger {
  constructor(deliveryRepository) {
    this.deliveryRepository = deliveryRepository;
  }

  // El backend entrega por zona: se juntan todas las de la emergencia. Primero las que van en camino
  // (sin fecha) y luego de la más reciente a la más antigua. Una zona que falla no tumba el ledger.
  async execute({ zones }) {
    const perZone = await Promise.all(
      zones.map(async (zone) => {
        try {
          const deliveries = await this.deliveryRepository.findByZone(zone.id);
          return deliveries.map((delivery) => delivery.withZoneName(zone.name));
        } catch {
          return [];
        }
      }),
    );
    return perZone.flat().sort((a, b) => (b.deliveredAt ?? Infinity) - (a.deliveredAt ?? Infinity));
  }
}
`);

write(TR + 'application/useCases/getDeliveryDetail.js', String.raw`
export class GetDeliveryDetail {
  constructor(deliveryRepository) {
    this.deliveryRepository = deliveryRepository;
  }

  execute(deliveryId) {
    return this.deliveryRepository.findById(deliveryId);
  }
}
`);

write(TR + 'application/useCases/verifyDelivery.js', String.raw`
export class VerifyDelivery {
  constructor(deliveryRepository) {
    this.deliveryRepository = deliveryRepository;
  }

  execute(deliveryId) {
    return this.deliveryRepository.verify(deliveryId);
  }
}
`);

write(TR + 'application/useCases/downloadDeliveryReport.js', String.raw`
export class DownloadDeliveryReport {
  constructor(deliveryRepository) {
    this.deliveryRepository = deliveryRepository;
  }

  // zoneId, from y to (AAAA-MM-DD) son opcionales. Devuelve { blob, filename }.
  async execute({ zoneId = null, from = null, to = null } = {}) {
    const blob = await this.deliveryRepository.downloadReport({ zoneId, from, to });
    const stamp = new Date().toISOString().slice(0, 10);
    return { blob, filename: 'informe-auditoria-' + stamp + '.pdf' };
  }
}
`);

/* ════════════════════════ INFRASTRUCTURE ════════════════════════ */
write(TR + 'infrastructure/mappers/deliveryMapper.js', String.raw`
import { Delivery } from '../../domain/entities/Delivery.js';
import { DeliveryDetail } from '../../domain/entities/DeliveryDetail.js';
import { VerificationResult } from '../../domain/entities/VerificationResult.js';
import { DeliveryStatus } from '../../domain/enums/deliveryStatus.js';
import { parseUtc } from '@shared/utils/formatters.js';

// Si el anclaje falló (y se reintenta cada 5 min) se muestra aparte.
const statusOf = (dto) => (dto.integrity?.anchorStatus === 'FAILED' ? DeliveryStatus.FAILED : dto.status);

// DeliveryResource { id, zoneId, status, deliveredAt, integrity: { anchorStatus, transactionHash } }
export function toDelivery(dto) {
  return new Delivery({
    id: dto.id,
    zoneId: dto.zoneId,
    status: statusOf(dto),
    transactionHash: dto.integrity?.transactionHash ?? null,
    deliveredAt: parseUtc(dto.deliveredAt),
  });
}

// El detalle (recursos, evidencias, hash del registro) aún no se vio con datos reales: se leen los
// nombres más probables de cada campo. Si el backend usa otros, solo hay que ajustar este archivo.
const toItem = (item) => ({
  name: item.resourceName ?? item.name ?? item.resource?.name ?? '—',
  planned: item.plannedQuantity ?? null,
  quantity: item.deliveredQuantity ?? item.quantity ?? null,
  unit: item.unit ?? item.resource?.unit ?? null,
});

const toEvidence = (evidence) =>
  typeof evidence === 'string'
    ? { hash: evidence, type: null }
    : { hash: evidence.sha256 ?? evidence.hash ?? null, type: evidence.contentType ?? evidence.type ?? null };

export function toDeliveryDetail(dto) {
  const integrity = dto.integrity ?? {};
  return new DeliveryDetail({
    id: dto.id,
    zoneId: dto.zoneId ?? dto.zone?.id ?? null,
    status: statusOf(dto),
    deliveredAt: parseUtc(dto.deliveredAt),
    openedAt: parseUtc(dto.initiatedAt ?? dto.openedAt ?? dto.createdAt ?? null),
    recordHash: integrity.recordHash ?? integrity.hash ?? dto.recordHash ?? dto.hash ?? null,
    transactionHash: integrity.transactionHash ?? null,
    anchoredAt: parseUtc(integrity.anchoredAt ?? integrity.confirmedAt ?? null),
    items: (dto.items ?? []).map(toItem),
    evidences: (dto.evidences ?? dto.evidence ?? []).map(toEvidence),
  });
}

export function toVerificationResult(dto) {
  return new VerificationResult({
    verified: dto.verified === true,
    recordHash: dto.recordHash ?? dto.computedHash ?? dto.currentHash ?? null,
    chainHash: dto.blockchainHash ?? dto.onChainHash ?? dto.chainHash ?? null,
  });
}
`);

write(TR + 'infrastructure/http/deliveryHttpRepository.js', String.raw`
import { DeliveryRepository } from '../../domain/repositories/deliveryRepository.js';
import { toDelivery, toDeliveryDetail, toVerificationResult } from '../mappers/deliveryMapper.js';
import { httpClient } from '@shared/infrastructure/http/httpClient.js';
import { asList } from '@shared/infrastructure/http/asList.js';
import { toApiError } from '@shared/infrastructure/http/toApiError.js';

const call = async (request) => {
  try {
    return await request();
  } catch (error) {
    // Si se pidió un archivo, el error (application/problem+json) llega como Blob: se lee para mostrar su "detail".
    const data = error.response?.data;
    if (typeof Blob !== 'undefined' && data instanceof Blob) {
      try {
        error.response.data = JSON.parse(await data.text());
      } catch {
        error.response.data = null;
      }
    }
    throw toApiError(error);
  }
};

export class DeliveryHttpRepository extends DeliveryRepository {
  async findByZone(zoneId) {
    const { data } = await call(() => httpClient.get('/deliveries', { params: { zoneId } }));
    return asList(data).map(toDelivery);
  }

  async findById(deliveryId) {
    const { data } = await call(() => httpClient.get('/deliveries/' + deliveryId));
    return toDeliveryDetail(data);
  }

  async verify(deliveryId) {
    const { data } = await call(() => httpClient.get('/deliveries/' + deliveryId + '/verify'));
    return toVerificationResult(data);
  }

  async downloadReport({ zoneId, from, to }) {
    const params = {};
    if (zoneId) params.zoneId = zoneId;
    if (from) params.from = from;
    if (to) params.to = to;
    const { data } = await call(() => httpClient.get('/deliveries/report', { params, responseType: 'blob' }));
    return data;
  }
}
`);

write(TR + 'infrastructure/mock/deliveryMockRepository.js', String.raw`
import { DeliveryRepository } from '../../domain/repositories/deliveryRepository.js';
import { toDelivery, toDeliveryDetail, toVerificationResult } from '../mappers/deliveryMapper.js';
import { delay } from '@shared/infrastructure/mock/delay.js';

const fakeHash = (head, tail) => '0x' + head + '0'.repeat(64 - head.length - tail.length) + tail;
const iso = (offsetMinutes) => new Date(Date.now() - offsetMinutes * 60000).toISOString().slice(0, 19);
const problem = (status, detail) => Object.assign(new Error(detail), { status, detail });

const delivery = (id, zoneId, status, hash, minutesAgo) => ({
  id,
  zoneId,
  status,
  deliveredAt: minutesAgo === null ? null : iso(minutesAgo),
  integrity: {
    anchorStatus: status === 'CERTIFIED' ? 'ANCHORED' : 'PENDING',
    transactionHash: hash,
  },
});

// Las 3 primeras repiten el mockup; el resto da 500 entregas registradas (492 validadas = 98.4 %).
const specials = [
  delivery('dl-0001', 'zn-01', 'CERTIFIED', fakeHash('7f3a', 'c91e'), 12),
  delivery('dl-0002', 'zn-02', 'REGISTERED', fakeHash('2b9d', 'a47f'), 35),
  delivery('dl-0003', 'zn-03', 'CERTIFIED', fakeHash('91c4', '03de'), 70),
  delivery('dl-0004', 'zn-04', 'INITIATED', null, null),
  { ...delivery('dl-0005', 'zn-05', 'REGISTERED', fakeHash('3c8e', 'f210'), 50), integrity: { anchorStatus: 'FAILED', transactionHash: null } },
];
const generated = Array.from({ length: 496 }, (_, i) =>
  delivery(
    'dl-' + String(i + 6).padStart(4, '0'),
    'zn-0' + (1 + (i % 7)),
    i < 7 ? 'REGISTERED' : 'CERTIFIED',
    fakeHash((i + 4096).toString(16), (i * 7919 + 4096).toString(16).slice(-4)),
    120 + i * 30,
  ),
);
const deliveryDtos = [...specials, ...generated];

// Detalle con la forma probable del backend (recursos, evidencias por hash, hash del registro).
const detailOf = (dto) => {
  const registered = dto.status !== 'INITIATED';
  return {
    ...dto,
    initiatedAt: dto.deliveredAt ? new Date(Date.parse(dto.deliveredAt + 'Z') - 3 * 3600000).toISOString().slice(0, 19) : iso(40),
    items: [
      { resourceName: 'Agua embotellada', plannedQuantity: 24, deliveredQuantity: registered ? 24 : null, unit: 'bidones' },
      { resourceName: 'Kits de alimentos', plannedQuantity: 60, deliveredQuantity: registered ? 58 : null, unit: 'kits' },
    ],
    evidences: registered
      ? [{ sha256: fakeHash('e1d3', dto.id.slice(-4)).slice(2), contentType: 'image/jpeg' }, { sha256: fakeHash('b7a9', dto.id.slice(-4)).slice(2), contentType: 'application/pdf' }]
      : [],
    integrity: {
      ...dto.integrity,
      recordHash: registered ? fakeHash('5d2c', dto.id.slice(-4)).slice(2) : null,
      anchoredAt: dto.status === 'CERTIFIED' ? dto.deliveredAt : null,
    },
  };
};

export class DeliveryMockRepository extends DeliveryRepository {
  async findByZone(zoneId) {
    await delay(300);
    return deliveryDtos.filter((dto) => dto.zoneId === zoneId).map(toDelivery);
  }

  async findById(deliveryId) {
    await delay(300);
    const dto = deliveryDtos.find((item) => item.id === deliveryId);
    if (!dto) throw problem(404, 'Entrega no encontrada');
    return toDeliveryDetail(detailOf(dto));
  }

  // dl-0003 simula un registro alterado; una entrega en camino no se puede verificar; una anclando, la blockchain no responde.
  async verify(deliveryId) {
    await delay(900);
    const dto = deliveryDtos.find((item) => item.id === deliveryId);
    if (!dto || dto.status === 'INITIATED') throw problem(404, 'La entrega todavía no está registrada.');
    if (dto.status !== 'CERTIFIED') throw problem(503, 'La blockchain no responde en este momento. Inténtalo en unos minutos.');
    const record = fakeHash('5d2c', dto.id.slice(-4)).slice(2);
    const tampered = deliveryId === 'dl-0003';
    return toVerificationResult({ verified: !tampered, recordHash: record, blockchainHash: tampered ? fakeHash('0bad', 'f00d').slice(2) : record });
  }

  async downloadReport({ zoneId }) {
    await delay(700);
    if (zoneId === 'zn-12') throw problem(404, 'No hay entregas registradas para ese filtro.');
    return new Blob(['%PDF-1.4\n% informe de prueba (mock)\n'], { type: 'application/pdf' });
  }
}
`);

write(TR + 'infrastructure/container.js', String.raw`
import { DeliveryMockRepository } from './mock/deliveryMockRepository.js';
import { DeliveryHttpRepository } from './http/deliveryHttpRepository.js';
import { GetDeliveryOverview } from '../application/useCases/getDeliveryOverview.js';
import { GetDeliveryLedger } from '../application/useCases/getDeliveryLedger.js';
import { GetDeliveryDetail } from '../application/useCases/getDeliveryDetail.js';
import { VerifyDelivery } from '../application/useCases/verifyDelivery.js';
import { DownloadDeliveryReport } from '../application/useCases/downloadDeliveryReport.js';
import { env } from '@shared/infrastructure/config/env.js';

const deliveryRepository = env.useMocks ? new DeliveryMockRepository() : new DeliveryHttpRepository();

export const getDeliveryOverviewUseCase = new GetDeliveryOverview(deliveryRepository);
export const getDeliveryLedgerUseCase = new GetDeliveryLedger(deliveryRepository);
export const getDeliveryDetailUseCase = new GetDeliveryDetail(deliveryRepository);
export const verifyDeliveryUseCase = new VerifyDelivery(deliveryRepository);
export const downloadDeliveryReportUseCase = new DownloadDeliveryReport(deliveryRepository);
`);

/* ════════════════════════ PRESENTATION: HOOKS ════════════════════════ */
write(TR + 'presentation/hooks/useDeliveryLedger.js', String.raw`
import { useQuery } from '@tanstack/react-query';
import { getDeliveryLedgerUseCase } from '../../infrastructure/container.js';

// zones: las zonas de la emergencia (undefined mientras se cargan).
export function useDeliveryLedger({ zones }) {
  return useQuery({
    queryKey: ['deliveries', 'ledger', zones?.map((zone) => zone.id).join(',')],
    queryFn: () => getDeliveryLedgerUseCase.execute({ zones }),
    enabled: Array.isArray(zones),
  });
}
`);

write(TR + 'presentation/hooks/useDeliveryDetail.js', String.raw`
import { useQuery } from '@tanstack/react-query';
import { getDeliveryDetailUseCase } from '../../infrastructure/container.js';

export function useDeliveryDetail(deliveryId) {
  return useQuery({
    queryKey: ['deliveries', 'detail', deliveryId],
    queryFn: () => getDeliveryDetailUseCase.execute(deliveryId),
    enabled: Boolean(deliveryId),
  });
}
`);

write(TR + 'presentation/hooks/useVerifyDelivery.js', String.raw`
import { useMutation } from '@tanstack/react-query';
import { verifyDeliveryUseCase } from '../../infrastructure/container.js';

// mutate(deliveryId): recalcula el hash y lo compara con el de la blockchain (a pedido, no al abrir la ficha).
export function useVerifyDelivery() {
  return useMutation({ mutationFn: (deliveryId) => verifyDeliveryUseCase.execute(deliveryId) });
}
`);

write(TR + 'presentation/hooks/useDownloadDeliveryReport.js', String.raw`
import { useMutation } from '@tanstack/react-query';
import { downloadDeliveryReportUseCase } from '../../infrastructure/container.js';
import { saveBlob } from '@shared/presentation/utils/saveBlob.js';

// mutate({ zoneId?, from?, to? }): pide el PDF de auditoría y lo descarga.
export function useDownloadDeliveryReport() {
  return useMutation({
    mutationFn: async (filters) => {
      const { blob, filename } = await downloadDeliveryReportUseCase.execute(filters);
      saveBlob(blob, filename);
    },
  });
}
`);

/* ════════════════════════ PRESENTATION: COMPONENTS ════════════════════════ */
write(TR + 'presentation/components/ledgerToolbar.jsx', String.raw`
import { useTranslation } from 'react-i18next';
import { DeliveryTab, Period } from '../../domain/services/filterDeliveries.js';

const TABS = [DeliveryTab.ALL, DeliveryTab.IN_TRANSIT, DeliveryTab.ANCHORING, DeliveryTab.VERIFIED, DeliveryTab.RETRYING];

export default function LedgerToolbar({ search, onSearch, period, onPeriod, tab, onTab, counts }) {
  const { t } = useTranslation('traceability');

  return (
    <div className="tl-toolbar">
      <div className="tl-toolbar__row">
        <label className="tl-search">
          <span className="tl-sr">{t('toolbar.search')}</span>
          <input type="search" value={search} placeholder={t('toolbar.search')} onChange={(event) => onSearch(event.target.value)} />
        </label>
        <label className="tl-select">
          <span className="tl-sr">{t('toolbar.period')}</span>
          <select value={period} onChange={(event) => onPeriod(event.target.value)}>
            {Object.values(Period).map((value) => (
              <option key={value} value={value}>{t('toolbar.periods.' + value)}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="tl-tabs" role="group" aria-label={t('toolbar.statusFilter')}>
        {TABS.map((key) => (
          <button key={key} type="button" className="tl-tab" aria-pressed={tab === key} onClick={() => onTab(key)}>
            {t('toolbar.tabs.' + key)} <span className="tl-tab__count">{counts[key] ?? 0}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
`);

write(TR + 'presentation/components/ledgerTable.jsx', String.raw`
import { useTranslation } from 'react-i18next';
import { formatDateTime, truncateHash } from '@shared/utils/formatters.js';

export default function LedgerTable({ deliveries, loading, selectedId, onSelect }) {
  const { t, i18n } = useTranslation('traceability');
  const lng = i18n.resolvedLanguage;

  return (
    <div className="tl-table-wrap">
      <table className="tl-table">
        <thead>
          <tr>
            <th scope="col">{t('ledger.columns.hash')}</th>
            <th scope="col">{t('ledger.columns.zone')}</th>
            <th scope="col">{t('ledger.columns.delivered')}</th>
            <th scope="col">{t('ledger.columns.status')}</th>
          </tr>
        </thead>
        <tbody>
          {loading && [0, 1, 2, 3, 4].map((n) => (
            <tr key={n}><td colSpan={4}><span className="tl-skel" /></td></tr>
          ))}
          {!loading && deliveries.length === 0 && (
            <tr><td colSpan={4} className="tl-empty">{t('ledger.empty')}</td></tr>
          )}
          {!loading && deliveries.map((delivery) => (
            <tr
              key={delivery.id} className={delivery.id === selectedId ? 'is-selected' : ''}
              onClick={() => onSelect(delivery.id)}
            >
              <td>
                <button
                  type="button" className="tl-hash" aria-pressed={delivery.id === selectedId}
                  onClick={(event) => { event.stopPropagation(); onSelect(delivery.id); }}
                >
                  {delivery.transactionHash ? truncateHash(delivery.transactionHash) : delivery.status === 'INITIATED' ? '—' : t('ledger.noHash')}
                </button>
              </td>
              <td>{delivery.zoneName ?? '—'}</td>
              <td className="tl-muted">{delivery.deliveredAt ? formatDateTime(delivery.deliveredAt, lng) : '—'}</td>
              <td><span className={'tl-chip tl-chip--' + delivery.status.toLowerCase()}>{t('ledger.status.' + delivery.status)}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
`);

write(TR + 'presentation/components/traceabilityCard.jsx', String.raw`
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateTime, formatNumber, truncateHash } from '@shared/utils/formatters.js';
import { useVerifyDelivery } from '../hooks/useVerifyDelivery.js';
import { useDownloadDeliveryReport } from '../hooks/useDownloadDeliveryReport.js';

// Pasos del ciclo de vida de una entrega: misión abierta → entrega registrada → anclada en la blockchain.
function buildSteps(detail, t, lng) {
  const status = detail.status;
  const registered = status !== 'INITIATED';
  const when = (value) => (value ? formatDateTime(value, lng) : null);
  return [
    { key: 'opened', state: 'done', title: t('card.steps.opened'), note: when(detail.openedAt) },
    {
      key: 'registered', state: registered ? 'done' : 'current', title: t('card.steps.registered'),
      note: registered ? when(detail.deliveredAt) : t('card.steps.onTheWay'),
    },
    {
      key: 'anchored',
      state: status === 'CERTIFIED' ? 'done' : status === 'INITIATED' ? 'pending' : status === 'FAILED' ? 'warn' : 'current',
      title: t('card.steps.anchored'),
      note: status === 'CERTIFIED' ? when(detail.anchoredAt) ?? t('card.steps.confirmed')
        : status === 'REGISTERED' ? t('card.steps.anchoring')
        : status === 'FAILED' ? t('card.steps.retrying')
        : t('card.steps.pending'),
    },
  ];
}

const verifyMessage = (t, error) => {
  if (error.detail) return error.detail;
  if (error.status === 404) return t('card.verify.notFound');
  if (error.status === 503) return t('card.verify.unavailable');
  return t('card.verify.error');
};

export default function TraceabilityCard({ detail, zoneName, onClose }) {
  const { t, i18n } = useTranslation('traceability');
  const lng = i18n.resolvedLanguage;
  const verify = useVerifyDelivery();
  const report = useDownloadDeliveryReport();
  const [copied, setCopied] = useState(false);

  const data = detail.data;
  const publicUrl = data ? window.location.origin + '/public/verify/' + data.id : null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <aside className="tl-card" aria-labelledby="tl-card-title">
      <header className="tl-card__head">
        <div>
          <h2 id="tl-card-title" className="tl-h2">{t('card.title')}</h2>
          {data && <p className="tl-sub">{zoneName ?? '—'}</p>}
        </div>
        {data && <span className={'tl-chip tl-chip--' + data.status.toLowerCase()}>{t('ledger.status.' + data.status)}</span>}
        <button type="button" className="tl-icon-btn tl-close" onClick={onClose} aria-label={t('card.close')}>×</button>
      </header>

      {detail.isLoading && <span className="tl-skel tl-skel--block" />}
      {detail.isError && <p className="tl-error" role="alert">{detail.error?.detail ?? t('card.loadError')}</p>}

      {data && (
        <>
          <ol className="tl-steps">
            {buildSteps(data, t, lng).map((step, index) => (
              <li key={step.key} className={'tl-step tl-step--' + step.state}>
                <span className="tl-step__dot" aria-hidden="true">{step.state === 'done' ? '✓' : index + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  {step.note && <p>{step.note}</p>}
                  {step.key === 'anchored' && data.explorerUrl && (
                    <a href={data.explorerUrl} target="_blank" rel="noreferrer">{t('card.viewTx')} ↗ {truncateHash(data.transactionHash)}</a>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {data.items.length > 0 && (
            <section>
              <span className="tl-label">{t('card.items')}</span>
              <ul className="tl-items">
                {data.items.map((item) => (
                  <li key={item.name}>
                    <span>{item.name}</span>
                    <strong>
                      {item.quantity !== null ? formatNumber(item.quantity, lng) : '—'}
                      {item.planned !== null ? ' / ' + formatNumber(item.planned, lng) : ''}
                      {item.unit ? ' ' + item.unit : ''}
                    </strong>
                  </li>
                ))}
              </ul>
              <p className="tl-note">{t('card.itemsHint')}</p>
            </section>
          )}

          <section>
            <span className="tl-label">{t('card.integrity')}</span>
            <dl className="tl-facts">
              <div><dt>{t('card.publicCode')}</dt><dd title={data.id}>{truncateHash(data.id, 8, 4)}</dd></div>
              <div><dt>{t('card.recordHash')}</dt><dd title={data.recordHash ?? ''}>{data.recordHash ? truncateHash(data.recordHash, 8, 6) : '—'}</dd></div>
              <div><dt>{t('card.evidences')}</dt><dd>{data.evidences.length}</dd></div>
            </dl>
            {data.evidences.length > 0 && (
              <ul className="tl-evidence">
                {data.evidences.map((evidence, index) => (
                  <li key={(evidence.hash ?? '') + index} title={evidence.hash ?? ''}>
                    {evidence.hash ? truncateHash(evidence.hash, 8, 6) : '—'}{evidence.type ? ' · ' + evidence.type : ''}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="tl-verify">
            <span className="tl-label">{t('card.verify.title')}</span>
            <p className="tl-note">{t('card.verify.hint')}</p>
            <button
              type="button" className="tl-btn-outline" disabled={verify.isPending || data.status === 'INITIATED'}
              onClick={() => verify.mutate(data.id)}
            >
              {verify.isPending ? t('card.verify.checking') : t('card.verify.action')}
            </button>
            {verify.data && verify.data.verified && <p className="tl-result tl-result--ok" role="status">{t('card.verify.ok')}</p>}
            {verify.data && !verify.data.verified && (
              <p className="tl-result tl-result--bad" role="alert">{t('card.verify.mismatch')}</p>
            )}
            {verify.error && <p className="tl-error" role="alert">{verifyMessage(t, verify.error)}</p>}

            <div className="tl-link">
              <span className="tl-link__url" title={publicUrl}>{publicUrl}</span>
              <button type="button" className="tl-link-btn" onClick={copy}>{copied ? t('card.copied') : t('card.copy')}</button>
            </div>
            <p className="tl-note">{t('card.publicHint')}</p>
          </section>

          <button
            type="button" className="tl-btn-outline" disabled={report.isPending}
            onClick={() => report.mutate({ zoneId: data.zoneId })}
          >
            {report.isPending ? t('card.downloading') : t('card.download')}
          </button>
          {report.error && <p className="tl-error" role="alert">{report.error.detail ?? t('card.downloadError')}</p>}
        </>
      )}
    </aside>
  );
}
`);

write(TR + 'presentation/pages/auditLedgerPage.jsx', String.raw`
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useActiveEmergency } from '@bc/emergencyManagement/presentation/hooks/useActiveEmergency.js';
import { useZoneRanking } from '@bc/emergencyManagement/presentation/hooks/useZoneRanking.js';
import { DeliveryTab, Period, countByTab, filterDeliveries, periodStart } from '../../domain/services/filterDeliveries.js';
import { useDeliveryLedger } from '../hooks/useDeliveryLedger.js';
import { useDeliveryDetail } from '../hooks/useDeliveryDetail.js';
import { useDownloadDeliveryReport } from '../hooks/useDownloadDeliveryReport.js';
import LedgerToolbar from '../components/ledgerToolbar.jsx';
import LedgerTable from '../components/ledgerTable.jsx';
import TraceabilityCard from '../components/traceabilityCard.jsx';
import '../styles/auditLedger.css';

const PAGE_SIZE = 10;

export default function AuditLedgerPage() {
  const { t } = useTranslation('traceability');
  const [searchParams, setSearchParams] = useSearchParams();

  const emergency = useActiveEmergency();
  const ranking = useZoneRanking(emergency.data?.id, { explainTop: 0, withPosition: false });
  const ledger = useDeliveryLedger({ zones: ranking.data });
  const exportReport = useDownloadDeliveryReport();

  const [tab, setTab] = useState(DeliveryTab.ALL);
  const [period, setPeriod] = useState(Period.ALL);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const deliveries = useMemo(() => ledger.data ?? [], [ledger.data]);
  const counts = useMemo(() => countByTab(deliveries), [deliveries]);
  const filtered = useMemo(() => filterDeliveries(deliveries, { tab, search, period }), [deliveries, tab, search, period]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  // La entrega abierta vive en la URL (?delivery=): se puede recargar o compartir el enlace.
  const selectedId = searchParams.get('delivery');
  const selected = deliveries.find((delivery) => delivery.id === selectedId) ?? null;
  const detail = useDeliveryDetail(selectedId);
  const select = (id) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('delivery', id);
    else next.delete('delivery');
    setSearchParams(next, { replace: true });
  };

  const loading = emergency.isPending || ranking.isLoading || ledger.isLoading;
  const hasError = emergency.isError || ranking.isError || ledger.isError;
  const retry = () => (emergency.isError ? emergency.refetch() : ranking.isError ? ranking.refetch() : ledger.refetch());
  const change = (setter) => (value) => { setter(value); setPage(1); };

  return (
    <div className="tl">
      <header className="tl-head">
        <div>
          <h1>{t('page.title')}</h1>
          <p>{t('page.subtitle')}</p>
        </div>
        <div className="tl-head__actions">
          <button
            type="button" className="tl-btn-lime" disabled={exportReport.isPending}
            onClick={() => exportReport.mutate({ from: periodStart(period) })}
          >
            {exportReport.isPending ? t('page.exporting') : t('page.export')}
          </button>
          {exportReport.error && <p className="tl-error" role="alert">{exportReport.error.detail ?? t('card.downloadError')}</p>}
        </div>
      </header>

      {hasError && (
        <p className="tl-alert" role="alert">
          {t('page.loadError')} <button type="button" className="tl-link-btn" onClick={retry}>{t('page.retry')}</button>
        </p>
      )}

      <div className={'tl-layout' + (selectedId ? ' has-card' : '')}>
        <section className="tl-panel" aria-labelledby="tl-ledger-title">
          <header className="tl-panel__head">
            <h2 id="tl-ledger-title" className="tl-h2">{t('page.ledger')}</h2>
            {!loading && <span className="tl-sync">{t('page.count', { count: filtered.length })}</span>}
          </header>
          <LedgerToolbar
            search={search} onSearch={change(setSearch)} period={period} onPeriod={change(setPeriod)}
            tab={tab} onTab={change(setTab)} counts={counts}
          />
          <LedgerTable deliveries={visible} loading={loading} selectedId={selectedId} onSelect={select} />
          {!loading && filtered.length > 0 && (
            <footer className="tl-pagination">
              <span>{t('page.range', { from: start + 1, to: start + visible.length, total: filtered.length })}</span>
              <div>
                <button type="button" className="tl-btn-outline tl-btn-sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>{t('page.prev')}</button>
                <button type="button" className="tl-btn-outline tl-btn-sm" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>{t('page.next')}</button>
              </div>
            </footer>
          )}
        </section>

        {selectedId && (
          <TraceabilityCard key={selectedId} detail={detail} zoneName={selected?.zoneName} onClose={() => select(null)} />
        )}
      </div>
    </div>
  );
}
`);

write(TR + 'presentation/styles/auditLedger.css', String.raw`
.tl { display: grid; gap: var(--space-3); }
.tl-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

.tl-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.tl-head h1 { margin: 0 0 4px; font-size: 1.75rem; font-weight: 700; letter-spacing: -0.02em; }
.tl-head p { margin: 0; color: var(--night-100); }
.tl-head__actions { display: grid; justify-items: end; }

.tl-alert { margin: 0; padding: 12px 16px; border: 1px solid rgba(255, 77, 77, 0.35); border-radius: 12px; background: rgba(255, 77, 77, 0.1); color: #ffb3b3; font-size: 0.875rem; }
.tl-error { margin: 8px 0 0; color: #ff9b9b; font-size: 0.875rem; }
.tl-note { margin: 8px 0 0; font-size: 0.8125rem; color: var(--night-100); }
.tl-label { display: block; margin-bottom: 8px; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-sky); }
.tl-h2 { margin: 0; font-size: 1.0625rem; font-weight: 700; }
.tl-sub { margin: 2px 0 0; font-size: 0.875rem; color: var(--color-sky); }
.tl-muted { color: var(--night-100); white-space: nowrap; }

.tl-btn-lime, .tl-btn-outline { min-height: 44px; padding: 0 20px; border-radius: 10px; font: inherit; font-weight: 700; cursor: pointer; transition: filter 0.2s, background 0.2s, transform 0.2s; }
.tl-btn-lime { border: 0; background: var(--color-lime); color: var(--night-600); }
.tl-btn-lime:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); }
.tl-btn-outline { border: 1.5px solid rgba(255, 255, 255, 0.85); background: transparent; color: #fff; }
.tl-btn-outline:hover:not(:disabled) { background: rgba(255, 255, 255, 0.08); }
.tl-btn-lime:disabled, .tl-btn-outline:disabled { opacity: 0.5; cursor: not-allowed; }
.tl-btn-sm { min-height: 36px; padding: 0 14px; }
.tl-link-btn { padding: 0; border: 0; background: transparent; color: var(--color-sky); font: inherit; text-decoration: underline; cursor: pointer; white-space: nowrap; }
.tl-btn-lime:focus-visible, .tl-btn-outline:focus-visible, .tl-link-btn:focus-visible, .tl-tab:focus-visible, .tl-hash:focus-visible, .tl-icon-btn:focus-visible { outline: 2px solid var(--color-sky); outline-offset: 2px; }

.tl-layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-3); align-items: start; }
.tl-layout.has-card { grid-template-columns: minmax(0, 1.5fr) minmax(320px, 1fr); }

.tl-panel, .tl-card { min-width: 0; border: 1px solid var(--cc-line); border-radius: 16px; background: var(--cc-card); }
.tl-panel { overflow: hidden; }
.tl-panel__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 20px 0; }
.tl-sync { display: inline-flex; align-items: center; gap: 8px; font-size: 0.8125rem; color: var(--color-lime); }
.tl-sync::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--color-lime); }

.tl-toolbar { display: grid; gap: 12px; padding: 16px 20px; }
.tl-toolbar__row { display: flex; flex-wrap: wrap; gap: 12px; }
.tl-search { flex: 1 1 260px; }
.tl-search input, .tl-select select { width: 100%; height: 44px; padding: 0 14px; border: 1px solid var(--cc-line); border-radius: 10px; background: var(--cc-card-inner); color: #fff; font: inherit; }
.tl-select select { cursor: pointer; }
.tl-select option { background: var(--cc-card); }
.tl-search input:focus-visible, .tl-select select:focus-visible { outline: 2px solid var(--color-royal); }
.tl-tabs { display: flex; flex-wrap: wrap; gap: 8px; }
.tl-tab { display: inline-flex; align-items: center; gap: 6px; min-height: 34px; padding: 0 12px; border: 1px solid var(--cc-line); border-radius: 999px; background: transparent; color: var(--night-100); font: inherit; font-size: 0.8125rem; cursor: pointer; }
.tl-tab[aria-pressed='true'] { border-color: var(--color-lime); color: var(--color-lime); background: rgba(190, 242, 100, 0.08); font-weight: 700; }
.tl-tab__count { opacity: 0.8; font-variant-numeric: tabular-nums; }

.tl-table-wrap { overflow-x: auto; }
.tl-table { width: 100%; min-width: 560px; border-collapse: collapse; }
.tl-table th { padding: 12px 20px; text-align: left; font-size: 0.6875rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-sky); background: rgba(0, 0, 0, 0.25); white-space: nowrap; }
.tl-table td { padding: 12px 20px; border-bottom: 1px solid var(--cc-line); font-size: 0.9375rem; vertical-align: middle; }
.tl-table tbody tr { cursor: pointer; transition: background 0.15s; }
.tl-table tbody tr:hover { background: rgba(255, 255, 255, 0.04); }
.tl-table tbody tr.is-selected { background: rgba(71, 80, 221, 0.2); box-shadow: inset 3px 0 0 var(--color-lime); }
.tl-hash { padding: 0; border: 0; background: transparent; color: #fff; font: inherit; font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace; font-size: 0.875rem; cursor: pointer; }
.tl-empty { padding: 32px 20px !important; text-align: center; color: var(--night-100); cursor: default; }

.tl-chip { display: inline-flex; align-items: center; min-height: 22px; padding: 0 10px; border-radius: 999px; background: rgba(255, 255, 255, 0.1); font-size: 0.75rem; font-weight: 700; white-space: nowrap; }
.tl-chip--certified { background: rgba(190, 242, 100, 0.16); color: var(--color-lime); }
.tl-chip--initiated { background: rgba(133, 213, 246, 0.16); color: var(--color-sky); }
.tl-chip--registered { background: rgba(255, 176, 32, 0.16); color: #ffb020; }
.tl-chip--failed { background: rgba(255, 107, 107, 0.16); color: #ff9b9b; }

.tl-pagination { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 14px 20px; font-size: 0.8125rem; color: var(--night-100); }
.tl-pagination div { display: flex; gap: 8px; }

.tl-skel { display: block; height: 20px; border-radius: 8px; background: linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.1), rgba(255,255,255,0.04)); background-size: 200% 100%; animation: cc-shimmer 1.4s linear infinite; }
.tl-skel--block { height: 160px; }

/* Ficha de trazabilidad */
.tl-card { display: grid; align-content: start; gap: 18px; padding: 20px; }
.tl-card__head { display: flex; align-items: flex-start; gap: 12px; }
.tl-card__head > div { flex: 1; min-width: 0; }
.tl-icon-btn { display: grid; place-items: center; width: 32px; height: 32px; border: 0; border-radius: 8px; background: transparent; color: var(--night-100); font-size: 1.25rem; cursor: pointer; }
.tl-icon-btn:hover { background: rgba(255, 255, 255, 0.08); color: #fff; }

.tl-steps { display: grid; gap: 18px; margin: 0; padding: 0; list-style: none; }
.tl-step { position: relative; display: flex; gap: 14px; }
.tl-step:not(:last-child)::before { content: ''; position: absolute; left: 13px; top: 30px; bottom: -16px; width: 2px; background: var(--cc-line); }
.tl-step__dot { display: grid; place-items: center; flex: none; width: 28px; height: 28px; border-radius: 50%; background: rgba(255, 255, 255, 0.12); color: #fff; font-size: 0.8125rem; font-weight: 700; }
.tl-step--done .tl-step__dot { background: #10c27a; color: #04221a; }
.tl-step--current .tl-step__dot { background: var(--color-sky); color: var(--night-600); }
.tl-step--warn .tl-step__dot { background: #ffb020; color: #2b1a00; }
.tl-step--pending { opacity: 0.6; }
.tl-step strong { display: block; font-size: 0.9375rem; }
.tl-step p { margin: 2px 0 0; font-size: 0.8125rem; color: var(--night-100); }
.tl-step a { display: inline-block; margin-top: 2px; font-size: 0.8125rem; color: var(--color-sky); }

.tl-items { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.tl-items li { display: flex; justify-content: space-between; gap: 12px; padding: 10px 12px; border-radius: 10px; background: var(--cc-card-inner); font-size: 0.875rem; }
.tl-facts { display: grid; gap: 8px; margin: 0; }
.tl-facts div { display: flex; justify-content: space-between; gap: 16px; font-size: 0.875rem; }
.tl-facts dt { color: var(--night-100); }
.tl-facts dd { margin: 0; font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace; font-size: 0.8125rem; }
.tl-evidence { display: grid; gap: 4px; margin: 10px 0 0; padding: 0; list-style: none; font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace; font-size: 0.75rem; color: var(--night-100); }

.tl-verify { display: grid; gap: 8px; padding: 14px 16px; border-radius: 12px; background: rgba(0, 0, 0, 0.28); }
.tl-verify .tl-note { margin: 0; }
.tl-result { margin: 4px 0 0; padding: 10px 12px; border-radius: 10px; font-size: 0.875rem; font-weight: 700; }
.tl-result--ok { background: rgba(16, 194, 122, 0.16); color: #4be0a3; }
.tl-result--bad { background: rgba(255, 107, 107, 0.16); color: #ff9b9b; }
.tl-link { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px; border: 1px dashed var(--cc-line); border-radius: 10px; font-size: 0.75rem; }
.tl-link__url { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--night-100); }

@media (max-width: 1100px) {
  .tl-layout.has-card { grid-template-columns: minmax(0, 1fr); }
}
`);

/* ════════════════════════ I18N ════════════════════════ */
mergeJson(TR + 'presentation/i18n/es.json', {
  auditLedger: { title: 'Trazabilidad Blockchain' },
  page: {
    title: 'Trazabilidad e Historial Blockchain',
    subtitle: 'Auditoría inmutable de la cadena de suministro humanitario',
    export: 'Exportar informe de auditoría',
    exporting: 'Generando informe...',
    ledger: 'Ledger de entregas',
    count: '{{count}} entregas',
    range: '{{from}}–{{to}} de {{total}} entregas',
    prev: 'Anterior',
    next: 'Siguiente',
    loadError: 'No se pudieron cargar las entregas.',
    retry: 'Reintentar',
  },
  toolbar: {
    search: 'Buscar por hash, código público o zona',
    period: 'Período',
    periods: { '7d': 'Últimos 7 días', '30d': 'Últimos 30 días', all: 'Todo el período' },
    statusFilter: 'Filtrar por estado',
    tabs: { all: 'Todas', inTransit: 'En camino', anchoring: 'Anclando', verified: 'Validadas', retrying: 'Reintentando' },
  },
  ledger: { noHash: 'Sin enviar' },
  card: {
    title: 'Ficha de trazabilidad',
    close: 'Cerrar ficha',
    loadError: 'No se pudo cargar la entrega.',
    steps: {
      opened: 'Misión abierta',
      registered: 'Entrega registrada',
      anchored: 'Anclada en la blockchain',
      onTheWay: 'La brigada va en camino',
      anchoring: 'Esperando la confirmación de la transacción',
      retrying: 'El anclaje falló; se reintenta cada 5 minutos',
      pending: 'Pendiente de la entrega',
      confirmed: 'Confirmada',
    },
    viewTx: 'Ver transacción',
    items: 'Recursos entregados',
    itemsHint: 'Entregado / planificado. Se puede entregar menos de lo planificado, nunca más.',
    integrity: 'Integridad',
    publicCode: 'Código público',
    recordHash: 'Hash del registro',
    evidences: 'Evidencias',
    verify: {
      title: 'Verificación de entrega',
      hint: 'Recalcula el hash con los datos y archivos actuales y lo compara con el de la blockchain.',
      action: 'Verificar integridad',
      checking: 'Verificando...',
      ok: 'Íntegra: el registro coincide con la blockchain.',
      mismatch: 'No coincide: el registro cambió después de anclarse.',
      notFound: 'La entrega todavía no está registrada.',
      unavailable: 'La blockchain no responde en este momento. Inténtalo de nuevo en unos minutos.',
      error: 'No se pudo verificar la entrega.',
    },
    copy: 'Copiar',
    copied: 'Copiado',
    publicHint: 'Enlace público de verificación: cualquiera puede comprobar la entrega sin iniciar sesión.',
    download: 'Descargar informe PDF de la zona',
    downloading: 'Generando informe...',
    downloadError: 'No se pudo generar el informe.',
  },
});

mergeJson(TR + 'presentation/i18n/en.json', {
  auditLedger: { title: 'Blockchain Traceability' },
  page: {
    title: 'Blockchain Traceability and History',
    subtitle: 'Immutable audit of the humanitarian supply chain',
    export: 'Export audit report',
    exporting: 'Generating report...',
    ledger: 'Delivery ledger',
    count: '{{count}} deliveries',
    range: '{{from}}–{{to}} of {{total}} deliveries',
    prev: 'Previous',
    next: 'Next',
    loadError: 'Could not load the deliveries.',
    retry: 'Retry',
  },
  toolbar: {
    search: 'Search by hash, public code or zone',
    period: 'Period',
    periods: { '7d': 'Last 7 days', '30d': 'Last 30 days', all: 'Whole period' },
    statusFilter: 'Filter by status',
    tabs: { all: 'All', inTransit: 'On the way', anchoring: 'Anchoring', verified: 'Validated', retrying: 'Retrying' },
  },
  ledger: { noHash: 'Not sent' },
  card: {
    title: 'Traceability record',
    close: 'Close record',
    loadError: 'Could not load the delivery.',
    steps: {
      opened: 'Mission opened',
      registered: 'Delivery registered',
      anchored: 'Anchored on the blockchain',
      onTheWay: 'The brigade is on the way',
      anchoring: 'Waiting for the transaction to confirm',
      retrying: 'Anchoring failed; retried every 5 minutes',
      pending: 'Waiting for the delivery',
      confirmed: 'Confirmed',
    },
    viewTx: 'View transaction',
    items: 'Delivered resources',
    itemsHint: 'Delivered / planned. Less than planned can be delivered, never more.',
    integrity: 'Integrity',
    publicCode: 'Public code',
    recordHash: 'Record hash',
    evidences: 'Evidence files',
    verify: {
      title: 'Delivery verification',
      hint: 'Recomputes the hash from the current data and files and compares it with the one on the blockchain.',
      action: 'Verify integrity',
      checking: 'Verifying...',
      ok: 'Intact: the record matches the blockchain.',
      mismatch: 'Mismatch: the record changed after it was anchored.',
      notFound: 'The delivery is not registered yet.',
      unavailable: 'The blockchain is not answering right now. Try again in a few minutes.',
      error: 'Could not verify the delivery.',
    },
    copy: 'Copy',
    copied: 'Copied',
    publicHint: 'Public verification link: anyone can check the delivery without signing in.',
    download: 'Download zone PDF report',
    downloading: 'Generating report...',
    downloadError: 'Could not generate the report.',
  },
});

console.log('\nListo. Reinicia "npm run dev" y abre Trazabilidad Blockchain (menú lateral).');
