import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      // SQL Server + API must be running before E2E tests.
      // In CI: docker compose up -d sqlserver api && wait for healthy.
      // Locally: run `docker compose up` in backend/ manually.
      command: process.env['CI']
        ? 'docker compose --project-directory ../backend up -d sqlserver api'
        : 'echo "Ensure backend/docker compose is running before E2E tests"',
      url: 'http://localhost:8080/health',
      reuseExistingServer: true,
      timeout: 90_000,
    },
    {
      command: 'npm --prefix ../frontend run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env['CI'],
    },
  ],
});
