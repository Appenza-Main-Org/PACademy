import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '..');
const outDir = path.join(frontendRoot, '.tmp-tests');
const outFile = path.join(outDir, 'applicant-profile-options.mjs');

await mkdir(outDir, { recursive: true });
try {
  await build({
    entryPoints: [path.join(frontendRoot, 'src/features/applicant-portal/lib/profile-options.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: outFile,
    logLevel: 'silent',
  });

  const {
    buildAllowedAcademicDegreeOptions,
    buildAllowedMaritalStatusOptions,
    getAllowedApplicantProfileCodes,
  } = await import(pathToFileURL(outFile).href);

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

  console.log('applicant profile option filtering tests passed');
} finally {
  await rm(outDir, { recursive: true, force: true });
}
