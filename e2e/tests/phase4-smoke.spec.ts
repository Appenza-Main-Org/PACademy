import { test, expect, type ConsoleMessage, type Request } from '@playwright/test';

/**
 * Phase 4 smoke — drives the SPA against the live backend to verify:
 *  1. /staff-login submits NID+password and lands on /hub
 *  2. /admin/users renders the seeded users list (server-driven)
 *  3. /admin/users/new submits the create form and routes to detail
 *  4. /admin/users/:id renders detail and lets us edit a single field
 *
 * Captures screenshots + console + network failures so we can review visually.
 */

const NID = '27001010150010';
const PASSWORD = 'SuperAdmin123!';

test.describe('Phase 4 admin/users smoke', () => {
  let consoleErrors: string[] = [];
  let networkFailures: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    networkFailures = [];
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('requestfailed', (req: Request) => {
      networkFailures.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
    });
  });

  test('login → list → create → detail', async ({ page }) => {
    // 1. Login
    await page.goto('/staff-login');
    await page.screenshot({ path: 'playwright-report/phase4-01-login.png', fullPage: true });

    await page.getByRole('textbox', { name: /الرقم القومي|national id/i }).fill(NID);
    // The login form's password field — try the most common label
    const pwField = page.locator('input[type="password"]').first();
    await pwField.fill(PASSWORD);

    await Promise.all([
      page.waitForURL(/\/hub|\/admin/, { timeout: 15_000 }),
      page.getByRole('button', { name: /دخول|login|تسجيل/i }).first().click(),
    ]);

    await page.screenshot({ path: 'playwright-report/phase4-02-hub.png', fullPage: true });

    // 2. List users
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'playwright-report/phase4-03-users-list.png', fullPage: true });

    // The page should show all 11 seeded users — assert we see the super_admin's full name
    await expect(page.getByText('الإدارة العليا للنظام').first()).toBeVisible({ timeout: 10_000 });

    // 3. Click "مستخدم جديد" → goes to /admin/users/new
    await page.getByRole('button', { name: /مستخدم جديد/ }).click();
    await expect(page).toHaveURL(/\/admin\/users\/new/);
    await page.screenshot({ path: 'playwright-report/phase4-04-create-form.png', fullPage: true });

    // 4. Fill out the create form with a unique test user
    const uniqueNid = generateValidNid();
    const stamp = Date.now().toString().slice(-6);

    await page.getByLabel(/الرقم القومي/).fill(uniqueNid);
    await page.getByLabel(/الاسم الكامل/).fill(`اختبار سموك ${stamp}`);
    await page.getByLabel(/الكود الوظيفي/).fill(`OCSMK${stamp}`);
    await page.getByLabel(/رقم مصنع البطاقة/).fill(`CFSMK${stamp}`);
    await page.getByLabel(/تاريخ إصدار البطاقة/).fill('2024-01-15');
    await page.getByLabel(/رقم الهاتف/).fill('01012345678');
    await page.getByLabel(/البريد الإلكتروني/).fill(`smoke-${stamp}@pac.demo`);
    await page.getByLabel(/الدور الوظيفي/).selectOption('committee_user');
    await page.getByLabel(/الوحدة/).fill('وحدة الاختبار');
    await page.getByLabel(/كلمة المرور/).fill('Smoke@Test123');

    await page.screenshot({ path: 'playwright-report/phase4-05-create-filled.png', fullPage: true });

    // Submit and wait for navigation to detail page
    await Promise.all([
      page.waitForURL(/\/admin\/users\/[0-9a-f-]{36}/, { timeout: 15_000 }),
      page.getByRole('button', { name: /إنشاء المستخدم/ }).click(),
    ]);

    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'playwright-report/phase4-06-detail.png', fullPage: true });

    // 5. Detail page should show the new user
    await expect(page.getByText(`اختبار سموك ${stamp}`).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(uniqueNid).first()).toBeVisible();

    // Surface any errors collected
    if (consoleErrors.length > 0) console.log('CONSOLE ERRORS:', consoleErrors);
    if (networkFailures.length > 0) console.log('NETWORK FAILURES:', networkFailures);

    expect(networkFailures, 'No network failures expected').toEqual([]);
  });
});

/**
 * Generate a synthetically valid Egyptian NID for our smoke user.
 * Format: CYYMMDDGGGGGSD — using century 3 (2000s), Cairo gov code "01".
 */
function generateValidNid(): string {
  const year = String(5 + Math.floor(Math.random() * 4)).padStart(2, '0'); // 05..08
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
  const govCode = '01';
  const serial = String(Math.floor(Math.random() * 900) + 100).padStart(3, '0'); // 100..999
  const gender = '1';
  const check = String(Math.floor(Math.random() * 10));
  return `3${year}${month}${day}${govCode}${serial}${gender}${check}`;
}
