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

  console.log('applicant grades import integrity tests passed');
} finally {
  await rm(outDir, { recursive: true, force: true });
}
