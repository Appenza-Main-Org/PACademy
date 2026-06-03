import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '..');
const outDir = path.join(frontendRoot, '.tmp-tests');
const outFile = path.join(outDir, 'cycle-delete-guard.mjs');

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
    entryPoints: [path.join(frontendRoot, 'src/features/admin/lib/cycle-delete-guard.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: outFile,
    logLevel: 'silent',
    plugins: [aliasPlugin],
  });

  const {
    canDeleteAdmissionCycle,
    cycleDeleteBlockedReason,
    hasCycleApplicantData,
  } = await import(pathToFileURL(outFile).href);

  assert.equal(
    hasCycleApplicantData({ applicantCount: 1 }),
    true,
    'cycles with applicants must be treated as containing applicant data',
  );
  assert.equal(
    hasCycleApplicantData({ applicantCount: 0, submissionCount: 1 }),
    true,
    'cycles with backend submission rows must be treated as containing applicant data',
  );
  assert.equal(
    hasCycleApplicantData({ applicantCount: 0, applicationsCount: 1 }),
    true,
    'cycles with backend application rows must be treated as containing applicant data',
  );
  assert.equal(
    canDeleteAdmissionCycle({ isActive: false, applicantCount: 0 }),
    true,
    'inactive cycles with no applicant data can expose delete',
  );
  assert.equal(
    canDeleteAdmissionCycle({ isActive: false, applicantCount: 1 }),
    false,
    'inactive cycles with applicant data must not expose delete',
  );
  assert.equal(
    canDeleteAdmissionCycle({ isActive: true, applicantCount: 0 }),
    false,
    'active cycles must not expose delete',
  );
  assert.match(
    cycleDeleteBlockedReason({ isActive: false, applicantCount: 3 }) ?? '',
    /طلبات متقدمين/,
    'blocked reason should explain applicant-linked cycles',
  );

  const cyclesPageSource = await readFile(
    path.join(frontendRoot, 'src/features/admin/pages/CyclesPage.tsx'),
    'utf8',
  );
  assert.match(
    cyclesPageSource,
    /const deleteSlot = canDeleteAdmissionCycle\(c\) \? \(/,
    'cycles page must hide the delete action unless the cycle delete guard allows it',
  );
  assert.doesNotMatch(
    cyclesPageSource,
    /const deleteSlot = c\.isActive \? null : \(/,
    'cycles page must not gate delete only on active status',
  );

  console.log('cycles delete guard regression checks passed');
} finally {
  await rm(outDir, { recursive: true, force: true });
}
