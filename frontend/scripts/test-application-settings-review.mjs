import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function assertContains(source, needle, message) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}

function assertNotContains(source, needle, message) {
  if (source.includes(needle)) {
    throw new Error(message);
  }
}

const queries = read('src/features/admin/admission-setup/api/applicationSettings.queries.ts');
const service = read('src/features/admin/admission-setup/api/applicationSettings.service.ts');
const reviewPage = read('src/features/admin/admission-setup/pages/ApplicationSettingsReviewPage.tsx');
const categoryAccordion = read('src/features/admin/admission-setup/components/applicationSettings/CategoryAccordion.tsx');

assertContains(
  queries,
  'refetchOnWindowFocus: false',
  'Application-settings queries must not refetch on window focus.',
);
assertContains(
  queries,
  'staleTime: APPLICATION_SETTINGS_STALE_TIME_MS',
  'Application-settings queries need a non-zero staleTime.',
);
assertNotContains(
  queries,
  'lookupQuery.dataUpdatedAt',
  'Category configs must not key off lookup dataUpdatedAt because it double-fetches on first load.',
);
assertContains(
  queries,
  'enabled = true',
  'Application-settings summary query must support being disabled when draft data already covers the review.',
);

assertNotContains(
  service,
  'summaryHasSavedSettings',
  'The aggregate summary endpoint should be trusted on success instead of falling through to the expensive tree builder.',
);

assertContains(
  reviewPage,
  '.app-settings-review-print [data-print-card]',
  'Review print CSS must target category cards explicitly.',
);
assertContains(
  reviewPage,
  'break-inside: auto',
  'Review print CSS must allow multiple category cards to paginate instead of clipping after the first card.',
);

assertContains(
  categoryAccordion,
  'categoryNameAr: category?.name ?? config.categoryNameAr',
  'Lookup edits must be overlaid onto category configs after removing lookup-timestamp key churn.',
);

console.log('application settings review regression checks passed');
