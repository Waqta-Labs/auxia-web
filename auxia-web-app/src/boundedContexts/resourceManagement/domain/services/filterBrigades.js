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
