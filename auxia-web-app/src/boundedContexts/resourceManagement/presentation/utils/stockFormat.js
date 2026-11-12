import { formatNumber, humanize } from '@shared/utils/formatters.js';

export const categoryLabel = (t, category) => (category ? t('inventory.categories.' + category, { defaultValue: humanize(category) }) : '—');
export const unitLabel = (t, unit) => t('inventory.units.' + unit, { defaultValue: humanize(unit) });
export const levelLabel = (t, level) => t('inventory.levels.' + level);

// Símbolo corto de la unidad (UNIT, KG, LITER, KIT); una unidad desconocida se muestra tal cual.
const UNIT_SYMBOLS = { KG: 'kg', LITER: 'L', KIT: 'kits' };
export const unitSymbol = (unit, lng) => (unit === 'UNIT' ? (lng === 'en' ? 'units' : 'unid.') : UNIT_SYMBOLS[unit] ?? unit ?? '');
export const quantity = (value, unit, lng) => formatNumber(value, lng) + (unit ? ' ' + unitSymbol(unit, lng) : '');

const VALIDATION = ['nameRequired', 'nameTooLong', 'categoryRequired', 'unitRequired', 'minimumInvalid', 'resourceRequired', 'quantityInvalid', 'reasonRequired', 'reasonTooLong', 'exceedsAvailable'];

// El backend responde application/problem+json: se muestra su "detail" tal cual; si no hay, un texto según el caso.
export function inventoryErrorMessage(t, error) {
  if (!error) return null;
  if (VALIDATION.includes(error.message)) return t('inventory.errors.' + error.message);
  if (error.detail) return error.detail;
  if (error.status === 403) return t('inventory.errors.forbidden');
  return t('inventory.errors.generic');
}
