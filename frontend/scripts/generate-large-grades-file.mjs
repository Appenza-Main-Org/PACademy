#!/usr/bin/env node
/**
 * Generate a synthetic large-scale Thanaweya grades workbook for stress-
 * testing the applicant-grades import wizard.
 *
 *   node frontend/scripts/generate-large-grades-file.mjs [rows] [out] [format]
 *
 * Defaults: 700_000 rows → /tmp/applicant-grades-700k.csv (csv format)
 * Use `xlsx` for the third arg to write an .xlsx instead — note that
 * SheetJS's `aoa_to_sheet` materialises the whole sparse cell object in
 * memory, so xlsx output above ~250k rows requires `NODE_OPTIONS=
 * --max-old-space-size=8192` and a few minutes. CSV streams to disk
 * line-by-line and finishes in seconds at 700k rows.
 *
 * The output mirrors the template headers exactly so the wizard's
 * auto-mapping step claims every column without manual picks.
 */

import { createWriteStream } from 'node:fs';
import { resolve } from 'node:path';

const ROWS = Number(process.argv[2] ?? 700_000);
const FORMAT_RAW = (process.argv[4] ?? 'csv').toLowerCase();
const FORMAT = FORMAT_RAW === 'xlsx' ? 'xlsx' : 'csv';
const DEFAULT_OUT = `/tmp/applicant-grades-${Math.round(ROWS / 1000)}k.${FORMAT}`;
const OUT = resolve(process.argv[3] ?? DEFAULT_OUT);

const HEADERS = [
  'الرقم القومي',
  'رقم الجلوس',
  'الاسم باللغة العربية',
  'النوع',
  'الشعبة',
  'سنة التخرج',
  'فئة المدرسة',
  'المجموع الكلي',
  'الدرجة العظمى',
];

const BRANCHES = ['علمي علوم', 'علمي رياضة', 'أدبي'];
const GENDERS = ['ذكر', 'أنثى'];
const SCHOOL_CATEGORIES = ['حكومي', 'تجريبي', 'خاص', 'لغات', 'دولي'];

function nid(i) {
  // 14-digit deterministic NID; first digit `3` keeps it Egyptian-looking.
  const base = String(30412000000000n + BigInt(i));
  return base.slice(0, 14);
}

function pad6(n) {
  return String(n).padStart(6, '0');
}

function row(i) {
  return [
    nid(i),
    pad6(140000 + (i % 900000)),
    `طالب رقم ${i + 1}`,
    GENDERS[i % GENDERS.length],
    BRANCHES[i % BRANCHES.length],
    String(2024 + (i % 3)),
    SCHOOL_CATEGORIES[i % SCHOOL_CATEGORIES.length],
    String(300 + (i % 110)),
    '410',
  ];
}

console.log(`Generating ${ROWS.toLocaleString('en')} rows → ${OUT} (${FORMAT})`);

if (FORMAT === 'csv') {
  /* BOM-prefixed UTF-8 so Excel + the wizard's CSV path both pick up the
   * encoding correctly. The wizard's parser reads the file as
   * `File.text()` which decodes as UTF-8 by default. */
  const stream = createWriteStream(OUT, { encoding: 'utf-8' });
  stream.write('﻿');
  stream.write(HEADERS.join(',') + '\n');
  for (let i = 0; i < ROWS; i += 1) {
    stream.write(row(i).join(',') + '\n');
    if ((i + 1) % 50_000 === 0) {
      console.log(`  ${(i + 1).toLocaleString('en')} / ${ROWS.toLocaleString('en')}`);
    }
  }
  await new Promise((res, rej) => stream.end((err) => (err ? rej(err) : res())));
  console.log(`✓ Wrote ${OUT}`);
} else {
  const { utils, write } = await import('xlsx');
  const { writeFile } = await import('node:fs/promises');
  console.log('  building in-memory sheet (this will use lots of RAM)…');
  const aoa = [HEADERS];
  for (let i = 0; i < ROWS; i += 1) aoa.push(row(i));
  const sheet = utils.aoa_to_sheet(aoa);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, sheet, 'درجات المتقدمين');
  const bin = write(wb, { bookType: 'xlsx', type: 'array' });
  await writeFile(OUT, Buffer.from(bin));
  console.log(`✓ Wrote ${OUT}`);
}
