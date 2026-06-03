import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const tabsSource = await readFile(
  new URL('../src/shared/components/Tabs.tsx', import.meta.url),
  'utf8',
);
const editorSource = await readFile(
  new URL('../src/features/admin/components/exams/ExamPlanEditor.tsx', import.meta.url),
  'utf8',
);

assert.match(
  tabsSource,
  /data-\[state=inactive\]:hidden/,
  'forced Tabs.Panel content must remain mounted but hidden while inactive',
);

assert.match(
  editorSource,
  /className="[^"]*border-border-default[^"]*text-ink-700[^"]*disabled:text-ink-300/s,
  'exam-plan up/down arrow buttons need explicit visible and disabled colors',
);

console.log('exam plan wizard visual contract checks passed');
