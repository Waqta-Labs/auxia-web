// Cantidad escrita por la persona ("12", "12,5"): número mayor que 0, o null si no es válida.
export function parsePositive(value) {
  const text = String(value ?? '').trim();
  const n = Number(text.replace(',', '.'));
  return text !== '' && Number.isFinite(n) && n > 0 ? n : null;
}
