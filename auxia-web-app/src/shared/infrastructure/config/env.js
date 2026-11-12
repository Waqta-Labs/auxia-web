export const env = Object.freeze({
  apiUrl: import.meta.env.VITE_API_URL,
  // true (por defecto): datos de prueba. Poner VITE_USE_MOCKS=false para usar el backend real.
  useMocks: import.meta.env.VITE_USE_MOCKS !== 'false',
  // Página de presentación de AuxIA (enlace "Ir al sitio" de las pantallas públicas).
  landingUrl: import.meta.env.VITE_LANDING_URL || 'https://site-two-mu-26.vercel.app',
});
