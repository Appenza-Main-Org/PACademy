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
        /* Boundary-aware so /api/applicants (admin list) is NOT captured —
         * only /api/applicant and /api/applicant/* go to the applicant API. */
        '^/api/applicant(/|$)': {
          target: applicantProxyTarget,
          changeOrigin: true,
        },
        /* The applicant API also serves un-prefixed routes (/applicant/auth,
         * /applicant/draft, …) which collide with the SPA's /applicant pages.
         * Proxy fetch/JSON traffic to the backend but let browser navigations
         * (Accept: text/html) fall through to the SPA so deep links keep
         * working in dev. */
        '/applicant': {
          target: applicantProxyTarget,
          changeOrigin: true,
          bypass: (req) => (req.headers.accept?.includes('text/html') ? '/index.html' : undefined),
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
