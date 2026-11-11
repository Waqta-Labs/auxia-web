// Convierte un error de axios (el backend responde application/problem+json) en un Error con
// "status" y "detail" (texto listo para mostrar al usuario).
export function toApiError(error) {
  const data = error.response?.data;
  const detail = typeof data?.detail === 'string' ? data.detail : null;
  const apiError = new Error(detail ?? data?.title ?? error.message);
  apiError.status = error.response?.status ?? null;
  apiError.detail = detail;
  apiError.isNetwork = !error.response;
  return apiError;
}
