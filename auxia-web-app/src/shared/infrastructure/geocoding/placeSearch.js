// Búsqueda de lugares con Nominatim (OpenStreetMap): sirve para ubicar bien una zona antes de registrarla.
// Solo se consulta cuando la persona lo pide (Enter): el servicio público admite poco tráfico.
const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

// "-11.94, -76.69" -> { lat, lng } (null si no son coordenadas válidas).
export function parseCoordinates(text) {
  const match = String(text).trim().match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 ? { lat, lng } : null;
}

export async function searchPlaces(query, { language = 'es', signal } = {}) {
  const url = ENDPOINT + '?format=jsonv2&limit=5&accept-language=' + encodeURIComponent(language) + '&q=' + encodeURIComponent(query);
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('placeSearch ' + response.status);
  const items = await response.json();
  return items.map((item) => ({ label: item.display_name, lat: Number(item.lat), lng: Number(item.lon) }));
}
