import { ZoneStatus } from '../enums/zoneStatus.js';

export const ZoneTab = Object.freeze({ ALL: 'all', CRITICAL: 'critical', UNSCORED: 'unscored', SERVED: 'served' });

const tabPredicates = {
  [ZoneTab.ALL]: () => true,
  [ZoneTab.CRITICAL]: (zone) => zone.isCritical,
  [ZoneTab.UNSCORED]: (zone) => zone.urgencyScore === null,
  [ZoneTab.SERVED]: (zone) => zone.status === ZoneStatus.SERVED,
};

export const EMPTY_ZONE_FILTERS = Object.freeze({ query: '', minScore: '', maxScore: '', need: '', sort: '' });

// Sin tildes ni mayúsculas, para que "nana" encuentre "Ñaña".
const fold = (text) => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const toBound = (value) =>
  value === '' || value === null || value === undefined || Number.isNaN(Number(value)) ? null : Number(value);

export function countByTab(zones) {
  return Object.fromEntries(Object.entries(tabPredicates).map(([tab, test]) => [tab, zones.filter(test).length]));
}

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

// sort '' = orden del ranking (por urgencia); 'nameAsc' = A → Z; 'nameDesc' = Z → A.
function sortZones(zones, sort) {
  if (sort !== 'nameAsc' && sort !== 'nameDesc') return zones;
  const direction = sort === 'nameDesc' ? -1 : 1;
  return [...zones].sort((a, b) => direction * collator.compare(a.name, b.name));
}

// Filtra el ranking (ya ordenado por urgencia) y, si se pide, lo ordena por nombre.
export function filterZones(zones, { tab = ZoneTab.ALL, query = '', minScore = '', maxScore = '', need = '', sort = '' } = {}) {
  const inTab = tabPredicates[tab] ?? tabPredicates[ZoneTab.ALL];
  const text = fold(query.trim());
  const min = toBound(minScore);
  const max = toBound(maxScore);

  const result = zones.filter((zone) => {
    if (!inTab(zone)) return false;
    if (text && !fold(zone.name).includes(text) && !zone.id.toLowerCase().startsWith(text)) return false;
    if (need && !zone.needs.includes(need)) return false;
    if (min !== null || max !== null) {
      if (zone.urgencyScore === null) return false; // sin puntaje no entra en un rango de score
      if (min !== null && zone.urgencyScore < min) return false;
      if (max !== null && zone.urgencyScore > max) return false;
    }
    return true;
  });
  return sortZones(result, sort);
}
