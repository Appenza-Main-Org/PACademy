import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '..');
const outDir = path.join(frontendRoot, '.tmp-tests');
const outFile = path.join(outDir, 'applicant-profile-options.mjs');
const governorateOutFile = path.join(outDir, 'governorate-lookup.mjs');

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
    entryPoints: [path.join(frontendRoot, 'src/features/applicant-portal/lib/profile-options.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: outFile,
    logLevel: 'silent',
    plugins: [aliasPlugin],
  });
  await build({
    entryPoints: [path.join(frontendRoot, 'src/features/applicant-portal/lib/governorateLookup.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: governorateOutFile,
    logLevel: 'silent',
    plugins: [aliasPlugin],
  });

  const {
    buildAllowedAcademicDegreeOptions,
    buildAllowedMaritalStatusOptions,
    getAllowedApplicantProfileCodes,
  } = await import(pathToFileURL(outFile).href);
  const {
    policeStationMatchesGovernorate,
    resolveBirthGovernorateRow,
    resolveGovernorateRow,
  } = await import(pathToFileURL(governorateOutFile).href);

  const selectedCodes = getAllowedApplicantProfileCodes(
    [
      {
        categoryId: 'specialized_officers',
        allowedMaritalStatusCodes: ['MAR-01'],
        allowedAcademicDegreeCodes: ['DEG-02', 'DEG-03'],
      },
    ],
    'specialized_officers',
  );

  assert.deepEqual(selectedCodes.maritalStatusCodes, ['MAR-01']);
  assert.deepEqual(selectedCodes.academicDegreeCodes, ['DEG-02', 'DEG-03']);

  const maritalOptions = buildAllowedMaritalStatusOptions(
    [
      { code: 'MAR-01', name: 'أعزب', isActive: true },
      { code: 'MAR-02', name: 'متزوج', isActive: true },
      { code: 'MAR-03', name: 'مطلق', isActive: true },
    ],
    selectedCodes.maritalStatusCodes,
  );

  assert.deepEqual(
    maritalOptions.map((option) => option.value),
    ['single'],
    'marital status options should include only codes allowed by cycle setup',
  );
  assert.deepEqual(
    buildAllowedMaritalStatusOptions([], []).map((option) => option.value),
    ['single', 'married', 'divorced', 'widowed'],
    'marital status options should keep the normal fallback when no cycle restriction is available',
  );

  const degreeOptions = buildAllowedAcademicDegreeOptions(
    [
      { code: 'DEG-01', name: 'بكالوريوس', isActive: true },
      { code: 'DEG-02', name: 'ماجستير', isActive: true },
      { code: 'DEG-03', name: 'دكتوراه', isActive: true },
    ],
    selectedCodes.academicDegreeCodes,
  );

  assert.deepEqual(
    degreeOptions.map((option) => option.value),
    ['master', 'doctorate'],
    'academic degree options should include only degrees allowed by cycle setup',
  );

  const defaultReligion = { value: 'مسلم', label: 'مسلم' };
  assert.equal(defaultReligion.value, 'مسلم');

  const governorates = [
    { code: 'GOV-09', name: 'الغربية', isActive: true, region: 'الوجه البحري' },
    { code: 'GOV-14', name: 'المنيا', isActive: true, region: 'الوجه القبلي' },
  ];
  const birthGov = resolveBirthGovernorateRow(governorates, 'المنيا', '30509211602852');
  assert.equal(
    birthGov?.name,
    'الغربية',
    'NID governorate code should override a stale MOI/session governorate label',
  );
  const minyaRow = resolveGovernorateRow(governorates, '24');
  assert.equal(minyaRow?.code, 'GOV-14', 'numeric NID governorate codes should resolve to lookup rows');
  assert.equal(
    policeStationMatchesGovernorate(
      { code: 'PST-1', name: 'قسم المنيا', isActive: true, governorateCode: '24', kind: 'قسم' },
      minyaRow,
    ),
    true,
    'district filtering should accept admin rows keyed by NID governorate code',
  );
  assert.equal(
    policeStationMatchesGovernorate(
      { code: 'PST-2', name: 'قسم طنطا', isActive: true, governorateCode: 'GOV-09', kind: 'قسم' },
      birthGov,
    ),
    true,
    'district filtering should keep supporting lookup governorate codes',
  );

  console.log('applicant profile option filtering tests passed');
} finally {
  await rm(outDir, { recursive: true, force: true });
}
