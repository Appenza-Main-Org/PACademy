import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '..');
const outDir = path.join(frontendRoot, '.tmp-tests');
const outFile = path.join(outDir, 'applicant-university-qualification-options.mjs');

await mkdir(outDir, { recursive: true });
try {
  await build({
    entryPoints: [path.join(frontendRoot, 'src/features/applicant-portal/lib/university-qualification-options.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: outFile,
    logLevel: 'silent',
  });

  const {
    buildCycleAcademicGradeOptions,
    buildCycleFacultyOptions,
    buildCycleSpecializationOptions,
    shouldShowPostgraduateQualificationFields,
    shouldShowUniversityQualificationFields,
  } = await import(pathToFileURL(outFile).href);

  const eligibility = {
    categoryId: 'specialized_officers',
    academicPrograms: [
      {
        facultyCode: 'FAC-01',
        facultyName: 'كلية الطب',
        specializationCode: 'SPC-01',
        specializationName: 'جراحة عامة',
      },
      {
        facultyCode: 'FAC-02',
        facultyName: 'كلية الهندسة',
        specializationCode: 'SPC-02',
        specializationName: 'اتصالات',
      },
      {
        facultyCode: 'FAC-01',
        facultyName: 'كلية الطب',
        specializationCode: 'SPC-03',
        specializationName: 'أطفال',
      },
    ],
    allowedAcademicGradeCodes: ['AGR-02', 'AGR-03'],
  };

  assert.deepEqual(
    buildCycleFacultyOptions(
      [
        { code: 'FAC-01', name: 'كلية الطب', isActive: true },
        { code: 'FAC-02', name: 'كلية الهندسة', isActive: true },
        { code: 'FAC-99', name: 'كلية غير مفعلة', isActive: true },
      ],
      eligibility,
    ),
    [
      { value: 'كلية الطب', label: 'كلية الطب' },
      { value: 'كلية الهندسة', label: 'كلية الهندسة' },
    ],
    'faculty options should come from the cycle-filtered academic programs',
  );

  assert.deepEqual(
    buildCycleSpecializationOptions(
      [{ code: 'SPC-01', name: 'جراحة عامة', isActive: true, facultyCode: 'FAC-01' }],
      eligibility,
      'كلية الطب',
    ),
    [
      { value: 'جراحة عامة', label: 'جراحة عامة' },
      { value: 'أطفال', label: 'أطفال' },
    ],
    'specializations should be scoped to the picked cycle faculty',
  );

  assert.deepEqual(
    buildCycleAcademicGradeOptions(
      [
        { code: 'AGR-01', name: 'امتياز', isActive: true },
        { code: 'AGR-02', name: 'جيد جداً', isActive: true },
        { code: 'AGR-03', name: 'جيد', isActive: true },
        { code: 'AGR-04', name: 'مقبول', isActive: true },
      ],
      eligibility,
    ),
    [
      { value: 'جيد جداً', label: 'جيد جداً' },
      { value: 'جيد', label: 'جيد' },
    ],
    'grade options should be filtered to the cycle-configured grade codes',
  );

  assert.equal(shouldShowUniversityQualificationFields(''), false);
  assert.equal(shouldShowUniversityQualificationFields('bachelor'), true);
  assert.equal(shouldShowPostgraduateQualificationFields('bachelor'), false);
  assert.equal(shouldShowPostgraduateQualificationFields('master'), true);
  assert.equal(shouldShowPostgraduateQualificationFields('doctorate'), true);

  console.log('applicant university qualification option tests passed');
} finally {
  await rm(outDir, { recursive: true, force: true });
}
