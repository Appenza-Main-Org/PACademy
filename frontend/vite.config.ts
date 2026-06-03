import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const adminProxyTarget = env.VITE_DEV_ADMIN_PROXY_TARGET || 'http://localhost:5101';
  const applicantProxyTarget = env.VITE_DEV_APPLICANT_PROXY_TARGET || adminProxyTarget;

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      open: true,
      proxy: {
        '/api/applicant': {
          target: applicantProxyTarget,
          changeOrigin: true,
        },
        '/api': {
          target: adminProxyTarget,
          changeOrigin: true,
        },
        '/v1': {
          target: adminProxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
