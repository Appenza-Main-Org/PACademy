import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';

interface WrapperProps {
  children: ReactNode;
  initialEntries?: string[];
}

function makeWrapper({ initialEntries = ['/'] }: { initialEntries?: string[] } = {}) {
  return function Wrapper({ children }: WrapperProps): JSX.Element {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

export function renderWithProviders(
  ui: React.ReactElement,
  options: { initialEntries?: string[] } & Omit<RenderOptions, 'wrapper'> = {},
) {
  const { initialEntries, ...renderOptions } = options;
  return render(ui, {
    wrapper: makeWrapper({ initialEntries }),
    ...renderOptions,
  });
}
