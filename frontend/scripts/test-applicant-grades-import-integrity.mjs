import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '..');
const outDir = path.join(frontendRoot, '.tmp-tests');
const outFile = path.join(outDir, 'applicant-grades-import-integrity.mjs');

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
    entryPoints: [path.join(frontendRoot, 'src/features/applicant-grades/lib/duplicateAudit.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: outFile,
    logLevel: 'silent',
    plugins: [aliasPlugin],
  });

  const { buildIntegrityAuditRows, summarizeIntegrityDecisions } = await import(
    pathToFileURL(outFile).href
  );

  const rows = [
    {
      nationalId: '30602151886',
      seatingNumber: '1001',
      nameAr: 'طالب تجريبي',
      gender: 'ذكر',
      track: 'علمي',
      graduationYear: 2026,
      totalGrade: 380,
      maxGrade: null,
      schoolCategory: 'SCH-01',
      examRound: null,
      schoolName: 'مدرسة اختبار',
      regionName: 'القاهرة',
      sourceRowIndex: 1,
    },
  ];

  const integrityRows = buildIntegrityAuditRows({
    rows,
    selectedSchoolCategories: ['SCH-01'],
    maxGradeByCategory: { 'SCH-01': 410 },
  });

  assert.equal(integrityRows.length, 1);
  assert.equal(integrityRows[0].code, 'INVALID_NID');
  assert.equal(integrityRows[0].nationalId, '30602151886');
  assert.match(integrityRows[0].detail, /14/);

  const summary = summarizeIntegrityDecisions(integrityRows, {});
  assert.equal(summary.pendingOutOfRangeCount, 0);
  assert.equal(summary.rejectedSourceRows.has(1), true);

  const overlappingRows = [
    {
      nationalId: '30602151886',
      seatingNumber: '1002',
      nameAr: 'طالب متداخل',
      gender: 'ذكر',
      track: 'علمي',
      graduationYear: 2026,
      totalGrade: 999,
      maxGrade: null,
      schoolCategory: 'SCH-01',
      examRound: null,
      schoolName: 'مدرسة اختبار',
      regionName: 'القاهرة',
      sourceRowIndex: 2,
    },
  ];

  const overlappingIntegrityRows = buildIntegrityAuditRows({
    rows: overlappingRows,
    selectedSchoolCategories: ['SCH-01'],
    maxGradeByCategory: { 'SCH-01': 410 },
  });

  assert.equal(overlappingIntegrityRows.length, 2);
  assert.equal(
    overlappingIntegrityRows.filter((row) => row.code === 'INVALID_NID').length,
    1,
  );
  assert.equal(
    overlappingIntegrityRows.filter((row) => row.code === 'GRADE_OUT_OF_RANGE').length,
    1,
  );

  const overlappingSummary = summarizeIntegrityDecisions(overlappingIntegrityRows, {});
  assert.equal(overlappingSummary.pendingOutOfRangeCount, 0);
  assert.equal(overlappingSummary.rejectedSourceRows.has(2), true);

  const femaleNidInMaleImport = [
    {
      nationalId: '30602151812345',
      seatingNumber: '1003',
      nameAr: 'طالبة نوع مختلف',
      gender: null,
      track: 'علمي',
      graduationYear: 2026,
      totalGrade: 390,
      maxGrade: null,
      schoolCategory: 'SCH-01',
      examRound: null,
      schoolName: 'مدرسة اختبار',
      regionName: 'القاهرة',
      sourceRowIndex: 3,
    },
  ];

  const genderIntegrityRows = buildIntegrityAuditRows({
    rows: femaleNidInMaleImport,
    selectedSchoolCategories: ['SCH-01'],
    maxGradeByCategory: { 'SCH-01': 410 },
    validationRules: [{
      schoolCategory: 'SCH-01',
      allowedGenders: ['male'],
      ageMin: 17,
      maxAge: 30,
      ageReferenceDate: '2026-10-01',
    }],
  });

  assert.equal(genderIntegrityRows.length, 1);
  assert.equal(genderIntegrityRows[0].code, 'GENDER_MISMATCH');
  assert.equal(summarizeIntegrityDecisions(genderIntegrityRows, {}).rejectedSourceRows.has(3), true);

  const underAgeRows = [
    {
      nationalId: '31002151812315',
      seatingNumber: '1004',
      nameAr: 'طالب أصغر من السن',
      gender: 'ذكر',
      track: 'علمي',
      graduationYear: 2026,
      totalGrade: 390,
      maxGrade: null,
      schoolCategory: 'SCH-01',
      examRound: null,
      schoolName: 'مدرسة اختبار',
      regionName: 'القاهرة',
      sourceRowIndex: 4,
    },
  ];

  const ageIntegrityRows = buildIntegrityAuditRows({
    rows: underAgeRows,
    selectedSchoolCategories: ['SCH-01'],
    maxGradeByCategory: { 'SCH-01': 410 },
    validationRules: [{
      schoolCategory: 'SCH-01',
      allowedGenders: ['male'],
      ageMin: 17,
      maxAge: 30,
      ageReferenceDate: '2026-10-01',
    }],
  });

  assert.equal(ageIntegrityRows.length, 1);
  assert.equal(ageIntegrityRows[0].code, 'AGE_OUT_OF_RANGE');
  assert.match(ageIntegrityRows[0].detail, /16/);

  console.log('applicant grades import integrity tests passed');
} finally {
  await rm(outDir, { recursive: true, force: true });
}
