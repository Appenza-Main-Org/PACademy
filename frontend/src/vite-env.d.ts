/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_USE_MOCKS?: string;
  readonly VITE_PROD_ADMIN_API_BASE_URL?: string;
  readonly VITE_PROD_APPLICANT_API_BASE_URL?: string;
  readonly VITE_PROD_USE_MOCKS?: string;
  readonly VITE_STAGING_ADMIN_API_BASE_URL?: string;
  readonly VITE_STAGING_APPLICANT_API_BASE_URL?: string;
  readonly VITE_STAGING_USE_MOCKS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
