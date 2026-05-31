import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const frontendRoot = path.join(repoRoot, 'frontend');

function loadTsModule(relativePath) {
  const filename = path.join(frontendRoot, relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: filename,
  }).outputText;

  const module = { exports: {} };
  const context = {
    exports: module.exports,
    module,
    require: (specifier) => {
      if (specifier === '@/shared/lib/api-client') {
        return { apiClient: { get: async () => ({}), patch: async () => ({}) } };
      }
      throw new Error(`Unexpected runtime import ${specifier} while loading ${relativePath}`);
    },
    sessionStorage: {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    },
  };
  vm.runInNewContext(output, context, { filename });
  return module.exports;
}

const familyData = loadTsModule('src/features/applicant-portal/lib/familyData.ts');
assert.equal(typeof familyData.isBirthLocalityRequired, 'function');
assert.equal(typeof familyData.sanitizeFamilyMemberForBirthplace, 'function');

const bornAbroadMember = {
  ...familyData.EMPTY_MEMBER,
  nidUnavailable: true,
  nidUnavailableReason: 'born_abroad',
  birthGovernorate: 'القاهرة',
  birthDistrict: 'قسم عابدين',
};

assert.equal(
  familyData.isBirthLocalityRequired(bornAbroadMember),
  false,
  'born-abroad family members should not require Egyptian birth governorate/district',
);
assert.deepEqual(
  {
    birthGovernorate: familyData.sanitizeFamilyMemberForBirthplace(bornAbroadMember).birthGovernorate,
    birthDistrict: familyData.sanitizeFamilyMemberForBirthplace(bornAbroadMember).birthDistrict,
  },
  { birthGovernorate: '', birthDistrict: '' },
  'born-abroad family members should not keep stale Egyptian birth locality values',
);
assert.equal(
  familyData.isBirthLocalityRequired({
    ...familyData.EMPTY_MEMBER,
    nidUnavailable: true,
    nidUnavailableReason: 'fallen_record',
  }),
  true,
  'fallen-record family members still need Egyptian birth locality',
);

const settings = loadTsModule('src/features/admin/api/settings.service.ts');
assert.equal(typeof settings.buildApplicantControlScreensSettingsPatch, 'function');
const patch = settings.buildApplicantControlScreensSettingsPatch({
  examDaysPerApplicant: 3,
  examSlotSelectionWindowDays: 1,
  primaryRelativesEntryResponsibleTestCode: 'T01',
  acquaintanceDocumentsEntryResponsibleTestCode: 'T02',
  acquaintanceDocumentsPrintResponsibleTestCode: 'T03',
  acquaintanceDocumentsMutationLockTiming: 'on_test_end',
  primaryRelativesVisibilityResponsibleTestCode: 'T04',
});
assert.deepEqual(
  Object.keys(patch).sort(),
  [
    'acquaintanceDocumentsEntryResponsibleTestCode',
    'acquaintanceDocumentsMutationLockTiming',
    'applicationInstructions',
  ],
  'applicant-control settings PATCH should include only the control-screen fields currently rendered',
);
assert.equal(
  Object.hasOwn(patch, 'primaryRelativesVisibilityResponsibleTestCode'),
  false,
  'the duplicate primary-relatives visibility field should not be rendered or patched',
);

const cardSource = fs.readFileSync(
  path.join(frontendRoot, 'src/features/admin/components/auth/ApplicantControlScreensSettingsCard.tsx'),
  'utf8',
);
assert.equal(
  cardSource.includes('primaryRelativesVisibilityResponsibleTestCode'),
  false,
  'settings card should not render the duplicate primary-relatives visibility select',
);
assert.equal(
  cardSource.includes('applicationInstructionsText'),
  true,
  'settings card should render the admin-managed applicant instructions textarea',
);

console.log('family/settings regression checks passed');
