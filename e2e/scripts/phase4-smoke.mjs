// Standalone Playwright script — bypasses the test runner's webServer hook.
// Drives the SPA at localhost:5173 against the API at localhost:8080.
// Run from e2e/: `node scripts/phase4-smoke.mjs`
//
// Covers:
//   A. Login → list → create → detail
//   B. Edit-in-place drawer (non-role field)
//   C. FR-C06 role-change session revocation (cross-context verification)

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const NID = '27001010150010';
const PASSWORD = 'SuperAdmin123!';
const BASE = 'http://localhost:5173';
const API = 'http://localhost:8080';
const OUT = 'playwright-report/phase4';
const TEST_USER_PASSWORD = 'Smoke@Test123';

// Synthetically valid Egyptian NID — century 3 (2000s), Cairo gov "01"
function generateValidNid() {
  const yy = String(5 + Math.floor(Math.random() * 4)).padStart(2, '0');
  const mm = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
  const dd = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
  const serial = String(100 + Math.floor(Math.random() * 900)).padStart(3, '0');
  return `3${yy}${mm}${dd}01${serial}10`;
}

async function shoot(page, name) {
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
  console.log(`  📸 ${name}.png`);
}

async function signIn(page, nationalId, password) {
  await page.goto(`${BASE}/staff-login`, { waitUntil: 'networkidle' });
  const nidInput = page.locator('input[inputmode="numeric"], input[name*="ationalId" i]').first();
  await nidInput.fill(nationalId);
  await page.locator('input[type="password"]').first().fill(password);
  await Promise.all([
    page.waitForURL(/\/(hub|admin|committee|board|investigations|medical|barcode|biometric|question-bank)/, { timeout: 15_000 }),
    page.locator('button[type="submit"]').first().click(),
  ]);
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const adminCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await adminCtx.newPage();

  const consoleErrors = [];
  const networkFailures = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('requestfailed', (req) => {
    networkFailures.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
  });

  let userCtx;
  let testUserId = null;
  let uniqueNid = null;

  try {
    // ==================================================================
    // PHASE A — Login → list → create → detail
    // ==================================================================
    console.log('\n━━━ PHASE A: Login → list → create → detail ━━━');

    console.log('▶ A1. Navigate to /staff-login');
    await page.goto(`${BASE}/staff-login`, { waitUntil: 'networkidle' });
    await shoot(page, '01-login-empty');

    console.log('▶ A2. Fill credentials and submit');
    await page.locator('input[inputmode="numeric"], input[name*="ationalId" i]').first().fill(NID);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    await shoot(page, '02-login-filled');

    await Promise.all([
      page.waitForURL(/\/(hub|admin)/, { timeout: 15_000 }),
      page.locator('button[type="submit"]').first().click(),
    ]);
    console.log(`  ✓ Landed on ${page.url()}`);
    await shoot(page, '03-after-login');

    console.log('▶ A3. Navigate to /admin/users');
    await page.goto(`${BASE}/admin/users`, { waitUntil: 'networkidle' });
    await shoot(page, '04-users-list');
    const supVisible = await page.getByText('الإدارة العليا للنظام').first().isVisible({ timeout: 8_000 });
    console.log(`  ${supVisible ? '✓' : '✗'} super_admin row visible`);

    console.log('▶ A4. Click "مستخدم جديد"');
    await page.getByRole('button', { name: /مستخدم جديد/ }).click();
    await page.waitForURL(/\/admin\/users\/new/, { timeout: 5_000 });
    await page.waitForLoadState('networkidle');
    await shoot(page, '05-create-empty');

    console.log('▶ A5. Fill create form');
    uniqueNid = generateValidNid();
    const stamp = Date.now().toString().slice(-6);
    const fullName = `اختبار سموك ${stamp}`;
    const uniqueMobile = `011${stamp}99`; // 11 digits, valid Egyptian mobile prefix

    await page.getByLabel(/الرقم القومي/).fill(uniqueNid);
    await page.getByLabel(/الاسم الكامل/).fill(fullName);
    await page.getByLabel(/الكود الوظيفي/).fill(`OCSMK${stamp}`);
    await page.getByLabel(/رقم مصنع البطاقة/).fill(`CFSMK${stamp}`);
    await page.getByLabel(/تاريخ إصدار البطاقة/).fill('2024-01-15');
    await page.getByLabel(/رقم الهاتف/).fill(uniqueMobile);
    await page.getByLabel(/البريد الإلكتروني/).fill(`smoke-${stamp}@pac.demo`);
    await page.getByLabel(/الدور الوظيفي/).selectOption('committee_user');
    await page.getByLabel(/الوحدة/).fill('وحدة الاختبار');
    await page.getByLabel(/كلمة المرور/).fill(TEST_USER_PASSWORD);
    await shoot(page, '06-create-filled');

    console.log('▶ A6. Submit create form');
    const [createResp] = await Promise.all([
      page.waitForResponse(r => r.url().includes('/admin/users') && r.request().method() === 'POST', { timeout: 15_000 }),
      page.getByRole('button', { name: /إنشاء المستخدم/ }).click(),
    ]);
    console.log(`  POST /admin/users → ${createResp.status()}`);
    if (createResp.status() !== 201) {
      console.log('  RESPONSE:', (await createResp.text()).slice(0, 500));
      throw new Error('Create failed');
    }

    const created = await createResp.json();
    testUserId = created.id;
    await page.waitForLoadState('networkidle');
    await shoot(page, '07-after-submit');

    if (/\/admin\/users\/[0-9a-f-]{36}/.test(page.url())) {
      console.log(`  ✓ Routed to detail: ${page.url()}`);
      const nameVisible = await page.getByText(fullName).first().isVisible({ timeout: 5_000 });
      const nidVisible = await page.getByText(uniqueNid).first().isVisible({ timeout: 5_000 });
      console.log(`  ${nameVisible ? '✓' : '✗'} New user name on detail page`);
      console.log(`  ${nidVisible ? '✓' : '✗'} New user NID on detail page`);
      await shoot(page, '08-detail-final');
    } else {
      throw new Error(`Expected detail route, got: ${page.url()}`);
    }

    // ==================================================================
    // PHASE B — Edit-in-place drawer (non-role field, no FR-C06 trigger)
    // ==================================================================
    console.log('\n━━━ PHASE B: Edit-in-place drawer ━━━');

    console.log('▶ B1. Click "تعديل" to open edit drawer');
    await page.getByRole('button', { name: /تعديل/ }).first().click();
    // Drawer is a region/dialog with a heading
    await page.getByRole('heading', { name: /تعديل بيانات المستخدم/ }).waitFor({ timeout: 5_000 });
    await shoot(page, '09-edit-drawer-open');
    console.log('  ✓ Drawer opened with form pre-filled');

    const editedMobile = `012${stamp}88`; // unique per run
    console.log(`▶ B2. Change mobile to ${editedMobile}`);
    // Locate inside drawer to avoid duplicates from a re-render of the same form
    const drawer = page.locator('div[role="dialog"], aside').filter({ hasText: 'تعديل بيانات المستخدم' }).last();
    const mobileInDrawer = drawer.getByLabel(/رقم الهاتف/);
    await mobileInDrawer.fill(editedMobile);
    await shoot(page, '10-edit-mobile-changed');

    console.log('▶ B3. Save (no role change → no warning banner)');
    // Confirm warning banner is NOT shown for non-role-change
    const warningCount = await drawer.getByText(/تغيير الدور سيؤدي/).count();
    console.log(`  ${warningCount === 0 ? '✓' : '✗'} Role-change warning hidden when role unchanged`);

    const [patchResp1] = await Promise.all([
      page.waitForResponse(r => r.url().includes(`/admin/users/${testUserId}`) && r.request().method() === 'PATCH', { timeout: 10_000 }),
      drawer.getByRole('button', { name: /^حفظ$/ }).click(),
    ]);
    console.log(`  PATCH /admin/users/${testUserId.slice(0, 8)}… → ${patchResp1.status()}`);
    if (patchResp1.status() !== 200) {
      console.log('  RESPONSE:', (await patchResp1.text()).slice(0, 400));
    }

    // Wait for drawer to close
    await page.getByRole('heading', { name: /تعديل بيانات المستخدم/ }).waitFor({ state: 'hidden', timeout: 5_000 });
    await page.waitForLoadState('networkidle');
    await shoot(page, '11-edit-saved');

    const newMobileVisible = await page.getByText(editedMobile).first().isVisible({ timeout: 5_000 });
    console.log(`  ${newMobileVisible ? '✓' : '✗'} New mobile (${editedMobile}) visible on detail page`);

    // ==================================================================
    // PHASE C — FR-C06 role-change session revocation
    // ==================================================================
    console.log('\n━━━ PHASE C: FR-C06 role-change session revocation ━━━');

    console.log('▶ C1. Open second context, sign in as the newly-created user');
    userCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const userPage = await userCtx.newPage();
    userPage.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(`[user-ctx] ${msg.text()}`); });

    try {
      await signIn(userPage, uniqueNid, TEST_USER_PASSWORD);
      console.log(`  ✓ test user logged in, landed on ${userPage.url()}`);
      await shoot(userPage, '12-test-user-logged-in');
    } catch (err) {
      throw new Error(`Test user login failed: ${err.message}`);
    }

    // Verify /auth/me succeeds for the test user
    const meBefore = await userPage.request.get(`${API}/auth/me`);
    console.log(`  GET /auth/me (pre-role-change) → ${meBefore.status()}`);
    if (meBefore.status() !== 200) throw new Error('User /auth/me should be 200 before role change');
    const meBeforeBody = await meBefore.json();
    console.log(`  ✓ test user role=${meBeforeBody.role}, apps=[${meBeforeBody.apps.join(',')}]`);

    console.log('▶ C2. Super-admin: open detail → تعديل → change role to committee_admin');
    // Make sure we're back on the admin detail page
    if (!page.url().includes(`/admin/users/${testUserId}`)) {
      await page.goto(`${BASE}/admin/users/${testUserId}`, { waitUntil: 'networkidle' });
    }
    await page.getByRole('button', { name: /تعديل/ }).first().click();
    await page.getByRole('heading', { name: /تعديل بيانات المستخدم/ }).waitFor({ timeout: 5_000 });

    const drawer2 = page.locator('div[role="dialog"], aside').filter({ hasText: 'تعديل بيانات المستخدم' }).last();
    await drawer2.getByLabel(/الدور الوظيفي/).selectOption('committee_admin');

    // Verify the gold dashed warning banner now shows
    const warningVisible = await drawer2.getByText(/تغيير الدور سيؤدي إلى إنهاء/).isVisible({ timeout: 3_000 });
    console.log(`  ${warningVisible ? '✓' : '✗'} FR-C06 warning banner visible after role change`);
    await shoot(page, '13-role-change-warning');

    console.log('▶ C3. Save role change');
    const [patchResp2] = await Promise.all([
      page.waitForResponse(r => r.url().includes(`/admin/users/${testUserId}`) && r.request().method() === 'PATCH', { timeout: 10_000 }),
      drawer2.getByRole('button', { name: /^حفظ$/ }).click(),
    ]);
    console.log(`  PATCH /admin/users/${testUserId.slice(0, 8)}… → ${patchResp2.status()}`);

    await page.getByRole('heading', { name: /تعديل بيانات المستخدم/ }).waitFor({ state: 'hidden', timeout: 5_000 });
    await page.waitForLoadState('networkidle');
    await shoot(page, '14-role-changed');

    console.log('▶ C4. Verify FR-C06 — test user session is now revoked');
    const meAfter = await userPage.request.get(`${API}/auth/me`);
    const meAfterBody = await meAfter.text();
    console.log(`  GET /auth/me (post-role-change) → ${meAfter.status()}`);
    console.log(`  Body: ${meAfterBody}`);

    const sessionRevoked = meAfter.status() === 401 && meAfterBody.includes('SESSION_REVOKED');
    console.log(`  ${sessionRevoked ? '✓' : '✗'} FR-C06 enforced — old session returns SESSION_REVOKED`);

    // Bonus: trigger an in-app navigation in the user context to surface SessionExpiredBanner
    await userPage.goto(`${BASE}/hub`, { waitUntil: 'networkidle' }).catch(() => {});
    await shoot(userPage, '15-test-user-after-revoke');

    // ==================================================================
    // SUMMARY
    // ==================================================================
    console.log('\n=== Console errors ===');
    if (consoleErrors.length === 0) console.log('  (none)');
    else consoleErrors.forEach(e => console.log(`  • ${e}`));

    console.log('\n=== Network failures (excluding fonts CDN) ===');
    const meaningfulFailures = networkFailures.filter(f => !f.includes('fonts.gstatic.com'));
    if (meaningfulFailures.length === 0) console.log('  (none)');
    else meaningfulFailures.forEach(f => console.log(`  • ${f}`));

    console.log('\n✓ All phases complete.');
  } catch (err) {
    console.error('\n✗ FAIL:', err.message);
    if (err.stack) console.error(err.stack.split('\n').slice(0, 5).join('\n'));
    await shoot(page, '99-failure').catch(() => {});
    process.exitCode = 1;
  } finally {
    await adminCtx.close().catch(() => {});
    if (userCtx) await userCtx.close().catch(() => {});
    await browser.close();
  }
}

main();
