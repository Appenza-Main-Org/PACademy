import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const sourcePath = new URL('../src/features/admin/admission-setup/lib/exam-plan-step.ts', import.meta.url);
const source = await readFile(sourcePath, 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
  },
}).outputText;

const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
const {
  findCategoriesMissingExams,
  hasExamPlanOrderErrors,
  formatMissingExamCategoriesMessage,
} = await import(moduleUrl);

const categories = [
  { key: 'officers_general', labelAr: 'الثانوية العامة وما يعادلها' },
  { key: 'law_bachelor', labelAr: 'ليسانس الحقوق' },
  { key: 'specialized_officers', labelAr: 'الضباط المتخصصون' },
];

assert.deepEqual(
  findCategoriesMissingExams(categories, {
    officers_general: {
      entries: [{ examId: 'medical', order: 1, isRequired: true }],
      hasOrderError: false,
      isLoading: false,
    },
    law_bachelor: {
      entries: [],
      hasOrderError: false,
      isLoading: false,
    },
    specialized_officers: {
      entries: [{ examId: 'fitness', order: 1, isRequired: true }],
      hasOrderError: false,
      isLoading: false,
    },
  }),
  [{ key: 'law_bachelor', labelAr: 'ليسانس الحقوق' }],
);

assert.equal(
  formatMissingExamCategoriesMessage([{ key: 'law_bachelor', labelAr: 'ليسانس الحقوق' }]),
  'يجب إضافة اختبار واحد على الأقل لفئة ليسانس الحقوق قبل الانتقال للخطوة التالية.',
);

assert.equal(
  formatMissingExamCategoriesMessage([
    { key: 'law_bachelor', labelAr: 'ليسانس الحقوق' },
    { key: 'specialized_officers', labelAr: 'الضباط المتخصصون' },
  ]),
  'يجب إضافة اختبار واحد على الأقل للفئات التالية قبل الانتقال للخطوة التالية: ليسانس الحقوق، الضباط المتخصصون.',
);

assert.equal(
  hasExamPlanOrderErrors([
    { examId: 'medical', order: 1, isRequired: true },
    { examId: 'fitness', order: 1, isRequired: true },
  ]),
  true,
);

assert.equal(
  hasExamPlanOrderErrors([
    { examId: 'medical', order: 1, isRequired: true },
    { examId: 'fitness', order: 2, isRequired: false },
  ]),
  false,
);

console.log('exam plan step validation checks passed');
