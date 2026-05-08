/**
 * T044 — ApplicantDetailPage tests focused on Phase 3 acceptance:
 *   • Page mounts and queries the applicant
 *   • lastModified indicator renders only when the server payload carries it
 *
 * The full detail page mounts a workflow panel + audit timeline + multiple
 * dependent queries; testing each in isolation is out of Phase 3 scope.
 * These tests focus on the US1 contract (server-returned lastModified visibility).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Routes, Route } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { MOCK } from '@/shared/mock-data';
import { applicantService } from '@/features/applicants/api/applicant.service';
import { ApplicantDetailPage } from './ApplicantDetailPage';

// Stub the heavier dependent queries so the page doesn't error on missing
// workflow / progress data in jsdom.
vi.mock('@/features/applicants/api/applicant.queries', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/applicants/api/applicant.queries')
  >('@/features/applicants/api/applicant.queries');
  return {
    ...actual,
    useApplicantTimeline: () => ({ data: [], isLoading: false, error: null, refetch: () => {} }),
    useApplicantWorkflow: () => ({ data: null, isLoading: false, error: null, refetch: () => {} }),
    useApplicantProgress: () => ({ data: null, isLoading: false, error: null, refetch: () => {} }),
    useApplicantWorkflowProgress: () => ({ data: null, isLoading: false, error: null, refetch: () => {} }),
    useApplicantWorkflowTransitions: () => ({ data: [], isLoading: false, error: null, refetch: () => {} }),
    useApplicantAudit: () => ({ data: [], isLoading: false, error: null, refetch: () => {} }),
  };
});

describe('ApplicantDetailPage', () => {
  beforeEach(() => {
    // Clean any test-only mutations from earlier runs
    MOCK.applicants.forEach((a) => {
      delete a.lastModifiedAt;
      delete a.lastModifiedBy;
    });
  });

  it('renders the applicant name from the server payload', async () => {
    const target = MOCK.applicants[0]!;
    renderWithProviders(
      <Routes>
        <Route path="/admin/applicants/:id" element={<ApplicantDetailPage />} />
      </Routes>,
      { initialEntries: [`/admin/applicants/${target.id}`] },
    );

    await waitFor(() => {
      expect(screen.getAllByText(target.name).length).toBeGreaterThan(0);
    });
  });

  it('does not render the lastModified indicator when field is absent', async () => {
    const target = MOCK.applicants[0]!;
    renderWithProviders(
      <Routes>
        <Route path="/admin/applicants/:id" element={<ApplicantDetailPage />} />
      </Routes>,
      { initialEntries: [`/admin/applicants/${target.id}`] },
    );

    await waitFor(() => {
      expect(screen.getAllByText(target.name).length).toBeGreaterThan(0);
    });
    expect(screen.queryByTestId('last-modified-indicator')).not.toBeInTheDocument();
  });

  it('renders the lastModified indicator when server payload carries it', async () => {
    const target = MOCK.applicants[1]!;
    target.lastModifiedAt = '2026-05-08T10:30:00.000Z';
    target.lastModifiedBy = 'مدير الاختبار';

    renderWithProviders(
      <Routes>
        <Route path="/admin/applicants/:id" element={<ApplicantDetailPage />} />
      </Routes>,
      { initialEntries: [`/admin/applicants/${target.id}`] },
    );

    const indicator = await screen.findByTestId('last-modified-indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator.textContent).toContain('مدير الاختبار');
  });

  it('service.getById returns null for a missing id', async () => {
    const result = await applicantService.getById('nonexistent-id');
    expect(result).toBeNull();
  });
});
