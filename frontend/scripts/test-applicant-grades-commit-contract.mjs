import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '..');
const outDir = path.join(frontendRoot, '.tmp-tests');
const entryFile = path.join(outDir, 'applicant-grades-commit-entry.ts');
const outFile = path.join(outDir, 'applicant-grades-commit-contract.mjs');

const apiClientStub = `
globalThis.__applicantGradesCommitCalls = [];
export const apiClient = {
  post: async (url, payload) => {
    globalThis.__applicantGradesCommitCalls.push({ url, payload });
    return { insertedCount: 1, failedCount: 0, alreadyImportedCount: 0 };
  },
  get: async () => null,
  delete: async () => null,
  patch: async () => null
};
`;

const errorsStub = `
export function isNotFoundError() {
  return false;
}
`;

const aliasPlugin = {
  name: 'src-alias-and-api-stub',
  setup(buildContext) {
    buildContext.onResolve({ filter: /^@\/shared\/lib\/api-client$/ }, () => ({
      path: 'api-client-stub',
      namespace: 'test-stub',
    }));
    buildContext.onResolve({ filter: /^@\/shared\/lib\/errors$/ }, () => ({
      path: 'errors-stub',
      namespace: 'test-stub',
    }));
    buildContext.onLoad({ filter: /^api-client-stub$/, namespace: 'test-stub' }, () => ({
      contents: apiClientStub,
      loader: 'js',
    }));
    buildContext.onLoad({ filter: /^errors-stub$/, namespace: 'test-stub' }, () => ({
      contents: errorsStub,
      loader: 'js',
    }));
    buildContext.onResolve({ filter: /^@\// }, (args) => {
      const base = path.join(frontendRoot, 'src', args.path.slice(2));
      const resolved = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]
        .find((candidate) => existsSync(candidate));
      return { path: resolved ?? base };
    });
  },
};

await mkdir(outDir, { recursive: true });
await writeFile(
  entryFile,
  `
  import { gradesService } from '../src/features/applicant-grades/api/grades.service';
  export async function runContractProbe() {
    await gradesService.runImportCommit({
      rows: [{
        nationalId: '30601232335315',
        seatingNumber: '1000992',
        nameAr: 'طالب تجريبي',
        gender: 'male',
        track: 'علمي',
        graduationYear: 2026,
        totalGrade: 410,
        maxGrade: 410,
        schoolCategory: 'SCH-01',
        examRound: null,
        schoolName: 'مدرسة اختبار',
        regionName: 'القاهرة',
        sourceRowIndex: 1
      }],
      graduationYear: 2026,
      selectedSchoolCategories: ['SCH-01'],
      maxGradeByCategory: { 'SCH-01': 410 },
      perGroupActions: { DUPLICATE_NID: 'skip' },
      existingDiffDecisions: { '30601232335315': 'accept' },
      uploadDuplicateDecisions: {
        '30601232335315': { action: 'pick-row', pickedSourceRowIndex: 1 }
      }
    });
    return globalThis.__applicantGradesCommitCalls;
  }
  `,
);

try {
  await build({
    entryPoints: [entryFile],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: outFile,
    logLevel: 'silent',
    plugins: [aliasPlugin],
  });

  const { runContractProbe } = await import(pathToFileURL(outFile).href);
  const calls = await runContractProbe();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/admin/applicant-grades/v2/commit');
  assert.deepEqual(calls[0].payload.existingDiffDecisions, [
    { nationalId: '30601232335315', action: 'override' },
  ]);
  assert.deepEqual(calls[0].payload.uploadDuplicateDecisions, [
    { nationalId: '30601232335315', action: 'pick-row', sourceRowIndex: 1 },
  ]);

  console.log('applicant grades commit contract tests passed');
} finally {
  await rm(outDir, { recursive: true, force: true });
}
