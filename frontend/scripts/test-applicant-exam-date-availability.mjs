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
    filterDatesWithinBookingWindow,
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

  assert.deepEqual(
    filterDatesWithinBookingWindow(
      ['2026-06-02', '2026-06-03', '2026-06-05', '2026-06-10'],
      1,
      now,
    ),
    ['2026-06-02', '2026-06-03'],
    'a 1-day booking window keeps today and tomorrow only',
  );
  assert.deepEqual(
    filterDatesWithinBookingWindow(['2026-06-02', '2026-06-10'], null, now),
    ['2026-06-02', '2026-06-10'],
    'a null booking window leaves the list untouched',
  );
  assert.deepEqual(
    filterDatesWithinBookingWindow(['2026-06-02', '2026-06-10'], 0, now),
    ['2026-06-02'],
    'a zero-day booking window only keeps today',
  );

  const stage8Source = readFileSync(
    path.join(frontendRoot, 'src/features/applicant-portal/pages/Stage8ExamSchedulePage.tsx'),
    'utf8',
  );
  assert.match(
    stage8Source,
    /filterBookableExamDates\(examDates\)/,
    'Stage 8 should hide expired dates from applicant booking options.',
  );
  assert.match(
    stage8Source,
    /filterDatesWithinBookingWindow\(bookable, slotWindowDays\)/,
    'Stage 8 should narrow the bookable list to the General Settings booking window.',
  );
  assert.match(
    stage8Source,
    /examDaysPerApplicant != null/,
    'Stage 8 should cap the visible date count to the General Settings examDaysPerApplicant value.',
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
