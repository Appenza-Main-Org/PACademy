import '@testing-library/jest-dom';
import { configureAxe, toHaveNoViolations } from 'jest-axe';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './src/test/msw/server';

expect.extend(toHaveNoViolations);

// Configure axe with sensible defaults for Arabic RTL UI.
configureAxe({
  rules: [
    // html[lang] is always set; suppress the root-lang noise in component tests.
    { id: 'html-has-lang', enabled: false },
  ],
});

// MSW lifecycle for tests that wire backend mocks.
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
