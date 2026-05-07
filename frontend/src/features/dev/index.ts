/**
 * Internal "dev" feature — surfaces only mounted while `import.meta.env.DEV`.
 *
 * Currently exposes the Phase 2B Radix primitives review page. None of these
 * routes ship to production builds; the gate lives in `routes.tsx`.
 */

export { PrimitivesReviewPage } from './PrimitivesReviewPage';
