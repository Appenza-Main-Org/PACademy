/**
 * ImportLookupModal.test.tsx — smoke + a11y tests.
 *
 * Verifies that the modal renders the correct initial state (dropzone),
 * shows the template download button, and has no a11y violations.
 */

import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { renderWithProviders } from '@/test/test-utils';
import { ImportLookupModal } from './ImportLookupModal';

const baseProps = {
  open: true,
  onClose: () => {},
  lookupKey: 'educationTypes' as const,
  lookupTitle: 'أنواع التعليم',
  existingRows: [],
  existingSortMax: 0,
};

describe('ImportLookupModal', () => {
  it('renders the modal title when open', () => {
    renderWithProviders(<ImportLookupModal {...baseProps} />);
    expect(screen.getByText(/استيراد أنواع التعليم/)).toBeInTheDocument();
  });

  it('shows the dropzone in idle phase', () => {
    renderWithProviders(<ImportLookupModal {...baseProps} />);
    expect(screen.getByText(/اسحب ملف Excel أو CSV هنا/)).toBeInTheDocument();
  });

  it('shows the template download button', () => {
    renderWithProviders(<ImportLookupModal {...baseProps} />);
    expect(screen.getByText('تنزيل القالب')).toBeInTheDocument();
  });

  it('shows the cancel button in idle phase', () => {
    renderWithProviders(<ImportLookupModal {...baseProps} />);
    expect(screen.getByText('إلغاء')).toBeInTheDocument();
  });

  it('has no a11y violations in idle phase', async () => {
    const { container } = renderWithProviders(<ImportLookupModal {...baseProps} />);
    await screen.findByText(/استيراد أنواع التعليم/);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('does not render when open=false', () => {
    renderWithProviders(<ImportLookupModal {...baseProps} open={false} />);
    expect(screen.queryByText(/استيراد أنواع التعليم/)).not.toBeInTheDocument();
  });
});
