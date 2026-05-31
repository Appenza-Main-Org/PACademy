import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function assertContains(source, needle, message) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}

const layout = read('src/features/applicant-portal/ApplicantPortalLayout.tsx');
const wizard = read('src/shared/components/Wizard.tsx');

assertContains(
  layout,
  'const handleStepClick = (key: string): void => {',
  'Applicant portal layout must expose a guarded step-click handler.',
);
assertContains(
  layout,
  'if (applicationLocked || targetIndex === -1 || targetIndex > activeIndex) return;',
  'Applicant step clicks must be limited to current/previous stages before exam-date lock.',
);
assertContains(
  layout,
  'onStepClick={applicationLocked ? undefined : handleStepClick}',
  'Applicant Wizard must receive the guarded step-click handler until exam appointment selection is completed.',
);

assertContains(
  wizard,
  "s.state === 'complete' || s.state === 'current'",
  'Wizard stepper must not make upcoming stages clickable when a step-click handler is present.',
);

console.log('applicant wizard navigation regression checks passed');
