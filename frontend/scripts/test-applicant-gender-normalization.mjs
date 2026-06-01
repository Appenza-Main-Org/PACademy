import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '..');
const outDir = path.join(frontendRoot, '.tmp-tests');
const outFile = path.join(outDir, 'applicant-gender.mjs');

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
    entryPoints: [path.join(frontendRoot, 'src/features/applicant-portal/lib/applicant-gender.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: outFile,
    logLevel: 'silent',
    plugins: [aliasPlugin],
  });

  const { normalizeApplicantGender } = await import(pathToFileURL(outFile).href);

  assert.equal(normalizeApplicantGender('female', '30412180103446'), 'female');
  assert.equal(normalizeApplicantGender('Female', '30412180103446'), 'female');
  assert.equal(normalizeApplicantGender('أنثى', '30412180103446'), 'female');
  assert.equal(normalizeApplicantGender(null, '30412180103446'), 'female');

  assert.equal(normalizeApplicantGender('male', '30412180103456'), 'male');
  assert.equal(normalizeApplicantGender('Male', '30412180103456'), 'male');
  assert.equal(normalizeApplicantGender('ذكر', '30412180103456'), 'male');
  assert.equal(normalizeApplicantGender(undefined, '30412180103456'), 'male');

  assert.equal(
    normalizeApplicantGender('female', '30412180103456'),
    'female',
    'saved/MOI gender should win over NID fallback when explicitly provided',
  );

  console.log('applicant gender normalization tests passed');
} finally {
  await rm(outDir, { recursive: true, force: true });
}
