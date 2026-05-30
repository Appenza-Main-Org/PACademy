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

const queries = read('src/features/applicant-portal/api/categories.queries.ts');
const service = read('src/features/applicant-portal/api/categories.service.ts');
const categoryPage = read('src/features/applicant-portal/pages/CategorySelectionPage.tsx');
const eligibilityPage = read('src/features/applicant-portal/pages/EligibilityCheckPage.tsx');

assertContains(
  queries,
  'eligibleCategories: (nationalId?: string | null, cycleId?: string | null)',
  'Eligible-categories query key must include cycleId.',
);
assertContains(
  queries,
  'categoriesPublicService.eligibleCategories(nationalId ?? \'\', cycleId ?? undefined)',
  'Eligible-categories query must pass cycleId to the service.',
);

assertContains(
  service,
  "applicantApiClient.get<ApplicantCategory[]>('/api/applicant/categories'",
  'Public category list must use the applicant backend when backend mode is enabled.',
);
assertContains(
  service,
  "applicantApiClient.post<EligibilityResult>('/api/applicant/eligibility'",
  'Eligibility mutation must use the applicant backend when backend mode is enabled.',
);
assertContains(
  service,
  'query: { cycleId }',
  'Backend reads that depend on cycle must send cycleId as a query parameter.',
);

assertContains(
  categoryPage,
  'const effectiveCycleId = selectedCycle?.id ?? cycleParam ?? null;',
  'Category selection must preserve an explicit URL cycle even when the active-cycle list is not enough.',
);
assertContains(
  categoryPage,
  'useEligibleCategories(\n    applicantNationalId,\n    effectiveCycleId,',
  'Category selection must evaluate applicant eligibility against the selected URL cycle.',
);

assertContains(
  eligibilityPage,
  "const homeUrl = startUrl;",
  'Eligibility page home link must preserve the selected cycle and return to category selection.',
);
assertNotContains(
  eligibilityPage,
  "{ label: 'الرئيسية', href: ROUTES.hub }",
  'Eligibility breadcrumb must not send applicant users to the staff hub.',
);
assertNotContains(
  eligibilityPage,
  '<Link to={ROUTES.hub} className={LINK_SECONDARY}>',
  'Eligibility home button must not send applicant users to the staff hub.',
);

console.log('applicant cycle routing regression checks passed');
