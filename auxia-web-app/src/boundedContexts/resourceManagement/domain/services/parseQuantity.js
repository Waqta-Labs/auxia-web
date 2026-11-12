// Cantidad escrita por la persona ("12"): entero mayor que 0 (el backend la recibe como int32), o null si no es válida.
export function parsePositive(value) {
  const text = String(value ?? '').trim();
  const n = Number(text);
  return /^\d+$/.test(text) && Number.isSafeInteger(n) && n > 0 && n <= 2147483647 ? n : null;
}
