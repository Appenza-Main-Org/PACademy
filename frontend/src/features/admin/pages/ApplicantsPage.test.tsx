/**
 * T043 — ApplicantsListPage smoke tests.
 * Uses MOCK data path (default — VITE_DEMO_MODE not set in test env).
 */
import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { renderWithProviders } from '@/test/test-utils';
import { ApplicantsPage } from './ApplicantsPage';

describe('ApplicantsPage', () => {
  it('renders the page header and action buttons', async () => {
    renderWithProviders(<ApplicantsPage />);

    expect(await screen.findByText('إدارة المتقدمين')).toBeInTheDocument();
    expect(screen.getByText('متقدم جديد')).toBeInTheDocument();
  });

  it('renders the DataTable after data loads', async () => {
    renderWithProviders(<ApplicantsPage />);

    // Wait for at least one applicant row to appear
    await waitFor(
      () => {
        const links = document.querySelectorAll('a[href*="/admin/applicants/"]');
        expect(links.length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );
  });

  it('has no a11y violations after data loads', async () => {
    const { container } = renderWithProviders(<ApplicantsPage />);

    // Wait for content
    await screen.findByText('إدارة المتقدمين');
    await waitFor(
      () => {
        const links = document.querySelectorAll('a[href*="/admin/applicants/"]');
        expect(links.length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
