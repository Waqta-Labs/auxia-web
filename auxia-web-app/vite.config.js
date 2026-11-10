import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const r = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@app': r('./src/app'),
      '@bc': r('./src/boundedContexts'),
      '@shared': r('./src/shared'),
      '@i18n': r('./src/i18n'),
      '@assets': r('./src/assets'),
    },
  },
});
