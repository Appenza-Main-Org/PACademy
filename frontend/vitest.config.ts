import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  define: {
    // Tests default to demo mode so services use MOCK paths.
    // Tests that exercise real-backend wiring stub apiClient / use MSW.
    'import.meta.env.VITE_DEMO_MODE': JSON.stringify('true'),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 80,
        branches: 75,
      },
    },
  },
});
