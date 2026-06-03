/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_USE_MOCKS?: string;
  readonly VITE_PROD_ADMIN_API_BASE_URL?: string;
  readonly VITE_PROD_APPLICANT_API_BASE_URL?: string;
  readonly VITE_PROD_USE_MOCKS?: string;
  readonly VITE_PROD_DEMO_BYPASS?: string;
  readonly VITE_PROD_USE_APPLICANT_AUTH_BACKEND?: string;
  readonly VITE_STAGING_ADMIN_API_BASE_URL?: string;
  readonly VITE_STAGING_APPLICANT_API_BASE_URL?: string;
  readonly VITE_STAGING_USE_MOCKS?: string;
  readonly VITE_STAGING_DEMO_BYPASS?: string;
  readonly VITE_STAGING_USE_APPLICANT_AUTH_BACKEND?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
