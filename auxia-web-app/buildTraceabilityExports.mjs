// Trazabilidad, segunda parte: ficha ajustada al JSON real, descarga PDF/Excel con modal y rango de fechas,
// y la pantalla pública de verificación (/public/verify/:deliveryId).
// Uso (en la raíz, DESPUÉS de buildTraceability.mjs): node buildTraceabilityExports.mjs
// Reescribe archivos de traceability (mapper, entidades, mock, container, ficha, página) y de citizenTransparency
// (verifyDeliveryPage). Agrega estilos al final de auditLedger.css. Se puede correr varias veces.
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
const CT = 'src/boundedContexts/citizenTransparency/';
const SHARED = 'src/shared/';

if (!existsSync(TR + 'presentation/components/traceabilityCard.jsx')) {
  throw new Error('Primero corre buildTraceability.mjs (y estate en la raíz del proyecto).');
}

/* ════════════════════════ SHARED: Excel (.xlsx) sin dependencias ════════════════════════ */
write(SHARED + 'infrastructure/files/xlsxWriter.js', String.raw`
// Genera un .xlsx (zip sin comprimir + XML de hojas) sin librerías externas.
// sheets = [{ name, rows: [[celda, ...], ...] }]; celda: texto, número o null. La primera fila va en negrita.
const encoder = new TextEncoder();

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const escapeXml = (value) =>
  String(value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const columnName = (index) => {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
};

const sheetName = (name, index) => {
  const clean = String(name).replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31);
  return clean || 'Hoja' + (index + 1);
};

function sheetXml(rows) {
  const widths = [];
  rows.forEach((row) => row.forEach((cell, c) => {
    widths[c] = Math.min(60, Math.max(widths[c] ?? 8, String(cell ?? '').length + 2));
  }));
  const cols = widths.map((w, c) => '<col min="' + (c + 1) + '" max="' + (c + 1) + '" width="' + w + '" customWidth="1"/>').join('');
  const body = rows.map((row, r) => {
    const cells = row.map((cell, c) => {
      if (cell === null || cell === undefined || cell === '') return '';
      const ref = columnName(c) + (r + 1);
      const style = r === 0 ? ' s="1"' : '';
      if (typeof cell === 'number' && Number.isFinite(cell)) return '<c r="' + ref + '"' + style + '><v>' + cell + '</v></c>';
      return '<c r="' + ref + '" t="inlineStr"' + style + '><is><t xml:space="preserve">' + escapeXml(cell) + '</t></is></c>';
    }).join('');
    return '<row r="' + (r + 1) + '">' + cells + '</row>';
  }).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    (cols ? '<cols>' + cols + '</cols>' : '') + '<sheetData>' + body + '</sheetData></worksheet>';
}

const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

function zip(files) {
  const parts = [];
  const central = [];
  let offset = 0;
  files.forEach(({ name, data }) => {
    const nameBytes = encoder.encode(name);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    parts.push(new Uint8Array(local.buffer), nameBytes, data);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, data.length, true);
    entry.setUint16(28, nameBytes.length, true);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  });
  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return [...parts, ...central, new Uint8Array(end.buffer)];
}

export function createXlsxBlob(sheets) {
  const names = sheets.map((sheet, i) => sheetName(sheet.name, i));
  const text = (name, content) => ({ name, data: encoder.encode(content) });
  const files = [
    text('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sheets.map((_, i) => '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('') +
      '</Types>'),
    text('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    text('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
      names.map((name, i) => '<sheet name="' + escapeXml(name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>').join('') +
      '</sheets></workbook>'),
    text('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sheets.map((_, i) => '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>').join('') +
      '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'),
    text('xl/styles.xml', STYLES),
    ...sheets.map((sheet, i) => text('xl/worksheets/sheet' + (i + 1) + '.xml', sheetXml(sheet.rows))),
  ];
  return new Blob(zip(files), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
`);

/* ════════════════════════ DOMAIN ════════════════════════ */
write(TR + 'domain/entities/DeliveryDetail.js', String.raw`
import { EXPLORER_TX_URL } from './Delivery.js';

// Una entrega con sus recursos, evidencias (por hash) y estado del anclaje (GET /deliveries/{id}).
// items = [{ resourceId, name, quantity }] · evidences = [{ id, type, hash, capturedAt, location: { latitude, longitude } | null }]
export class DeliveryDetail {
  constructor({
    id, zoneId, planId = null, status, deliveredAt = null, receivedAt = null,
    recordHash = null, transactionHash = null, anchoredAt = null, attempts = null, items = [], evidences = [],
  }) {
    this.id = id;
    this.zoneId = zoneId;
    this.planId = planId;
    this.status = status;
    this.deliveredAt = deliveredAt;       // epoch ms: cuándo la brigada entregó
    this.receivedAt = receivedAt;         // epoch ms: cuándo el sistema la registró y calculó el hash
    this.recordHash = recordHash;         // SHA-256 del registro canónico de la entrega
    this.transactionHash = transactionHash;
    this.anchoredAt = anchoredAt;         // epoch ms
    this.attempts = attempts;             // intentos de anclaje
    this.items = items;
    this.evidences = evidences;
    Object.freeze(this);
  }

  get explorerUrl() {
    return this.transactionHash ? EXPLORER_TX_URL + this.transactionHash : null;
  }

  // Ubicación GPS de la entrega: la de la primera evidencia que la trae.
  get location() {
    return this.evidences.find((evidence) => evidence.location)?.location ?? null;
  }
}
`);

write(TR + 'domain/entities/VerificationResult.js', String.raw`
import { EXPLORER_TX_URL } from './Delivery.js';

// Resultado de GET /deliveries/{id}/verify: ¿el hash recalculado hoy coincide con el de la blockchain?
export class VerificationResult {
  constructor({ deliveryId, verified, recordHash = null, anchoredHash = null, transactionHash = null }) {
    this.deliveryId = deliveryId;
    this.verified = verified;
    this.recordHash = recordHash;           // recalculado ahora
    this.anchoredHash = anchoredHash;       // el que está en la blockchain
    this.transactionHash = transactionHash;
    Object.freeze(this);
  }

  get explorerUrl() {
    return this.transactionHash ? EXPLORER_TX_URL + this.transactionHash : null;
  }
}
`);

write(TR + 'domain/services/deliveryReportRows.js', String.raw`
// Filas de los informes en Excel. Los textos (columnas, estados) llegan ya traducidos en "labels".
const formatUtc = (epochMs) =>
  epochMs === null || epochMs === undefined ? '' : new Date(epochMs).toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

// Informe de la tabla: una fila por entrega.
export function deliveriesSheet(deliveries, labels, verifyBaseUrl) {
  return {
    name: labels.tableSheet,
    rows: [
      labels.tableColumns,
      ...deliveries.map((delivery) => [
        delivery.id,
        delivery.zoneName ?? '',
        labels.status(delivery.status),
        formatUtc(delivery.deliveredAt),
        delivery.transactionHash ?? '',
        verifyBaseUrl + delivery.id,
      ]),
    ],
  };
}

// Informe de una entrega: resumen, recursos y evidencias.
export function deliverySheets(detail, zoneName, labels, verifyBaseUrl) {
  const f = labels.fields;
  return [
    {
      name: labels.summarySheet,
      rows: [
        [f.field, f.value],
        [f.code, detail.id],
        [f.zone, zoneName ?? detail.zoneId ?? ''],
        [f.status, labels.status(detail.status)],
        [f.delivered, formatUtc(detail.deliveredAt)],
        [f.received, formatUtc(detail.receivedAt)],
        [f.anchored, formatUtc(detail.anchoredAt)],
        [f.recordHash, detail.recordHash ?? ''],
        [f.transaction, detail.transactionHash ?? ''],
        [f.verifyUrl, verifyBaseUrl + detail.id],
      ],
    },
    {
      name: labels.itemsSheet,
      rows: [[f.resource, f.quantity], ...detail.items.map((item) => [item.name ?? item.resourceId ?? '', item.quantity])],
    },
    {
      name: labels.evidenceSheet,
      rows: [
        [f.type, f.hash, f.captured, f.latitude, f.longitude],
        ...detail.evidences.map((evidence) => [
          evidence.type ?? '', evidence.hash ?? '', formatUtc(evidence.capturedAt),
          evidence.location?.latitude ?? null, evidence.location?.longitude ?? null,
        ]),
      ],
    },
  ];
}
`);

// Rango de fechas (AAAA-MM-DD, en UTC) sobre las funciones de filtro existentes: se agregan al final del archivo.
const filterPath = TR + 'domain/services/filterDeliveries.js';
const rangeMarker = '// ── Rango de fechas ──';
const filterText = readFileSync(filterPath, 'utf8');
if (!filterText.includes(rangeMarker)) {
  writeFileSync(filterPath, filterText.replace(/\s*$/, '\n') + String.raw`
${rangeMarker}
// Un rango es válido si no termina antes de empezar; cualquiera de los dos extremos puede faltar.
export const isRangeValid = (from, to) => !from || !to || from <= to;

// Entregas con fecha de entrega dentro del rango (ambos días incluidos). Sin rango, todas.
export function filterByRange(deliveries, from, to) {
  if (!from && !to) return deliveries;
  const start = from ? Date.parse(from + 'T00:00:00Z') : -Infinity;
  const end = to ? Date.parse(to + 'T23:59:59.999Z') : Infinity;
  return deliveries.filter((d) => d.deliveredAt !== null && d.deliveredAt >= start && d.deliveredAt <= end);
}
`);
  console.log('~ ' + filterPath);
}

/* ════════════════════════ APPLICATION ════════════════════════ */
write(TR + 'application/useCases/exportDeliveryReport.js', String.raw`
import { deliveriesSheet, deliverySheets } from '../../domain/services/deliveryReportRows.js';
import { filterByRange, isRangeValid } from '../../domain/services/filterDeliveries.js';

// Informe de auditoría en PDF (lo genera el backend) o Excel (se arma aquí con los datos ya cargados).
//   scope 'table'    → todas las entregas, con rango de fechas opcional
//   scope 'delivery' → una entrega (el PDF del backend filtra por zona y día; el Excel es exacto)
// Errores de validación: rangeInvalid, noDeliveries, deliveryRequired, notRegistered.
export class ExportDeliveryReport {
  constructor({ deliveryRepository, workbookWriter }) {
    this.deliveryRepository = deliveryRepository;
    this.workbookWriter = workbookWriter;
  }

  async execute({ scope, format, from = null, to = null, deliveries = [], detail = null, zoneName = null, labels, verifyBaseUrl = '' }) {
    if (!isRangeValid(from, to)) throw new Error('rangeInvalid');
    const stamp = new Date().toISOString().slice(0, 10);

    if (scope === 'delivery') {
      if (!detail) throw new Error('deliveryRequired');
      const base = 'entrega-' + detail.id.slice(0, 8) + '-' + stamp;
      if (format === 'xlsx') {
        return { blob: this.workbookWriter(deliverySheets(detail, zoneName, labels, verifyBaseUrl)), filename: base + '.xlsx' };
      }
      if (detail.deliveredAt === null) throw new Error('notRegistered');
      const day = new Date(detail.deliveredAt).toISOString().slice(0, 10);
      const blob = await this.deliveryRepository.downloadReport({ zoneId: detail.zoneId, from: day, to: day });
      return { blob, filename: base + '.pdf' };
    }

    const base = 'informe-auditoria-' + stamp;
    if (format === 'xlsx') {
      const rows = filterByRange(deliveries, from, to);
      if (rows.length === 0) throw new Error('noDeliveries');
      return { blob: this.workbookWriter([deliveriesSheet(rows, labels, verifyBaseUrl)]), filename: base + '.xlsx' };
    }
    const blob = await this.deliveryRepository.downloadReport({ from, to });
    return { blob, filename: base + '.pdf' };
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

// GET /deliveries/{id}: items [{ resourceId, quantity }], evidences [{ id, type, contentHash, capturedAt, location }],
// integrity { recordHash, anchorStatus, transactionHash, anchoredAt, attempts }. El nombre del recurso no viene
// (solo su id): se muestra cuando exista la pantalla de Inventario o si el backend lo agrega.
export function toDeliveryDetail(dto) {
  const integrity = dto.integrity ?? {};
  return new DeliveryDetail({
    id: dto.id,
    zoneId: dto.zoneId ?? null,
    planId: dto.distributionPlanId ?? null,
    status: statusOf(dto),
    deliveredAt: parseUtc(dto.deliveredAt),
    receivedAt: parseUtc(dto.receivedAt),
    recordHash: integrity.recordHash ?? null,
    transactionHash: integrity.transactionHash ?? null,
    anchoredAt: parseUtc(integrity.anchoredAt),
    attempts: integrity.attempts ?? null,
    items: (dto.items ?? []).map((item) => ({
      resourceId: item.resourceId ?? null,
      name: item.resourceName ?? item.name ?? null,
      quantity: item.quantity ?? null,
    })),
    evidences: (dto.evidences ?? []).map((evidence) => ({
      id: evidence.id ?? null,
      type: evidence.type ?? null,
      hash: evidence.contentHash ?? null,
      capturedAt: parseUtc(evidence.capturedAt),
      location: evidence.location ? { latitude: evidence.location.latitude, longitude: evidence.location.longitude } : null,
    })),
  });
}

// GET /deliveries/{id}/verify: { deliveryId, recordHash, anchoredHash, transactionHash, verified }
export function toVerificationResult(dto) {
  return new VerificationResult({
    deliveryId: dto.deliveryId,
    verified: dto.verified === true,
    recordHash: dto.recordHash ?? null,
    anchoredHash: dto.anchoredHash ?? null,
    transactionHash: dto.transactionHash ?? null,
  });
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

// Detalle con la forma real del backend: items solo con resourceId y quantity.
const detailOf = (dto) => {
  const registered = dto.status !== 'INITIATED';
  const at = (minutes) => new Date(Date.parse(dto.deliveredAt + 'Z') + minutes * 60000).toISOString().slice(0, 19);
  return {
    id: dto.id,
    distributionPlanId: 'pl-' + dto.id.slice(-4),
    zoneId: dto.zoneId,
    brigadeId: 'br-01',
    status: dto.status,
    registeredBy: 'us-01',
    deliveredAt: dto.deliveredAt,
    receivedAt: registered ? at(3) : null,
    items: [
      { resourceId: 'a1c16f79-9417-433c-9161-d3a1e8faa4a2', quantity: 50 },
      { resourceId: '7be20a41-3f55-47c0-8a6e-5d1c9e0f6b12', quantity: 120 },
    ],
    evidences: registered ? [
      { id: 'ev-1', type: 'PHOTO', contentHash: fakeHash('c31f', dto.id.slice(-4)).slice(2), capturedAt: dto.deliveredAt, location: { latitude: -11.9436, longitude: -76.7078 } },
      { id: 'ev-2', type: 'PHOTO', contentHash: fakeHash('9ab2', dto.id.slice(-4)).slice(2), capturedAt: dto.deliveredAt, location: { latitude: -11.9437, longitude: -76.7079 } },
    ] : [],
    integrity: {
      recordHash: registered ? fakeHash('852b', dto.id.slice(-4)).slice(2) : null,
      anchorStatus: dto.integrity.anchorStatus === 'ANCHORED' ? 'ANCHORED' : dto.integrity.anchorStatus,
      transactionHash: dto.integrity.transactionHash,
      anchoredAt: dto.status === 'CERTIFIED' ? at(4) : null,
      attempts: registered ? 1 : 0,
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
    const record = fakeHash('852b', dto.id.slice(-4)).slice(2);
    const tampered = deliveryId === 'dl-0003';
    return toVerificationResult({
      deliveryId, recordHash: record, anchoredHash: tampered ? fakeHash('0bad', 'f00d').slice(2) : record,
      transactionHash: dto.integrity.transactionHash, verified: !tampered,
    });
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
import { ExportDeliveryReport } from '../application/useCases/exportDeliveryReport.js';
import { createXlsxBlob } from '@shared/infrastructure/files/xlsxWriter.js';
import { env } from '@shared/infrastructure/config/env.js';

const deliveryRepository = env.useMocks ? new DeliveryMockRepository() : new DeliveryHttpRepository();

export const getDeliveryOverviewUseCase = new GetDeliveryOverview(deliveryRepository);
export const getDeliveryLedgerUseCase = new GetDeliveryLedger(deliveryRepository);
export const getDeliveryDetailUseCase = new GetDeliveryDetail(deliveryRepository);
export const verifyDeliveryUseCase = new VerifyDelivery(deliveryRepository);
export const downloadDeliveryReportUseCase = new DownloadDeliveryReport(deliveryRepository);
export const exportDeliveryReportUseCase = new ExportDeliveryReport({ deliveryRepository, workbookWriter: createXlsxBlob });
`);

/* ════════════════════════ PRESENTATION: HOOKS + UTILS ════════════════════════ */
write(TR + 'presentation/hooks/useExportDeliveryReport.js', String.raw`
import { useMutation } from '@tanstack/react-query';
import { exportDeliveryReportUseCase } from '../../infrastructure/container.js';
import { saveBlob } from '@shared/presentation/utils/saveBlob.js';

// mutate({ scope, format, from?, to?, deliveries?, detail?, zoneName?, labels, verifyBaseUrl }): arma el informe y lo descarga.
export function useExportDeliveryReport() {
  return useMutation({
    mutationFn: async (request) => {
      const { blob, filename } = await exportDeliveryReportUseCase.execute(request);
      saveBlob(blob, filename);
    },
  });
}
`);

write(TR + 'presentation/hooks/useDeliveryVerification.js', String.raw`
import { useQuery } from '@tanstack/react-query';
import { verifyDeliveryUseCase } from '../../infrastructure/container.js';

// Verificación pública de una entrega (sin sesión): se consulta al abrir la página. Sin reintentos
// automáticos: un 404 o un 503 es una respuesta, y la persona decide cuándo volver a intentar.
export function useDeliveryVerification(deliveryId) {
  return useQuery({
    queryKey: ['deliveries', 'verification', deliveryId],
    queryFn: () => verifyDeliveryUseCase.execute(deliveryId),
    enabled: Boolean(deliveryId),
    retry: false,
  });
}
`);

write(TR + 'presentation/utils/exportLabels.js', String.raw`
// Textos del Excel en el idioma de la interfaz.
export function buildExportLabels(t) {
  return {
    tableSheet: t('export.sheets.table'),
    summarySheet: t('export.sheets.summary'),
    itemsSheet: t('export.sheets.items'),
    evidenceSheet: t('export.sheets.evidence'),
    tableColumns: [
      t('export.columns.code'), t('export.columns.zone'), t('export.columns.status'),
      t('export.columns.delivered'), t('export.columns.transaction'), t('export.columns.verifyUrl'),
    ],
    status: (status) => t('ledger.status.' + status),
    fields: {
      field: t('export.fields.field'), value: t('export.fields.value'), code: t('export.columns.code'),
      zone: t('export.columns.zone'), status: t('export.columns.status'), delivered: t('export.fields.delivered'),
      received: t('export.fields.received'), anchored: t('export.fields.anchored'), recordHash: t('card.recordHash'),
      transaction: t('export.columns.transaction'), verifyUrl: t('export.columns.verifyUrl'),
      resource: t('export.fields.resource'), quantity: t('export.fields.quantity'), type: t('export.fields.type'),
      hash: t('export.fields.hash'), captured: t('export.fields.captured'), latitude: t('export.fields.latitude'),
      longitude: t('export.fields.longitude'),
    },
  };
}

const VALIDATION = ['rangeInvalid', 'noDeliveries', 'deliveryRequired', 'notRegistered'];

// El backend responde application/problem+json: se muestra su "detail" tal cual; si no hay, un texto según el caso.
export function exportErrorMessage(t, error) {
  if (!error) return null;
  if (VALIDATION.includes(error.message)) return t('export.errors.' + error.message);
  if (error.detail) return error.detail;
  return t('export.errors.generic');
}
`);

/* ════════════════════════ PRESENTATION: COMPONENTS ════════════════════════ */
write(TR + 'presentation/components/downloadReportDialog.jsx', String.raw`
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useExportDeliveryReport } from '../hooks/useExportDeliveryReport.js';
import { buildExportLabels, exportErrorMessage } from '../utils/exportLabels.js';

// Modal de descarga. scope 'table': informe de todas las entregas (rango de fechas opcional).
// scope 'delivery': informe de una sola entrega (sin rango).
export default function DownloadReportDialog({ scope, deliveries = [], detail = null, zoneName = null, onClose }) {
  const { t } = useTranslation('traceability');
  const [format, setFormat] = useState('pdf');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const mutation = useExportDeliveryReport();
  const firstRef = useRef(null);
  const isTable = scope === 'table';

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (event) => {
    event.preventDefault();
    mutation.mutate({
      scope, format, from: from || null, to: to || null, deliveries, detail, zoneName,
      labels: buildExportLabels(t), verifyBaseUrl: window.location.origin + '/public/verify/',
    }, { onSuccess: onClose });
  };

  const message = exportErrorMessage(t, mutation.error);
  const formats = [
    { value: 'pdf', title: t('export.formats.pdf'), hint: t(isTable ? 'export.formats.pdfHint' : 'export.formats.pdfDeliveryHint') },
    { value: 'xlsx', title: t('export.formats.xlsx'), hint: t(isTable ? 'export.formats.xlsxHint' : 'export.formats.xlsxDeliveryHint') },
  ];

  return (
    <>
      <div className="tl-backdrop" onClick={onClose} aria-hidden="true" />
      <form className="tl-dialog" role="dialog" aria-modal="true" aria-labelledby="tl-export-title" onSubmit={submit} noValidate>
        <h2 id="tl-export-title" className="tl-h2">{t(isTable ? 'export.titleTable' : 'export.titleDelivery')}</h2>
        {!isTable && zoneName && <p className="tl-sub">{zoneName}</p>}

        <fieldset className="tl-formats">
          <legend className="tl-label">{t('export.format')}</legend>
          {formats.map((option, index) => (
            <label key={option.value} className={'tl-format' + (format === option.value ? ' is-selected' : '')}>
              <input
                ref={index === 0 ? firstRef : null} type="radio" name="format" value={option.value}
                checked={format === option.value} onChange={() => setFormat(option.value)}
              />
              <span><strong>{option.title}</strong><small>{option.hint}</small></span>
            </label>
          ))}
        </fieldset>

        {isTable && (
          <fieldset className="tl-range">
            <legend className="tl-label">{t('export.range')}</legend>
            <div className="tl-range__row">
              <label className="tl-field"><span>{t('export.from')}</span><input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
              <label className="tl-field"><span>{t('export.to')}</span><input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
            </div>
            <p className="tl-note">{t('export.rangeHint')}</p>
          </fieldset>
        )}

        {message && <p className="tl-error" role="alert">{message}</p>}
        <div className="tl-dialog__actions">
          <button type="submit" className="tl-btn-lime" disabled={mutation.isPending}>
            {mutation.isPending ? t('export.generating') : t('export.download')}
          </button>
          <button type="button" className="tl-btn-outline" onClick={onClose} disabled={mutation.isPending}>{t('export.cancel')}</button>
        </div>
      </form>
    </>
  );
}
`);

write(TR + 'presentation/components/traceabilityCard.jsx', String.raw`
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDateTime, formatNumber, humanize, truncateHash } from '@shared/utils/formatters.js';
import { useVerifyDelivery } from '../hooks/useVerifyDelivery.js';

// Pasos del ciclo de vida: entregada en campo → registrada y sellada con hash → anclada en la blockchain.
function buildSteps(detail, t, lng) {
  const status = detail.status;
  const registered = status !== 'INITIATED';
  const when = (value) => (value ? formatDateTime(value, lng) : null);
  return [
    {
      key: 'delivered', state: registered ? 'done' : 'current', title: t('card.steps.delivered'),
      note: registered ? when(detail.deliveredAt) : t('card.steps.onTheWay'),
    },
    { key: 'sealed', state: registered ? 'done' : 'pending', title: t('card.steps.sealed'), note: registered ? when(detail.receivedAt) : t('card.steps.pending') },
    {
      key: 'anchored',
      state: status === 'CERTIFIED' ? 'done' : status === 'INITIATED' ? 'pending' : status === 'FAILED' ? 'warn' : 'current',
      title: t('card.steps.anchored'),
      note: status === 'CERTIFIED' ? when(detail.anchoredAt) ?? t('card.steps.confirmed')
        : status === 'REGISTERED' ? t('card.steps.anchoring')
        : status === 'FAILED' ? t('card.steps.retrying', { count: detail.attempts ?? 0 })
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

export default function TraceabilityCard({ detail, zoneName, onClose, onDownload }) {
  const { t, i18n } = useTranslation('traceability');
  const lng = i18n.resolvedLanguage;
  const verify = useVerifyDelivery();
  const [copied, setCopied] = useState(false);

  const data = detail.data;
  const publicUrl = data ? window.location.origin + '/public/verify/' + data.id : null;
  const location = data?.location ?? null;
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
        <button type="button" className="tl-icon-btn" onClick={onClose} aria-label={t('card.close')}>×</button>
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
                {data.items.map((item, index) => (
                  <li key={(item.resourceId ?? '') + index}>
                    <span>{item.name ?? t('card.resource', { id: item.resourceId ? item.resourceId.slice(0, 8) : index + 1 })}</span>
                    <strong>{item.quantity !== null ? formatNumber(item.quantity, lng) : '—'}</strong>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <span className="tl-label">{t('card.integrity')}</span>
            <dl className="tl-facts">
              <div><dt>{t('card.recordHash')}</dt><dd title={data.recordHash ?? ''}>{data.recordHash ? truncateHash(data.recordHash, 8, 6) : '—'}</dd></div>
              <div><dt>{t('card.evidences')}</dt><dd>{data.evidences.length}</dd></div>
              {location && (
                <div>
                  <dt>{t('card.gps')}</dt>
                  <dd>
                    <a
                      href={'https://www.openstreetmap.org/?mlat=' + location.latitude + '&mlon=' + location.longitude + '#map=17/' + location.latitude + '/' + location.longitude}
                      target="_blank" rel="noreferrer"
                    >
                      {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)} ↗
                    </a>
                  </dd>
                </div>
              )}
            </dl>
            {data.evidences.length > 0 && (
              <ul className="tl-evidence">
                {data.evidences.map((evidence, index) => (
                  <li key={evidence.id ?? index} title={evidence.hash ?? ''}>
                    <span>{evidence.type ? t('card.evidenceTypes.' + evidence.type, { defaultValue: humanize(evidence.type) }) : t('card.evidence')}</span>
                    <span>{evidence.hash ? truncateHash(evidence.hash, 6, 6) : '—'}</span>
                    <span>{evidence.capturedAt ? formatDateTime(evidence.capturedAt, lng) : ''}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="tl-verify">
            <span className="tl-label">{t('card.verify.title')}</span>
            <button
              type="button" className="tl-btn-outline" disabled={verify.isPending || data.status === 'INITIATED'}
              onClick={() => verify.mutate(data.id)}
            >
              {verify.isPending ? t('card.verify.checking') : t('card.verify.action')}
            </button>
            {verify.data?.verified && <p className="tl-result tl-result--ok" role="status">{t('card.verify.ok')}</p>}
            {verify.data && !verify.data.verified && (
              <div className="tl-result tl-result--bad" role="alert">
                <p>{t('card.verify.mismatch')}</p>
                <small>{t('card.verify.recomputed')}: {truncateHash(verify.data.recordHash, 8, 6)}</small>
                <small>{t('card.verify.onChain')}: {truncateHash(verify.data.anchoredHash, 8, 6)}</small>
              </div>
            )}
            {verify.error && <p className="tl-error" role="alert">{verifyMessage(t, verify.error)}</p>}
            <div className="tl-link">
              <span className="tl-link__url" title={publicUrl}>{publicUrl}</span>
              <button type="button" className="tl-link-btn" onClick={copy}>{copied ? t('card.copied') : t('card.copy')}</button>
              <a className="tl-link-btn" href={publicUrl} target="_blank" rel="noreferrer">{t('card.open')} ↗</a>
            </div>
          </section>

          <button type="button" className="tl-btn-outline" onClick={onDownload}>{t('card.download')}</button>
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
import { DeliveryTab, Period, countByTab, filterDeliveries } from '../../domain/services/filterDeliveries.js';
import { useDeliveryLedger } from '../hooks/useDeliveryLedger.js';
import { useDeliveryDetail } from '../hooks/useDeliveryDetail.js';
import LedgerToolbar from '../components/ledgerToolbar.jsx';
import LedgerTable from '../components/ledgerTable.jsx';
import TraceabilityCard from '../components/traceabilityCard.jsx';
import DownloadReportDialog from '../components/downloadReportDialog.jsx';
import '../styles/auditLedger.css';

const PAGE_SIZE = 10;

export default function AuditLedgerPage() {
  const { t } = useTranslation('traceability');
  const [searchParams, setSearchParams] = useSearchParams();

  const emergency = useActiveEmergency();
  const ranking = useZoneRanking(emergency.data?.id, { explainTop: 0, withPosition: false });
  const ledger = useDeliveryLedger({ zones: ranking.data });

  const [tab, setTab] = useState(DeliveryTab.ALL);
  const [period, setPeriod] = useState(Period.ALL);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(null); // null | 'table' | 'delivery'

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
        <button type="button" className="tl-btn-lime" disabled={loading || deliveries.length === 0} onClick={() => setExporting('table')}>
          {t('page.export')}
        </button>
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
          <TraceabilityCard
            key={selectedId} detail={detail} zoneName={selected?.zoneName}
            onClose={() => select(null)} onDownload={() => setExporting('delivery')}
          />
        )}
      </div>

      {exporting && (
        <DownloadReportDialog
          scope={exporting} deliveries={deliveries} detail={detail.data ?? null} zoneName={selected?.zoneName ?? null}
          onClose={() => setExporting(null)}
        />
      )}
    </div>
  );
}
`);

// Estilos: se agregan al final (ganan a los de la primera parte). Marcador para no duplicarlos.
const cssPath = TR + 'presentation/styles/auditLedger.css';
const cssMarker = '/* ── Ajustes: ficha compacta + modal de descarga ── */';
if (!readFileSync(cssPath, 'utf8').includes(cssMarker)) {
  writeFileSync(cssPath, readFileSync(cssPath, 'utf8').replace(/\s*$/, '\n') + String.raw`
${cssMarker}
.tl-layout.has-card { grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); }
.tl-card { position: sticky; top: 16px; max-height: calc(100vh - 32px); overflow-y: auto; gap: 14px; padding: 18px; overflow-x: hidden; }
.tl-card > * { min-width: 0; }
.tl-card__head { position: sticky; top: -18px; z-index: 1; margin: -18px -18px 0; padding: 18px 18px 12px; background: var(--cc-card); }
.tl-steps { gap: 14px; }
.tl-items li, .tl-facts div { min-width: 0; }
.tl-facts dd { min-width: 0; overflow-wrap: anywhere; text-align: right; }
.tl-facts a { color: var(--color-sky); }
.tl-evidence { gap: 6px; }
.tl-evidence li { display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: baseline; }
.tl-evidence li span:nth-child(2) { overflow: hidden; text-overflow: ellipsis; }
.tl-verify .tl-link { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; }
.tl-result small { display: block; margin-top: 4px; font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace; font-weight: 400; }
.tl-result p { margin: 0; }
a.tl-link-btn { text-decoration: underline; }

.tl-backdrop { position: fixed; inset: 0; z-index: 40; background: rgba(5, 5, 30, 0.6); }
.tl-dialog { position: fixed; z-index: 41; top: 50%; left: 50%; display: grid; gap: 14px; width: min(480px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow-y: auto; padding: 24px; border: 1px solid var(--cc-line); border-radius: 16px; background: var(--cc-card); transform: translate(-50%, -50%); }
.tl-dialog fieldset { display: grid; gap: 10px; margin: 0; padding: 0; border: 0; min-width: 0; }
.tl-dialog legend { padding: 0; }
.tl-format { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border: 1px solid var(--cc-line); border-radius: 12px; cursor: pointer; }
.tl-format.is-selected { border-color: var(--color-lime); background: rgba(190, 242, 100, 0.06); }
.tl-format input { margin-top: 4px; accent-color: var(--color-lime); }
.tl-format span { display: grid; gap: 2px; }
.tl-format small { color: var(--night-100); font-size: 0.8125rem; }
.tl-range__row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.tl-field { display: grid; gap: 6px; font-size: 0.8125rem; font-weight: 500; }
.tl-field input { height: 40px; padding: 0 12px; border: 1px solid var(--cc-line); border-radius: 10px; background: var(--cc-card-inner); color: #fff; font: inherit; color-scheme: dark; }
.tl-field input:focus-visible { outline: 2px solid var(--color-royal); }
.tl-dialog__actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 1100px) {
  .tl-layout.has-card { grid-template-columns: minmax(0, 1fr); }
  .tl-card { position: static; max-height: none; }
}
@media (max-width: 520px) {
  .tl-range__row, .tl-dialog__actions { grid-template-columns: 1fr; }
}
`);
  console.log('~ ' + cssPath);
}

/* ════════════════════════ PANTALLA PÚBLICA DE VERIFICACIÓN ════════════════════════ */
write(CT + 'presentation/pages/verifyDeliveryPage.jsx', String.raw`
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDeliveryVerification } from '@bc/traceability/presentation/hooks/useDeliveryVerification.js';
import '../styles/verifyDelivery.css';

// Pantalla pública (sin sesión): cualquier persona con el código de una entrega puede comprobar que su
// registro no fue alterado. Compara el hash recalculado hoy con el que está anclado en la blockchain.
export default function VerifyDeliveryPage() {
  const { t } = useTranslation('citizenTransparency');
  const { deliveryId } = useParams();
  const query = useDeliveryVerification(deliveryId);
  const result = query.data;
  const error = query.error;

  const state = query.isLoading ? 'loading'
    : result ? (result.verified ? 'verified' : 'mismatch')
    : error?.status === 404 ? 'notFound'
    : error?.status === 503 ? 'unavailable'
    : 'error';

  return (
    <div className="vd">
      <h1 className="vd-title">{t('verifyDelivery.title')}</h1>
      <p className="vd-lead">{t('verifyDelivery.lead')}</p>

      <section className={'vd-card vd-card--' + state} aria-live="polite" aria-busy={state === 'loading'}>
        {state === 'loading' && (
          <>
            <span className="vd-skel vd-skel--title" />
            <span className="vd-skel" />
          </>
        )}

        {state !== 'loading' && (
          <div className="vd-banner">
            <span className="vd-icon" aria-hidden="true">{state === 'verified' ? '✓' : state === 'mismatch' ? '!' : '?'}</span>
            <div>
              <h2>{t('verifyDelivery.states.' + state + '.title')}</h2>
              <p>{t('verifyDelivery.states.' + state + '.text')}</p>
            </div>
          </div>
        )}

        {(state === 'unavailable' || state === 'error') && (
          <button type="button" className="vd-btn" onClick={() => query.refetch()} disabled={query.isFetching}>
            {query.isFetching ? t('verifyDelivery.checking') : t('verifyDelivery.retry')}
          </button>
        )}

        {result && (
          <dl className="vd-facts">
            <div><dt>{t('verifyDelivery.code')}</dt><dd>{result.deliveryId}</dd></div>
            <div><dt>{t('verifyDelivery.recomputed')}</dt><dd>{result.recordHash ?? '—'}</dd></div>
            <div><dt>{t('verifyDelivery.anchored')}</dt><dd>{result.anchoredHash ?? '—'}</dd></div>
            {result.explorerUrl && (
              <div>
                <dt>{t('verifyDelivery.transaction')}</dt>
                <dd><a href={result.explorerUrl} target="_blank" rel="noreferrer">{t('verifyDelivery.viewTx')} ↗</a></dd>
              </div>
            )}
          </dl>
        )}

        {state === 'notFound' && <p className="vd-code">{t('verifyDelivery.code')}: <code>{deliveryId}</code></p>}
      </section>

      <p className="vd-privacy">{t('verifyDelivery.privacy')}</p>
    </div>
  );
}
`);

write(CT + 'presentation/styles/verifyDelivery.css', String.raw`
.vd { max-width: 720px; margin: 0 auto; padding: 40px 16px 64px; }
.vd-title { margin: 0 0 8px; font-size: 2rem; letter-spacing: -0.02em; }
.vd-lead { margin: 0 0 24px; color: #4a4f6a; }

.vd-card { display: grid; gap: 20px; padding: 24px; border: 1px solid #d9dcec; border-radius: 16px; background: #fff; box-shadow: 0 6px 24px rgba(32, 33, 100, 0.06); }
.vd-card--verified { border-color: #2fa36f; }
.vd-card--mismatch { border-color: #d4453b; }
.vd-banner { display: flex; align-items: flex-start; gap: 16px; }
.vd-banner h2 { margin: 0 0 4px; font-size: 1.25rem; }
.vd-banner p { margin: 0; color: #4a4f6a; }
.vd-icon { display: grid; place-items: center; flex: none; width: 48px; height: 48px; border-radius: 50%; background: #e8e9f4; color: #202164; font-size: 1.5rem; font-weight: 700; }
.vd-card--verified .vd-icon { background: #d9f4e7; color: #0f7a4d; }
.vd-card--mismatch .vd-icon { background: #fde0dd; color: #b3261e; }
.vd-card--unavailable .vd-icon, .vd-card--error .vd-icon { background: #fff1d6; color: #8a5a00; }

.vd-facts { display: grid; gap: 14px; margin: 0; padding-top: 4px; border-top: 1px solid #e6e8f3; }
.vd-facts div { display: grid; gap: 4px; padding-top: 14px; }
.vd-facts dt { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #5b6086; }
.vd-facts dd { margin: 0; font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace; font-size: 0.8125rem; overflow-wrap: anywhere; }
.vd-facts a { color: #202164; font-family: inherit; }
.vd-code { margin: 0; font-size: 0.875rem; color: #4a4f6a; }
.vd-code code { overflow-wrap: anywhere; }
.vd-privacy { margin: 20px 4px 0; font-size: 0.8125rem; color: #5b6086; }

.vd-btn { justify-self: start; min-height: 44px; padding: 0 20px; border: 0; border-radius: 10px; background: #202164; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
.vd-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.vd-btn:focus-visible { outline: 3px solid #85d5f6; outline-offset: 2px; }

.vd-skel { display: block; height: 18px; border-radius: 8px; background: linear-gradient(90deg, #eceef7, #f7f8fc, #eceef7); background-size: 200% 100%; animation: vd-shimmer 1.4s linear infinite; }
.vd-skel--title { height: 28px; width: 60%; }
@keyframes vd-shimmer { to { background-position: -200% 0; } }
`);

/* ════════════════════════ I18N ════════════════════════ */
mergeJson(TR + 'presentation/i18n/es.json', {
  page: { export: 'Exportar informe' },
  card: {
    steps: {
      delivered: 'Entregada en campo',
      sealed: 'Registrada y sellada con hash',
      retrying: 'El anclaje falló; se reintenta cada 5 minutos (intentos: {{count}})',
    },
    resource: 'Recurso {{id}}',
    gps: 'Ubicación (GPS)',
    evidence: 'Evidencia',
    evidenceTypes: { PHOTO: 'Foto', PDF: 'PDF', AUDIO: 'Audio' },
    verify: { recomputed: 'Recalculado', onChain: 'En blockchain' },
    open: 'Abrir',
    download: 'Descargar',
  },
  export: {
    titleTable: 'Descargar informe de auditoría',
    titleDelivery: 'Descargar informe de la entrega',
    format: 'Formato',
    formats: {
      pdf: 'PDF',
      pdfHint: 'Informe del backend con hash, transacción y estado de verificación de cada entrega.',
      pdfDeliveryHint: 'Informe de la zona del día de la entrega: si hubo varias entregas ese día, se incluyen todas.',
      xlsx: 'Excel (.xlsx)',
      xlsxHint: 'Una fila por entrega, lista para filtrar y ordenar.',
      xlsxDeliveryHint: 'Solo esta entrega: resumen, recursos y evidencias en hojas separadas.',
    },
    range: 'Rango de fechas (opcional)',
    from: 'Desde',
    to: 'Hasta',
    rangeHint: 'Se incluyen ambos días. Déjalo vacío para exportar todo el período.',
    download: 'Descargar',
    generating: 'Generando...',
    cancel: 'Cancelar',
    sheets: { table: 'Entregas', summary: 'Entrega', items: 'Recursos', evidence: 'Evidencias' },
    columns: {
      code: 'Código público', zone: 'Zona', status: 'Estado', delivered: 'Fecha de entrega',
      transaction: 'Hash de transacción', verifyUrl: 'Enlace de verificación',
    },
    fields: {
      field: 'Campo', value: 'Valor', delivered: 'Entregada', received: 'Registrada', anchored: 'Anclada',
      resource: 'Recurso (id)', quantity: 'Cantidad', type: 'Tipo', hash: 'Hash del archivo', captured: 'Capturada',
      latitude: 'Latitud', longitude: 'Longitud',
    },
    errors: {
      rangeInvalid: 'La fecha final no puede ser anterior a la inicial.',
      noDeliveries: 'No hay entregas en ese rango de fechas.',
      deliveryRequired: 'Todavía no se cargó la entrega. Inténtalo de nuevo.',
      notRegistered: 'La entrega aún no se registró: el PDF estará disponible cuando se entregue.',
      generic: 'No se pudo generar el informe.',
    },
  },
});

mergeJson(TR + 'presentation/i18n/en.json', {
  page: { export: 'Export report' },
  card: {
    steps: {
      delivered: 'Delivered in the field',
      sealed: 'Registered and sealed with a hash',
      retrying: 'Anchoring failed; retried every 5 minutes (attempts: {{count}})',
    },
    resource: 'Resource {{id}}',
    gps: 'Location (GPS)',
    evidence: 'Evidence',
    evidenceTypes: { PHOTO: 'Photo', PDF: 'PDF', AUDIO: 'Audio' },
    verify: { recomputed: 'Recomputed', onChain: 'On blockchain' },
    open: 'Open',
    download: 'Download',
  },
  export: {
    titleTable: 'Download audit report',
    titleDelivery: 'Download delivery report',
    format: 'Format',
    formats: {
      pdf: 'PDF',
      pdfHint: "Backend report with each delivery's hash, transaction and verification status.",
      pdfDeliveryHint: "Report of the delivery's zone on the delivery day: if there were several deliveries that day, all are included.",
      xlsx: 'Excel (.xlsx)',
      xlsxHint: 'One row per delivery, ready to filter and sort.',
      xlsxDeliveryHint: 'Only this delivery: summary, resources and evidence in separate sheets.',
    },
    range: 'Date range (optional)',
    from: 'From',
    to: 'To',
    rangeHint: 'Both days are included. Leave it empty to export the whole period.',
    download: 'Download',
    generating: 'Generating...',
    cancel: 'Cancel',
    sheets: { table: 'Deliveries', summary: 'Delivery', items: 'Resources', evidence: 'Evidence' },
    columns: {
      code: 'Public code', zone: 'Zone', status: 'Status', delivered: 'Delivery date',
      transaction: 'Transaction hash', verifyUrl: 'Verification link',
    },
    fields: {
      field: 'Field', value: 'Value', delivered: 'Delivered', received: 'Registered', anchored: 'Anchored',
      resource: 'Resource (id)', quantity: 'Quantity', type: 'Type', hash: 'File hash', captured: 'Captured',
      latitude: 'Latitude', longitude: 'Longitude',
    },
    errors: {
      rangeInvalid: 'The end date cannot be before the start date.',
      noDeliveries: 'There are no deliveries in that date range.',
      deliveryRequired: 'The delivery has not loaded yet. Try again.',
      notRegistered: 'The delivery is not registered yet: the PDF will be available once it is delivered.',
      generic: 'Could not generate the report.',
    },
  },
});

mergeJson(CT + 'presentation/i18n/es.json', {
  verifyDelivery: {
    title: 'Verificar entrega',
    lead: 'Comprueba que el registro de una entrega de ayuda no fue alterado desde que se anotó en la blockchain.',
    code: 'Código de la entrega',
    recomputed: 'Hash recalculado hoy',
    anchored: 'Hash anclado en la blockchain',
    transaction: 'Transacción',
    viewTx: 'Ver en Etherscan',
    checking: 'Verificando...',
    retry: 'Volver a intentar',
    privacy: 'Esta verificación no muestra datos personales: solo compara huellas digitales del registro de la entrega.',
    states: {
      verified: { title: 'Entrega verificada', text: 'El registro actual coincide con el que se anotó en la blockchain: no fue alterado.' },
      mismatch: { title: 'El registro no coincide', text: 'El registro actual es distinto al que se anotó en la blockchain. Los datos pudieron cambiar después de la entrega.' },
      notFound: { title: 'No encontramos esta entrega', text: 'No hay una entrega registrada con este código. Revisa que el enlace esté completo.' },
      unavailable: { title: 'No pudimos consultar la blockchain', text: 'La red no responde en este momento. Inténtalo de nuevo en unos minutos.' },
      error: { title: 'No se pudo verificar', text: 'Ocurrió un problema al consultar la entrega. Inténtalo nuevamente.' },
    },
  },
});

mergeJson(CT + 'presentation/i18n/en.json', {
  verifyDelivery: {
    title: 'Verify delivery',
    lead: 'Check that the record of an aid delivery has not been altered since it was written to the blockchain.',
    code: 'Delivery code',
    recomputed: 'Hash recomputed today',
    anchored: 'Hash anchored on the blockchain',
    transaction: 'Transaction',
    viewTx: 'View on Etherscan',
    checking: 'Verifying...',
    retry: 'Try again',
    privacy: 'This check shows no personal data: it only compares digital fingerprints of the delivery record.',
    states: {
      verified: { title: 'Delivery verified', text: 'The current record matches the one written to the blockchain: it was not altered.' },
      mismatch: { title: 'The record does not match', text: 'The current record differs from the one written to the blockchain. The data may have changed after the delivery.' },
      notFound: { title: 'We could not find this delivery', text: 'There is no delivery registered with this code. Check that the link is complete.' },
      unavailable: { title: 'We could not reach the blockchain', text: 'The network is not answering right now. Try again in a few minutes.' },
      error: { title: 'Could not verify', text: 'There was a problem checking the delivery. Please try again.' },
    },
  },
});

console.log('\nListo. Reinicia "npm run dev". Prueba: Trazabilidad → una entrega → Descargar; y abre el enlace público de la ficha.');
