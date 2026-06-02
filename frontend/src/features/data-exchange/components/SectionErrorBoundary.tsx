/**
 * SectionErrorBoundary — a scoped React error boundary for the Data-Exchange
 * hub. The app has no global error boundary, so any render-time throw in a
 * child (a malformed backend row, a bad date, a failed lazy import) would
 * otherwise blank the entire admin shell. This contains the blast radius to
 * one section and renders a recoverable `ErrorState` with a reset action.
 */

import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { ErrorState } from '@/shared/components';

interface SectionErrorBoundaryProps {
  children: ReactNode;
  /** Fallback heading shown when the wrapped section throws. */
  title?: string;
}

interface SectionErrorBoundaryState {
  error: Error | null;
}

export class SectionErrorBoundary extends Component<
  SectionErrorBoundaryProps,
  SectionErrorBoundaryState
> {
  override state: SectionErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): SectionErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface the failure for diagnostics without crashing the shell.
    console.error('[data-exchange] section render error', error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (error) {
      return (
        <div className="rounded-lg border border-border-subtle bg-surface-card p-4 shadow-xs">
          <ErrorState
            title={this.props.title ?? 'تعذّر عرض هذا القسم'}
            description={error.message}
            onRetry={this.handleReset}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
