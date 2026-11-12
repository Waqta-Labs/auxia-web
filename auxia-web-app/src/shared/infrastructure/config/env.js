export const env = Object.freeze({
  apiUrl: import.meta.env.VITE_API_URL,
  // true (por defecto): datos de prueba. Poner VITE_USE_MOCKS=false para usar el backend real.
  useMocks: import.meta.env.VITE_USE_MOCKS !== 'false',
  // Página de presentación de AuxIA (enlace "Ir al sitio" de las pantallas públicas).
  landingUrl: import.meta.env.VITE_LANDING_URL || 'https://site-two-mu-26.vercel.app',
  // Teselas del mapa propio: datos de OpenStreetMap con estilo oscuro. Se puede cambiar con VITE_MAP_TILES_URL
  // (plantilla con {z}/{x}/{y}; {s} = a|b|c y {r} = @2x en pantallas densas).
  mapTilesUrl: import.meta.env.VITE_MAP_TILES_URL || 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  mapAttribution: import.meta.env.VITE_MAP_ATTRIBUTION || '© OpenStreetMap contributors © CARTO',
});
