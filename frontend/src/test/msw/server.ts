import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** Node-side MSW server used in Vitest tests. */
export const server = setupServer(...handlers);
