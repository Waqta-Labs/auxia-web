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

// ── Rango de fechas ──
// Un rango es válido si no termina antes de empezar; cualquiera de los dos extremos puede faltar.
export const isRangeValid = (from, to) => !from || !to || from <= to;

// Entregas con fecha de entrega dentro del rango (ambos días incluidos). Sin rango, todas.
export function filterByRange(deliveries, from, to) {
  if (!from && !to) return deliveries;
  const start = from ? Date.parse(from + 'T00:00:00Z') : -Infinity;
  const end = to ? Date.parse(to + 'T23:59:59.999Z') : Infinity;
  return deliveries.filter((d) => d.deliveredAt !== null && d.deliveredAt >= start && d.deliveredAt <= end);
}
