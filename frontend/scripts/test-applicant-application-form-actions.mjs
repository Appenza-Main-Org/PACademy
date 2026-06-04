import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '..');
const outDir = path.join(frontendRoot, '.tmp-tests');
const outFile = path.join(outDir, 'applicant-application-form-actions.mjs');

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
    entryPoints: [path.join(frontendRoot, 'src/features/applicant-portal/lib/application-form-actions.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: outFile,
    logLevel: 'silent',
    plugins: [aliasPlugin],
  });

  const {
    APPLICATION_FORM_ACTIONS,
    canUseApplicationFormActions,
    formatApplicationFormFilename,
  } = await import(pathToFileURL(outFile).href);

  assert.deepEqual(
    APPLICATION_FORM_ACTIONS.map((action) => action.label),
    ['معاينة الطلب', 'طباعة الطلب', 'تحميل الطلب PDF'],
    'post-submit application form actions must expose preview, print, and PDF download labels',
  );

  assert.equal(
    canUseApplicationFormActions({
      paid: true,
      parentsApproved: true,
      firstExamDate: '2026-03-15T08:00:00.000Z',
      appointmentLocked: true,
    }),
    true,
    'application form actions should be available after the applicant has submitted and reserved an exam date',
  );

  assert.equal(
    canUseApplicationFormActions({
      paid: true,
      parentsApproved: true,
      firstExamDate: null,
      appointmentLocked: false,
    }),
    false,
    'application form actions should remain hidden before final submission / exam-date reservation',
  );

  assert.equal(
    formatApplicationFormFilename('APP-2026000'),
    'police-academy-application-APP-2026000.pdf',
    'PDF download filename should be deterministic and applicant-scoped',
  );

  console.log('applicant application form action checks passed');
} finally {
  await rm(outDir, { recursive: true, force: true });
}
