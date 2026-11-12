import { formatNumber, humanize } from '@shared/utils/formatters.js';

export const categoryLabel = (t, category) => (category ? t('inventory.categories.' + category, { defaultValue: humanize(category) }) : '—');
export const levelLabel = (t, level) => t('inventory.levels.' + level);
export const quantity = (value, unit, lng) => formatNumber(value, lng) + (unit ? ' ' + unit : '');

const VALIDATION = ['nameRequired', 'categoryRequired', 'unitRequired', 'minimumInvalid', 'resourceRequired', 'quantityInvalid', 'reasonRequired', 'exceedsAvailable'];

// El backend responde application/problem+json: se muestra su "detail" tal cual; si no hay, un texto según el caso.
export function inventoryErrorMessage(t, error) {
  if (!error) return null;
  if (VALIDATION.includes(error.message)) return t('inventory.errors.' + error.message);
  if (error.detail) return error.detail;
  if (error.status === 403) return t('inventory.errors.forbidden');
  return t('inventory.errors.generic');
}
