# Applicant attendance-card — print-regression screenshots

> **Status:** awaiting designer screenshots before the demo cut.

## Why this folder exists

The Stage 9 print-card layout was modified across **AF-11 → AF-17** during
the applicant-flow alignment pass (`applicant-flow-aligned`,
[`213f2b5`](https://github.com/anthropics/apps/commit/213f2b5)) to match
the printed reference card (`بطاقة التردد`):

- AF-11 — title `بطاقة التردد`
- AF-12 — اللجنة row + arabic ordinal
- AF-13 — `رقم الملف` relabel
- AF-14 — Fawry payment-ref line
- AF-15 — exam-date prose sentence
- AF-16 — committee ordinal under the barcode
- AF-17 — `كشف ومواعيد الإختبارات` table

Print regressions are silent — DOM still typechecks and renders on
screen even when the printed PDF/A4 layout breaks (Khayameya stripe
clipped, RTL flipped, page break in the middle of a row, etc.). The
only durable defence is before/after screenshots.

## What to capture

Run the dev server (`npm --prefix frontend run dev`), navigate to
`/applicant/print-card`, trigger print preview (browser → File → Print
or `cmd+P`), and capture screenshots of:

| File | Captures |
|---|---|
| `before.png` | The pre-AF print layout. **Use git checkout to step back to `0d64fc4` for the baseline reference**, then step forward to `applicant-flow-aligned` for the after. |
| `after.png` | The current post-AF layout. |
| `after-empty-payment.png` | Edge: applicant who hasn't paid yet — Fawry line should be hidden. |
| `after-multi-row-table.png` | Edge: when more than one row is in the كشف table, page-break behaviour. |

Save as PNG. A4 portrait. Browser at 100% zoom (no hi-DPI scaling).

## Contract: what the after screenshots must show

- `بطاقة التردد` heading at the top.
- Identity strip with 4 fields (right column): `اسم الطالب`, `اللجنة`,
  `رقم الملف`, `الرقم القومى`.
- Fawry ref line `تم الدفع بواسطة فورى بالمدفوعة رقم: …` rendered with
  Eastern Arabic-Indic numerals.
- Exam-date prose sentence: `تاريخ إختبار قدرات يوم … الساعة … …`.
- Code 128 barcode with `اللجنة [ordinal]` printed beneath the bars.
- 5-column table: م / الإختبار / التاريخ / النتيجة / ملاحظات.
- Khayameya stripe at the bottom; LogoMark in the signature block.
- A4 portrait orientation; RTL preserved; no `dir: ltr` leak on the
  page level.

If any of those fail in the after screenshot, treat it as a P0
regression and revert/fix before merging the demo build.

## Tracked in

- `docs/APPLICANT_FLOW_ALIGNMENT_REPORT.md` §8 closeout, item 1.
- `docs/APPLICANT_FLOW_VERIFICATION_REPORT.md` (verification pass).
