import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '..');
const outDir = path.join(frontendRoot, '.tmp-tests');
const outFile = path.join(outDir, 'cycle-list-status.mjs');

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
    entryPoints: [path.join(frontendRoot, 'src/features/admin/components/cycles/cycleListStatus.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: outFile,
    logLevel: 'silent',
    plugins: [aliasPlugin],
  });

  const {
    isCycleActiveByListStatus,
    listStatusToCyclePatch,
  } = await import(pathToFileURL(outFile).href);

  assert.equal(
    isCycleActiveByListStatus('review'),
    false,
    'Draft & Review must be an inactive cycle',
  );
  assert.equal(
    isCycleActiveByListStatus('published'),
    true,
    'Approved & Published must be an active cycle',
  );
  assert.deepEqual(
    listStatusToCyclePatch('review'),
    { status: 'draft', isActive: false },
    'Review status must persist as draft and inactive',
  );
  assert.deepEqual(
    listStatusToCyclePatch('published'),
    { status: 'active', isActive: true },
    'Published status must persist as active and active',
  );

  const cyclesPageSource = await readFile(
    path.join(frontendRoot, 'src/features/admin/pages/CyclesPage.tsx'),
    'utf8',
  );
  const cyclesServiceSource = await readFile(
    path.join(frontendRoot, 'src/features/admin/api/cycles.service.ts'),
    'utf8',
  );
  assert.doesNotMatch(
    cyclesPageSource,
    /key:\s*['"]isActive['"]/,
    'cycles list must not render a separate activation-status column',
  );
  assert.doesNotMatch(
    cyclesPageSource,
    /setActivateTarget|confirmActivate|تأكيد تفعيل الدورة/,
    'cycles list must not expose a separate activation action/dialog',
  );
  assert.match(
    cyclesPageSource,
    /<CycleStatusToggle\b/,
    'cycles list status must be changed through the two-option toggle control',
  );
  assert.match(
    cyclesPageSource,
    /demoteCurrentActive:\s*patch\.isActive/,
    'publishing a cycle must demote the current approved-and-published cycle',
  );
  const updateStatusStart = cyclesServiceSource.indexOf('async updateStatus(');
  const updateStatusEnd = cyclesServiceSource.indexOf('\n  async update(', updateStatusStart);
  const updateStatusSource = cyclesServiceSource.slice(updateStatusStart, updateStatusEnd);
  assert.ok(updateStatusStart >= 0 && updateStatusEnd > updateStatusStart, 'cycles service must expose updateStatus');
  assert.match(
    updateStatusSource,
    /query:\s*\{\s*demoteCurrentActive:\s*options\.demoteCurrentActive\s*\}/,
    'cycle status transition must send demoteCurrentActive as a query parameter so backend activation swap is honored',
  );
  assert.doesNotMatch(
    cyclesPageSource,
    /SETUP_LOCKED_HINT|isSetupDisabled\s*=\s*!isCycleActiveByListStatus/,
    'setup wizard must be available for draft/review cycles, not only published cycles',
  );
  assert.match(
    cyclesPageSource,
    /openSetupWizard\(c\.id\)/,
    'cycles list setup button must open setup wizard for the selected cycle',
  );
  assert.doesNotMatch(
    cyclesServiceSource,
    /cycle\.isActive\s*===\s*true\s*\|\|/,
    'active-cycle predicates must not let a stale isActive flag override draft/review status',
  );

  console.log('cycle status activation contract checks passed');
} finally {
  await rm(outDir, { recursive: true, force: true });
}
