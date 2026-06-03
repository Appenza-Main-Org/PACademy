import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '..');
const outDir = path.join(frontendRoot, '.tmp-tests');
const outFile = path.join(outDir, 'applicant-category-visibility.mjs');

const aliasPlugin = {
  name: 'src-alias',
  setup(buildContext) {
    buildContext.onResolve({ filter: /^@\// }, (args) => {
      const base = path.join(frontendRoot, 'src', args.path.slice(2));
      const resolved = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]
        .find((candidate) => existsSync(candidate));
      return { path: resolved ?? base };
    });
  },
};

await mkdir(outDir, { recursive: true });
try {
  await build({
    entryPoints: [path.join(frontendRoot, 'src/features/applicant-portal/lib/applicant-category-visibility.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: outFile,
    logLevel: 'silent',
    plugins: [aliasPlugin],
  });

  const {
    deriveVisibleEligibleCategoryKeys,
    filterApplicantCategoriesByVisibleKeys,
  } = await import(pathToFileURL(outFile).href);

  const categories = [
    { code: 'officers_general', type: 'pre_university', isActive: true },
    { code: 'law_bachelor', type: 'university', isActive: true },
    { code: 'specialized_officers', type: 'university', isActive: true },
  ];
  const eligibility = [
    { categoryId: 'officers_general', eligible: true },
    { categoryId: 'law_bachelor', eligible: true },
    { categoryId: 'specialized_officers', eligible: true },
  ];

  assert.deepEqual(
    deriveVisibleEligibleCategoryKeys({
      eligibility,
      applicantCategories: categories,
      hasImportedSecondaryGrade: true,
      selectedCategoryKey: null,
    }),
    ['officers_general'],
    'secondary applicants with imported grades should see only the eligible pre-university category',
  );

  assert.deepEqual(
    deriveVisibleEligibleCategoryKeys({
      eligibility,
      applicantCategories: categories,
      hasImportedSecondaryGrade: false,
      selectedCategoryKey: null,
    }),
    ['officers_general', 'law_bachelor', 'specialized_officers'],
    'without an imported grade, category visibility should follow the backend eligible list',
  );

  assert.deepEqual(
    deriveVisibleEligibleCategoryKeys({
      eligibility: [{ categoryId: 'law_bachelor', eligible: true }],
      applicantCategories: categories,
      hasImportedSecondaryGrade: true,
      selectedCategoryKey: null,
    }),
    ['law_bachelor'],
    'a grade should not hide all categories unless a secondary eligible category is present',
  );

  assert.deepEqual(
    deriveVisibleEligibleCategoryKeys({
      eligibility: null,
      applicantCategories: categories,
      hasImportedSecondaryGrade: false,
      selectedCategoryKey: 'law_bachelor',
    }),
    ['law_bachelor'],
    'stored category fallback should remain for the no-backend-eligibility path',
  );

  assert.deepEqual(
    filterApplicantCategoriesByVisibleKeys(
      [
        { key: 'officers_general', labelAr: 'قسم الضباط' },
        { key: 'law_bachelor', labelAr: 'ليسانس حقوق' },
      ],
      ['officers_general'],
    ),
    [{ key: 'officers_general', labelAr: 'قسم الضباط' }],
    'condition and specialization info sections should use the same visible category restriction',
  );

  console.log('applicant secondary category visibility tests passed');
} finally {
  await rm(outDir, { recursive: true, force: true });
}
