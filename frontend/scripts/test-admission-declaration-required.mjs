import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '..');
const outDir = path.join(frontendRoot, '.tmp-tests');
const outFile = path.join(outDir, 'admission-declaration-required.mjs');

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

const cycle = {
  id: 'cycle-2026',
  nameAr: 'دورة 2026',
  cohort: 'male',
  year: 2026,
  openDate: '2026-01-01T00:00:00.000Z',
  closeDate: '2026-12-31T23:59:59.000Z',
  expectedCapacity: 1000,
  applicantCount: 0,
  status: 'draft',
  isActive: false,
  openCategories: {},
};

const baseInputs = {
  cycle,
  categories: [],
  committees: [],
  declaration: null,
};

await mkdir(outDir, { recursive: true });
try {
  await build({
    entryPoints: [path.join(frontendRoot, 'src/features/admin/admission-setup/lib/step-status.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: outFile,
    logLevel: 'silent',
    plugins: [aliasPlugin],
  });

  const {
    computeStepStatus,
    hasElectronicDeclarationContent,
  } = await import(pathToFileURL(outFile).href);

  const emptyDeclaration = {
    id: 'dec-empty',
    cycleId: cycle.id,
    mode: 'text',
    bodyAr: '   ',
    document: null,
    version: 1,
    effectiveFrom: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'admin',
    deletedAt: null,
  };

  assert.equal(
    hasElectronicDeclarationContent(emptyDeclaration),
    false,
    'blank text and no PDF must not count as declaration content',
  );
  assert.equal(
    computeStepStatus('electronic_declaration', {
      ...baseInputs,
      declaration: emptyDeclaration,
    }),
    'not_started',
    'electronic declaration step must remain incomplete without text or uploaded PDF',
  );

  assert.equal(
    computeStepStatus('electronic_declaration', {
      ...baseInputs,
      declaration: { ...emptyDeclaration, bodyAr: 'أقر بصحة البيانات المقدمة.' },
    }),
    'complete',
    'saved declaration text must complete the electronic declaration step',
  );

  assert.equal(
    computeStepStatus('electronic_declaration', {
      ...baseInputs,
      declaration: {
        ...emptyDeclaration,
        mode: 'pdf',
        document: {
          fileName: 'declaration.pdf',
          fileUrl: '/uploads/declaration.pdf',
          size: 42_000,
        },
      },
    }),
    'complete',
    'uploaded declaration PDF must complete the electronic declaration step',
  );

  console.log('admission declaration required contract checks passed');
} finally {
  await rm(outDir, { recursive: true, force: true });
}
