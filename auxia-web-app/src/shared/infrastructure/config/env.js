export const env = Object.freeze({
  apiUrl: import.meta.env.VITE_API_URL,
  // true (por defecto): datos de prueba. Poner VITE_USE_MOCKS=false para usar el backend real.
  useMocks: import.meta.env.VITE_USE_MOCKS !== 'false',
});
