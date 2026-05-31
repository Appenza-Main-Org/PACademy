import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, '..');
const outDir = path.join(frontendRoot, '.tmp-tests');
const outFile = path.join(outDir, 'applicant-certificate-type-options.mjs');

await mkdir(outDir, { recursive: true });
try {
  await build({
    entryPoints: [path.join(frontendRoot, 'src/features/applicant-portal/lib/certificate-type-options.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: outFile,
    logLevel: 'silent',
  });

  const {
    buildManualCertificateTypeOptions,
    shouldShowSecondaryCertificateNotFoundMessage,
  } = await import(pathToFileURL(outFile).href);

  const schoolCategories = [
    { code: 'SCH-01', name: 'الثانوية العامة', isActive: true, externalGradesImport: true },
    { code: 'SCH-03', name: 'الثانوية الأزهرية', isActive: true, externalGradesImport: true },
    { code: 'SCH-05', name: 'الشهادة الثانوية من الخارج', isActive: true, externalGradesImport: false },
    { code: 'SCH-06', name: 'الدبلومات الأجنبية', isActive: true, externalGradesImport: false },
    { code: 'SCH-07', name: 'مدارس المتفوقين STEM', isActive: true, externalGradesImport: true },
    { code: 'SCH-99', name: 'فئة متوقفة', isActive: false, externalGradesImport: false },
  ];

  assert.deepEqual(
    buildManualCertificateTypeOptions(schoolCategories, 'officers_general').map((option) => option.label),
    ['الشهادة الثانوية من الخارج', 'الدبلومات الأجنبية'],
    'general section manual certificate options should be limited to foreign/manual categories',
  );

  assert.deepEqual(
    buildManualCertificateTypeOptions(schoolCategories, 'specialized_officers').map((option) => option.label),
    [
      'الثانوية العامة',
      'الثانوية الأزهرية',
      'الشهادة الثانوية من الخارج',
      'الدبلومات الأجنبية',
      'مدارس المتفوقين STEM',
    ],
    'non-general sections should show all active certificate categories',
  );

  assert.equal(
    shouldShowSecondaryCertificateNotFoundMessage('officers_general'),
    true,
    'general section should show the secondary-certificate-not-found message',
  );
  assert.equal(
    shouldShowSecondaryCertificateNotFoundMessage('specialized_officers'),
    false,
    'non-general sections should not show the general-section warning',
  );

  console.log('applicant certificate type option filtering tests passed');
} finally {
  await rm(outDir, { recursive: true, force: true });
}
