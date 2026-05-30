import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const sourcePath = new URL('../src/features/applicant-portal/lib/grade-prefill.ts', import.meta.url);
const source = fs.readFileSync(sourcePath, 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const sandbox = { exports: {}, require: () => ({}) };
vm.runInNewContext(transpiled, sandbox, { filename: sourcePath.pathname });
const { mapEligibilityGradeToGradeRow, getEligibilityGradeExtras } = sandbox.exports;

const grade = {
  id: '1B93CEA5-235A-4032-A6B6-0A2D7A10F65E',
  adminRecordId: '10032',
  seat: 10032,
  nid: '30801151401753',
  seatingNumber: '1588492',
  name: 'عمر طارق محمود البدري',
  kind: 'general',
  gender: 'ذكر',
  branch: 'الشعبة العلمية - رياضيات',
  graduationYear: 2026,
  schoolCategoryCode: 'SCH-01',
  school: 'نور المعارف',
  region: '',
  total: 405,
  importMax: 410,
  status: 'مستجد',
  previousGrade: 402,
  createdAt: '2026-05-29T21:33:59.5608626Z',
  updatedAt: '2026-05-29T21:40:21.8147988Z',
  rowVersion: '0x000000000000a24d',
  log: [],
  gradesSource: 'استيراد خارجي',
};

const row = mapEligibilityGradeToGradeRow(grade);
assert.ok(row, 'grade should map to a GradeRow');
assert.equal(row.seat, 10032);
assert.equal(row.seatingNumber, '1588492');
assert.equal(row.nid, '30801151401753');
assert.equal(row.name, 'عمر طارق محمود البدري');
assert.equal(row.kind, 'general');
assert.equal(row.gender, 'male');
assert.equal(row.branch, 'علمي رياضة');
assert.equal(row.graduationYear, 2026);
assert.equal(row.schoolCategoryCode, 'SCH-01');
assert.equal(row.school, 'نور المعارف');
assert.equal(row.total, 405);
assert.equal(row.importMax, 410);
assert.equal(row.previousGrade, 402);

const extras = getEligibilityGradeExtras(grade);
assert.equal(extras.country, 'مصر');
assert.equal(extras.gradDate, '');
console.log('stage345 eligibility grade mapping ok');
