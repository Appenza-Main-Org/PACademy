import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '..');
const outDir = path.join(frontendRoot, '.tmp-tests');
const outFile = path.join(outDir, 'admission-setup-wizard-gating.mjs');
const completionOutFile = path.join(outDir, 'application-settings-completion.mjs');

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

const steps = [
  { key: 'application_settings', order: 1 },
  { key: 'application_settings_review', order: 2 },
  { key: 'fees', order: 3 },
  { key: 'exams', order: 4 },
  { key: 'electronic_declaration', order: 5 },
];

await mkdir(outDir, { recursive: true });
try {
  await build({
    entryPoints: [path.join(frontendRoot, 'src/features/admin/admission-setup/lib/wizard-gating.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: outFile,
    logLevel: 'silent',
    plugins: [aliasPlugin],
  });
  await build({
    entryPoints: [path.join(frontendRoot, 'src/features/admin/admission-setup/lib/application-settings-completion.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: completionOutFile,
    logLevel: 'silent',
    plugins: [aliasPlugin],
  });

  const {
    getEarliestAllowedWizardKey,
    getWizardGateState,
    isWizardStepSelectable,
  } = await import(pathToFileURL(outFile).href);
  const { computeApplicationSettingsStatus } = await import(pathToFileURL(completionOutFile).href);

  const statuses = {
    application_settings: 'complete',
    application_settings_review: 'complete',
    fees: 'in_progress',
    exams: 'complete',
    electronic_declaration: 'not_started',
  };

  assert.equal(
    getEarliestAllowedWizardKey(steps, 'exams', statuses, 'review'),
    'fees',
    'direct URL access to a skipped future step must redirect to the first incomplete step',
  );
  assert.equal(
    getEarliestAllowedWizardKey(steps, 'review', statuses, 'review'),
    'fees',
    'review cannot be reached while an earlier configuration step is incomplete',
  );

  const feeGate = getWizardGateState(steps, 'fees', statuses, 'review');
  assert.equal(feeGate.canGoNext, false, 'Next must remain disabled while current step is not complete');
  assert.equal(feeGate.nextKey, 'exams', 'Gate state should still expose the sequential next step');
  assert.deepEqual(
    feeGate.lockedKeys,
    ['exams', 'electronic_declaration', 'review'],
    'All future steps after the first incomplete step must be locked',
  );

  assert.equal(
    isWizardStepSelectable('application_settings_review', steps, statuses, 'review'),
    true,
    'Completed previous steps remain selectable',
  );
  assert.equal(
    isWizardStepSelectable('exams', steps, statuses, 'review'),
    false,
    'Future steps cannot be selected until every previous step is complete',
  );

  const completeStatuses = {
    application_settings: 'complete',
    application_settings_review: 'complete',
    fees: 'complete',
    exams: 'complete',
    electronic_declaration: 'complete',
  };
  assert.equal(
    getWizardGateState(steps, 'electronic_declaration', completeStatuses, 'review').canGoNext,
    true,
    'Final configuration step can advance to review only after it is complete',
  );

  const activeCategories = [
    {
      code: 'law_bachelor',
      name: 'ليسانس الحقوق',
      type: 'university',
      isActive: true,
      facultyCodes: ['law'],
      specializationCodes: ['law-public'],
      genderScope: [],
      excellenceCriterion: ['TAGDIR'],
    },
    {
      code: 'officers_general',
      name: 'الثانوية العامة',
      type: 'pre_university',
      isActive: true,
      facultyCodes: [],
      specializationCodes: [],
      genderScope: [],
      excellenceCriterion: ['GRADES'],
    },
  ];
  const configs = [
    {
      id: 'cfg-law',
      categoryCode: 'law_bachelor',
      categoryNameAr: 'ليسانس الحقوق',
      categoryType: 'university',
      categoryFacultyCodes: ['law'],
      categorySpecializationCodes: ['law-public'],
      isActive: true,
    },
    {
      id: 'cfg-thanawi',
      categoryCode: 'officers_general',
      categoryNameAr: 'الثانوية العامة',
      categoryType: 'pre_university',
      categoryFacultyCodes: [],
      categorySpecializationCodes: [],
      isActive: true,
    },
  ];
  const header = {
    applicationStart: '2026-06-01',
    applicationEnd: '2026-06-30',
    ageReferenceDate: '2026-10-01',
    graduationYears: [2026],
    maritalStatus: ['single'],
    maxAge: 22,
  };
  const lawRow = {
    id: 'row-law',
    kind: 'university',
    categoryCode: 'law_bachelor',
    header,
    facultyCode: 'law',
    facultyNameAr: 'الحقوق',
    specializationCode: 'law-public',
    specializationNameAr: 'عام',
    type: ['male'],
    maritalStatus: ['single'],
    excellenceMode: 'TAGDIR',
    grade: 'good',
    gradeMax: 'excellent',
    scoreMin: null,
    minScoreOperator: 'GREATER_THAN_OR_EQUAL',
    scoreMax: null,
    maxScoreOperator: 'LESS_THAN_OR_EQUAL',
    academicDegrees: ['bachelor'],
    committees: ['committee-1'],
    graduationYears: [2026],
  };
  const thanawiRow = {
    id: 'row-thanawi',
    kind: 'thanawi',
    categoryCode: 'officers_general',
    header,
    excellenceMode: 'GRADES',
    examRound: 'first',
    committee: 'committee-2',
    graduationYear: 2026,
    schoolCategories: ['general'],
    grade: '',
    gradeMax: '',
    scoreMin: 70,
    minScoreOperator: 'GREATER_THAN_OR_EQUAL',
    scoreMax: 100,
    maxScoreOperator: 'LESS_THAN_OR_EQUAL',
    type: [],
    maritalStatus: ['single'],
    academicDegrees: [],
    committees: ['committee-2'],
    graduationYears: [2026],
    facultyCode: '',
    facultyNameAr: '',
    specializationCode: '',
    specializationNameAr: '',
  };

  assert.equal(
    computeApplicationSettingsStatus(configs, activeCategories, []),
    'not_started',
    'Application settings step must not complete without authored required data',
  );
  assert.equal(
    computeApplicationSettingsStatus(configs, activeCategories, [lawRow]),
    'in_progress',
    'Application settings step must stay incomplete until every active category is complete',
  );
  assert.equal(
    computeApplicationSettingsStatus(configs, activeCategories, [lawRow, thanawiRow]),
    'complete',
    'Application settings step completes only when every active category has valid required data',
  );

  console.log('admission setup wizard gating checks passed');
} finally {
  await rm(outDir, { recursive: true, force: true });
}
