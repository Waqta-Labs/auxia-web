// Conteos del impacto en la población (POST /emergencies/{id}/zones y PATCH /zones/{id}/population-impact).
export const IMPACT_FIELDS = ['population', 'familiesAffected', 'peopleAffected', 'children', 'elderlyPeople', 'disabledPeople'];

const MAX_COUNT = 2147483647;

// values: { campo: '600', ... } (texto de los inputs). Devuelve solo los campos llenados, como enteros >= 0.
export function parseImpact(values = {}) {
  const impact = {};
  for (const field of IMPACT_FIELDS) {
    const raw = values[field];
    if (raw === '' || raw === null || raw === undefined) continue;
    const count = Number(raw);
    if (!Number.isInteger(count) || count < 0 || count > MAX_COUNT) throw new Error('countInvalid');
    impact[field] = count;
  }
  return impact;
}
