import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '..');
const pagePath = path.join(
  frontendRoot,
  'src/features/applicant-portal/pages/Stage345ApplicantDataPage.tsx',
);

const source = await readFile(pagePath, 'utf8');
const normalized = source.replace(/\s+/g, ' ');

assert.match(
  normalized,
  /const\s+eligibilityCategoriesQuery\s*=\s*useEligibleCategories\(\s*nid\s*,\s*selectedCycleId\s*\);/,
  'applicant profile must fetch eligible categories with selectedCycleId so academic degree options come from the configured admission cycle',
);

console.log('applicant profile cycle scoping regression passed');
