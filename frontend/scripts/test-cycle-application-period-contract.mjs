import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '..');
const outDir = path.join(frontendRoot, '.tmp-tests');
const outFile = path.join(outDir, 'cycle-application-period.mjs');

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
    entryPoints: [path.join(frontendRoot, 'src/features/admin/api/cycles.service.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: outFile,
    logLevel: 'silent',
    plugins: [aliasPlugin],
  });

  const {
    findActiveCycleApplicationPeriodOverlap,
    resolveCycleApplicationPeriod,
    validateCycleApplicationPeriod,
  } = await import(pathToFileURL(outFile).href);

  const activeCycle = {
    id: 'active',
    nameAr: 'الدورة النشطة',
    cohort: 'male',
    year: 2026,
    openDate: '2026-01-15T00:00:00.000Z',
    closeDate: '2026-12-31T23:59:59.000Z',
    expectedCapacity: 2000,
    applicantCount: 0,
    status: 'active',
    isActive: true,
    openCategories: {
      officers_general: {
        isOpen: true,
        capacity: 100,
        notes: '',
        startDate: '2026-01-15',
        endDate: '2026-03-31',
      },
      specialized_officers: {
        isOpen: true,
        capacity: 100,
        notes: '',
        startDate: '2026-02-01',
        endDate: '2026-04-15',
      },
      law_bachelor: {
        isOpen: false,
        capacity: null,
        notes: '',
        startDate: '2026-05-01',
        endDate: '2026-05-31',
      },
    },
  };

  assert.deepEqual(
    resolveCycleApplicationPeriod(activeCycle),
    { startDate: '2026-01-15', endDate: '2026-04-15' },
    'cycle application period must use first open category start and last open category end',
  );

  assert.deepEqual(
    validateCycleApplicationPeriod({ startDate: '', endDate: '2026-04-01' }),
    { startDate: 'تاريخ بداية التقديم مطلوب' },
    'start date must be required',
  );
  assert.deepEqual(
    validateCycleApplicationPeriod({ startDate: '2026-05-01', endDate: '2026-04-01' }),
    { endDate: 'تاريخ نهاية التقديم يجب ألا يسبق تاريخ البداية' },
    'end date must not be before start date',
  );

  assert.equal(
    findActiveCycleApplicationPeriodOverlap(
      [activeCycle],
      { startDate: '2026-04-15', endDate: '2026-05-01' },
    )?.id,
    'active',
    'periods sharing a boundary day must overlap',
  );
  assert.equal(
    findActiveCycleApplicationPeriodOverlap(
      [activeCycle],
      { startDate: '2026-04-16', endDate: '2026-05-01' },
    ),
    null,
    'a period after the active application submission end must be allowed',
  );
  assert.equal(
    findActiveCycleApplicationPeriodOverlap(
      [activeCycle],
      { startDate: '2026-01-15', endDate: '2026-04-15' },
      'active',
    ),
    null,
    'a cycle must not conflict with its own active period',
  );

  const cycleNewSource = await readFile(
    path.join(frontendRoot, 'src/features/admin/pages/CycleNewPage.tsx'),
    'utf8',
  );
  assert.match(
    cycleNewSource,
    /register\(['"]startDate['"]\)/,
    'create form must expose application start date directly',
  );
  assert.match(
    cycleNewSource,
    /register\(['"]endDate['"]\)/,
    'create form must expose application end date directly',
  );

  const categoriesPanelSource = await readFile(
    path.join(frontendRoot, 'src/features/admin/components/cycles/CategoriesPanel.tsx'),
    'utf8',
  );
  const cyclesPageSource = await readFile(
    path.join(frontendRoot, 'src/features/admin/pages/CyclesPage.tsx'),
    'utf8',
  );
  assert.match(
    categoriesPanelSource,
    /أول تاريخ متاح للتقديم/,
    'categories section must display the first available application start date',
  );
  assert.match(
    categoriesPanelSource,
    /آخر موعد لتسليم الطلب/,
    'categories section must display the last application submission end date',
  );
  assert.match(
    cyclesPageSource,
    /key:\s*['"]applicationStartDate['"]/,
    'cycles list must render a dedicated application start date column',
  );
  assert.match(
    cyclesPageSource,
    /key:\s*['"]applicationEndDate['"]/,
    'cycles list must render a dedicated application end date column',
  );
  assert.doesNotMatch(
    cyclesPageSource,
    /key:\s*['"]applicationPeriod['"]/,
    'cycles list must not collapse start/end into one application period column',
  );

  console.log('cycle application period contract checks passed');
} finally {
  await rm(outDir, { recursive: true, force: true });
}
