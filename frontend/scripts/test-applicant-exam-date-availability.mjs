import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '..');
const outDir = path.join(frontendRoot, '.tmp-tests');
const outFile = path.join(outDir, 'exam-date-availability.mjs');

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
    entryPoints: [path.join(frontendRoot, 'src/features/applicant-portal/lib/exam-date-availability.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: outFile,
    logLevel: 'silent',
    plugins: [aliasPlugin],
  });

  const {
    filterBookableExamDates,
    isBookableExamDate,
    normalizeExamDateValue,
  } = await import(pathToFileURL(outFile).href);

  const now = new Date('2026-06-02T12:00:00+03:00');

  assert.equal(normalizeExamDateValue('2026-06-02'), '2026-06-02');
  assert.equal(normalizeExamDateValue('02/06/2026'), '2026-06-02');
  assert.equal(normalizeExamDateValue('31/02/2026'), null);

  assert.equal(isBookableExamDate('2026-06-01', now), false);
  assert.equal(isBookableExamDate('2026-06-02', now), true);
  assert.equal(isBookableExamDate('2026-06-03', now), true);
  assert.equal(isBookableExamDate('01/06/2026', now), false);

  assert.deepEqual(
    filterBookableExamDates(['2026-06-01', '2026-06-02', '03/06/2026', 'not-a-date'], now),
    ['2026-06-02', '2026-06-03'],
  );

  const stage8Source = readFileSync(
    path.join(frontendRoot, 'src/features/applicant-portal/pages/Stage8ExamSchedulePage.tsx'),
    'utf8',
  );
  assert.match(
    stage8Source,
    /filterBookableExamDates\(examDates\)\.map/,
    'Stage 8 should hide expired dates from applicant booking options.',
  );

  const serviceSource = readFileSync(
    path.join(frontendRoot, 'src/features/applicant-portal/api/applicantPortal.service.ts'),
    'utf8',
  );
  assert.match(
    serviceSource,
    /!isBookableExamDate\(normalizedInputDate\)/,
    'pickFirstExamDate should reject stale date-only submissions before reserving.',
  );

  console.log('applicant exam-date availability tests passed');
} finally {
  await rm(outDir, { recursive: true, force: true });
}
