import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const frontendRoot = resolve(scriptDir, '..');
const outDir = resolve(frontendRoot, '.tmp-test/exam-publishing');
rmSync(outDir, { recursive: true, force: true });
execFileSync(
  process.execPath,
  [
    resolve(frontendRoot, 'node_modules/typescript/bin/tsc'),
    'src/features/exams/lib/exam-publishing.ts',
    '--target',
    'ES2022',
    '--module',
    'ES2022',
    '--moduleResolution',
    'bundler',
    '--rootDir',
    'src/features/exams/lib',
    '--outDir',
    '.tmp-test/exam-publishing',
    '--skipLibCheck',
  ],
  { cwd: frontendRoot, stdio: 'inherit' },
);

const {
  buildExamRoomUrl,
  createPublishToken,
  getPublishedExamRoomUrl,
  isIpAllowed,
  normaliseIpAllowlist,
} = await import(pathToFileURL(resolve(outDir, 'exam-publishing.js')).href);

assert.equal(createPublishToken('EXAM-0001'), 'exam-exam-0001');
assert.equal(createPublishToken('قدرات عامة 2026'), 'exam-2026');
assert.equal(createPublishToken(''), 'exam-room');

assert.equal(
  buildExamRoomUrl('exam-exam-0001', 'https://admin-staging.appenzademo.com/question-bank/exams'),
  'https://admin-staging.appenzademo.com/exam-room/exam-exam-0001',
);
assert.equal(buildExamRoomUrl('exam-exam-0001', ''), '/exam-room/exam-exam-0001');
assert.equal(
  getPublishedExamRoomUrl({ id: 'EXAM-2026-CAP-01' }, 'https://admin-staging.appenzademo.com/question-bank/exams/EXAM-2026-CAP-01'),
  'https://admin-staging.appenzademo.com/exam-room/exam-exam-2026-cap-01',
);
assert.equal(
  getPublishedExamRoomUrl({ id: 'EXAM-2026-CAP-01', publishedUrl: 'https://example.test/exam-room/custom' }, ''),
  'https://example.test/exam-room/custom',
);

assert.deepEqual(
  normaliseIpAllowlist('10.20.14.11\n10.20.14.12, 10.20.14.*\n\n10.20.14.11'),
  ['10.20.14.11', '10.20.14.12', '10.20.14.*'],
);

assert.equal(isIpAllowed('10.20.14.11', ['10.20.14.11']), true);
assert.equal(isIpAllowed('10.20.14.77', ['10.20.14.*']), true);
assert.equal(isIpAllowed('10.20.15.77', ['10.20.14.*']), false);
assert.equal(isIpAllowed('10.20.14.11', []), false);
assert.equal(isIpAllowed('', ['10.20.14.11']), false);

rmSync(outDir, { recursive: true, force: true });
console.log('exam publishing helpers ok');
