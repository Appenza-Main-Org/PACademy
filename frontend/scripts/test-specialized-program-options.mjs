import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '..');
const outDir = path.join(frontendRoot, '.tmp-tests');
const outFile = path.join(outDir, 'specialized-program-options.mjs');

await mkdir(outDir, { recursive: true });
try {
  await build({
    entryPoints: [path.join(frontendRoot, 'src/features/applicant-portal/lib/specialized-program-options.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: outFile,
    logLevel: 'silent',
  });

  const { toSpecializedProgramPickerOptions } = await import(pathToFileURL(outFile).href);

  const options = toSpecializedProgramPickerOptions([
    {
      facultyCode: 'FAC-01',
      facultyName: 'الطب البشري',
      specializationCode: 'SPC-01',
      specializationName: 'جراحة عامة',
      reason: 'مطابق للسن والنوع',
    },
    {
      facultyCode: 'FAC-01',
      facultyName: 'الطب البشري',
      specializationCode: 'SPC-02',
      specializationName: 'جراحة مخ وأعصاب',
      reason: 'مطابق للسن والنوع',
    },
    {
      facultyCode: 'FAC-01',
      facultyName: 'الطب البشري',
      specializationCode: 'SPC-01',
      specializationName: 'جراحة عامة',
      reason: 'صف مكرر من الخادم',
    },
  ]);

  assert.deepEqual(
    options.faculties.map((row) => row.code),
    ['FAC-01'],
    'faculties should be de-duplicated from allowed academicPrograms',
  );
  assert.deepEqual(
    options.specializations.map((row) => row.code),
    ['SPC-01', 'SPC-02'],
    'specializations should include only allowed academicPrograms',
  );
  assert.equal(
    options.specializations.every((row) => row.facultyCode === 'FAC-01'),
    true,
    'specializations should retain their faculty scope',
  );

  console.log('specialized program option tests passed');
} finally {
  await rm(outDir, { recursive: true, force: true });
}
