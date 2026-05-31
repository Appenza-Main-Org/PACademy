import assert from 'node:assert/strict';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '..');
const outDir = path.join(frontendRoot, '.tmp-tests');
const outFile = path.join(outDir, 'applicant-lock.mjs');

await mkdir(outDir, { recursive: true });
try {
  await build({
    entryPoints: [path.join(frontendRoot, 'src/features/applicant-portal/lib/application-lock.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: outFile,
    logLevel: 'silent',
  });

  const {
    DEFAULT_APPLICATION_INSTRUCTIONS,
    isApplicationLocked,
    isApplicantEditRoute,
    normalizeApplicationInstructions,
  } = await import(pathToFileURL(outFile).href);

  assert.equal(
    isApplicationLocked({ payment: { method: 'fawry-code', paidAt: Date.now() } }, false),
    true,
    'backend-paid drafts must lock applicant application data immediately after payment',
  );
  assert.equal(
    isApplicationLocked({}, true),
    true,
    'locally confirmed payment must lock applicant application data while the draft refetch is in flight',
  );
  assert.equal(
    isApplicationLocked({ examSlot: { slotId: 'S1', date: '2026-06-01', time: '08:00', location: 'الأكاديمية' } }, false),
    true,
    'legacy submitted/exam-slot drafts should remain locked',
  );
  assert.equal(
    isApplicationLocked({ payment: { method: 'fawry-code' } }, false),
    false,
    'issued but unpaid payment intents must not lock the application',
  );

  assert.equal(isApplicantEditRoute('/applicant/profile'), true);
  assert.equal(isApplicantEditRoute('/applicant/profile/family'), true);
  assert.equal(isApplicantEditRoute('/applicant/payment'), true);
  assert.equal(isApplicantEditRoute('/applicant/print-card'), false);

  assert.deepEqual(
    normalizeApplicationInstructions(['   ', 'تعليمة أولى', 'تعليمة ثانية  ']),
    ['تعليمة أولى', 'تعليمة ثانية'],
    'instructions should be trimmed and empty lines removed',
  );
  assert.deepEqual(
    normalizeApplicationInstructions([]),
    DEFAULT_APPLICATION_INSTRUCTIONS,
    'empty admin instructions should fall back to the canonical applicant copy',
  );

  const settingsSource = await readFile(
    path.join(frontendRoot, 'src/features/admin/api/settings.service.ts'),
    'utf8',
  );
  assert.match(
    settingsSource,
    /applicationInstructions/,
    'admin settings must expose applicationInstructions so admins can manage the applicant drawer copy',
  );

  const applicantPageSource = await readFile(
    path.join(frontendRoot, 'src/features/applicant-portal/pages/ApplicantPortalPage.tsx'),
    'utf8',
  );
  assert.match(
    applicantPageSource,
    /useApplicationInstructions/,
    'applicant portal must fetch application instructions dynamically',
  );
  assert.equal(
    applicantPageSource.includes('<strong>قبل التقدم:</strong>'),
    false,
    'applicant instructions drawer must not keep static hardcoded instruction paragraphs',
  );

  console.log('applicant payment lock and dynamic instructions regression checks passed');
} finally {
  await rm(outDir, { recursive: true, force: true });
}
