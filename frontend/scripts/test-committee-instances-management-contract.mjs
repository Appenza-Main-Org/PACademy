import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pageSource = await readFile(
  new URL('../src/features/admin/pages/CommitteeInstancesPage.tsx', import.meta.url),
  'utf8',
);
const addFormSource = await readFile(
  new URL('../src/features/admin/admission-setup/components/committeeBinding/CommitteeInstanceAddForm.tsx', import.meta.url),
  'utf8',
);

assert.match(
  pageSource,
  /اسم الاختبار/,
  'committee schedule grid must expose a clear Exam Name column',
);
assert.match(
  pageSource,
  /تاريخ الاختبار/,
  'committee schedule grid must expose an Exam Date column for every row',
);
assert.match(
  pageSource,
  /<DateCell\s+value=\{row\.date\}/,
  'exam date must be rendered inside each schedule row, not only in the day header',
);

assert.doesNotMatch(
  pageSource,
  /MoveRight|TransferCommitteeDialog|TransferDayDialog|TransferModeChooser|نقل اليوم|>نقل</,
  'committee schedule management must not expose move/transfer actions',
);

assert.match(
  pageSource,
  /لا يمكن حذف هذا اليوم لأن به حجوزات قائمة للمتقدمين/,
  'day delete validation must explain that applicant bookings block deletion',
);
assert.match(
  pageSource,
  /لا يمكن حذف هذا الموعد لأن به حجوزات قائمة للمتقدمين/,
  'row delete validation must explain that applicant bookings block deletion',
);

assert.match(
  addFormSource,
  /AlertDialog/,
  'duplicate day capacity additions must use a validation confirmation dialog',
);
assert.match(
  addFormSource,
  /زيادة السعة الحالية/,
  'duplicate day dialog must offer increasing the existing capacity',
);
assert.match(
  addFormSource,
  /إلغاء العملية/,
  'duplicate day dialog must offer canceling the operation',
);

console.log('committee instances management contract checks passed');
