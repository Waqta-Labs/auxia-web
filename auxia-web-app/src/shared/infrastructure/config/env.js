export const env = Object.freeze({
  apiUrl: import.meta.env.VITE_API_URL,
  // true (por defecto): datos de prueba. Poner VITE_USE_MOCKS=false para usar el backend real.
  useMocks: import.meta.env.VITE_USE_MOCKS !== 'false',
  // Página de presentación de AuxIA (enlace "Ir al sitio" de las pantallas públicas).
  landingUrl: import.meta.env.VITE_LANDING_URL || 'https://site-two-mu-26.vercel.app',
  // Mapa propio: los límites del Perú vienen dentro del proyecto. Teselas externas SOLO si defines VITE_MAP_TILES_URL
  // (plantilla con {z}/{x}/{y}; {s} = a|b|c y {r} = @2x); en ese caso ajusta también VITE_MAP_ATTRIBUTION.
  mapTilesUrl: import.meta.env.VITE_MAP_TILES_URL || '',
  mapAttribution: import.meta.env.VITE_MAP_ATTRIBUTION || 'Límites: peru-geojson (MPL-2.0)',
});
