import { test as base, type Page } from '@playwright/test';

export type RoleName =
  | 'super_admin'
  | 'committee_admin'
  | 'committee_user'
  | 'medical_admin'
  | 'medical_doctor'
  | 'investigator'
  | 'board_admin'
  | 'exams_admin'
  | 'biometric_user'
  | 'records_clerk'
  | 'applicant';

/**
 * Demo passwords from appsettings.Development.json — injected via env vars.
 * CI should set DEMO_PASSWORD_<ROLE> (uppercased, hyphens → underscores).
 */
function getDemoPassword(role: RoleName): string {
  const envKey = `DEMO_PASSWORD_${role.toUpperCase()}`;
  return process.env[envKey] ?? `${role.charAt(0).toUpperCase()}${role.slice(1).replace(/_./g, m => m[1].toUpperCase())}123!`;
}

const SEEDED_NATIONAL_IDS: Record<RoleName, string> = {
  super_admin: '27001010112341',
  committee_admin: '27102020213561',
  committee_user: '27203030314781',
  medical_admin: '27304040415901',
  medical_doctor: '27405050517121',
  investigator: '27506060618341',
  board_admin: '27607070719561',
  exams_admin: '27708080820781',
  biometric_user: '27809090921901',
  records_clerk: '27910101023121',
  applicant: '27001011124341',
};

export interface AuthFixtures {
  /** Signed-in page as the given role. */
  signedInPage: Page;
  signInAs: (role: RoleName) => Promise<Page>;
}

export const test = base.extend<AuthFixtures>({
  signedInPage: async ({ page }, use) => {
    await signIn(page, 'super_admin');
    await use(page);
  },

  signInAs: async ({ browser }, use) => {
    await use(async (role: RoleName) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await signIn(page, role);
      return page;
    });
  },
});

async function signIn(page: Page, role: RoleName): Promise<void> {
  const apiBase = process.env.API_BASE_URL ?? 'http://localhost:5000';
  const nationalId = SEEDED_NATIONAL_IDS[role];
  const password = getDemoPassword(role);

  const resp = await page.request.post(`${apiBase}/auth/login`, {
    data: { nationalId, password },
  });

  if (!resp.ok()) {
    throw new Error(`Sign-in failed for role ${role}: ${resp.status()} ${await resp.text()}`);
  }
}

export { expect } from '@playwright/test';
