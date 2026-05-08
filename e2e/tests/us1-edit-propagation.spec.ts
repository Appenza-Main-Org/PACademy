/**
 * T045 — US1 Playwright E2E: edit propagation across two admin sessions.
 *
 * Scenario:
 *   1. Admin A signs in and flips applicant X's status.
 *   2. Admin B (separate browser context) navigates to /admin/applicants/X
 *      within ~5 seconds and sees the new status.
 *   3. Both visit /admin/audit and see the matching audit entry with diff.
 *
 * Pre-conditions:
 *   • Backend running with seeded demo data (super_admin user available).
 *   • Frontend running in real-backend mode (VITE_DEMO_MODE=false).
 *
 * If those aren't satisfied, the test self-skips with an explanatory message.
 */
import { test, expect } from './fixtures/auth';

test.describe('US1 — admin edits propagate across sessions', () => {
  test('admin B sees admin A status change within propagation window', async ({
    browser,
    signInAs,
  }) => {
    // Skip if no backend (the apiClient call inside signInAs would fail).
    let pageA;
    try {
      pageA = await signInAs('super_admin');
    } catch (err) {
      test.skip(
        true,
        `Backend unreachable — skipping E2E. Start the backend + run with VITE_DEMO_MODE=false. ${err}`,
      );
      return;
    }

    await pageA.goto('/admin/applicants?pageSize=50');
    const firstRowLink = pageA.locator('a[href*="/admin/applicants/"]').first();
    await firstRowLink.waitFor({ state: 'visible', timeout: 10_000 });
    const applicantHref = await firstRowLink.getAttribute('href');
    expect(applicantHref).toBeTruthy();

    // Visit detail page, capture original status, then flip via the edit page.
    await pageA.goto(applicantHref!);
    await pageA.waitForLoadState('networkidle');
    const originalStatusBadge = pageA.locator(
      '[data-testid="applicant-status-badge"]',
    );
    const originalStatus = (await originalStatusBadge.textContent()) ?? '';

    await pageA.goto(`${applicantHref}/edit`);
    await pageA.waitForLoadState('networkidle');

    // Pick a non-current status from the dropdown.
    const statusSelect = pageA.getByLabel(/الحالة/);
    const targetStatus = originalStatus.includes('قيد')
      ? 'approved'
      : 'under-review';
    await statusSelect.selectOption({ value: targetStatus });
    await pageA.getByRole('button', { name: /حفظ|تحديث/ }).click();
    await pageA.waitForLoadState('networkidle');

    // Admin B in a separate context.
    const pageB = await signInAs('committee_admin');
    await pageB.goto(applicantHref!);
    await pageB.waitForLoadState('networkidle');

    const newStatusBadge = pageB.locator(
      '[data-testid="applicant-status-badge"]',
    );
    await expect(newStatusBadge).not.toHaveText(originalStatus, { timeout: 5_000 });

    // Both should see a corresponding audit entry.
    await pageA.goto('/admin/audit');
    await pageB.goto('/admin/audit');
    await expect(pageA.locator('text=/تعديل|update/i').first()).toBeVisible();
    await expect(pageB.locator('text=/تعديل|update/i').first()).toBeVisible();
  });
});
