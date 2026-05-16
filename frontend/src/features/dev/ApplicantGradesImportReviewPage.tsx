/**
 * Dev-only review surface for the v2 applicant-grades import wizard.
 *
 * Drives each of the six steps in isolation against a hardcoded
 * `ParsedSheet` fixture so we can exercise the UI without spinning up
 * the upload + parse path. Mounted at `/_dev/applicant-grades-import`
 * only in `import.meta.env.DEV` builds.
 *
 * Shares the same shell as `/_dev/primitives` — page header + minimal
 * chrome + step-by-step navigation buttons.
 */

import { useEffect } from 'react';
import { Button, PageHeader } from '@/shared/components';
import { useImportWizardStore } from '../applicant-grades/store/importWizard.store';
import { autoMapColumns } from '../applicant-grades/lib/targetFields';
import { Step1Settings } from '../applicant-grades/components/importWizard/steps/Step1Settings';
import { Step2TableSelect } from '../applicant-grades/components/importWizard/steps/Step2TableSelect';
import { Step3ColumnMapping } from '../applicant-grades/components/importWizard/steps/Step3ColumnMapping';
import { Step4Filters } from '../applicant-grades/components/importWizard/steps/Step4Filters';
import { Step5DuplicateReview } from '../applicant-grades/components/importWizard/steps/Step5DuplicateReview';
import { Step6Result } from '../applicant-grades/components/importWizard/steps/Step6Result';
import type { ParsedSheet } from '../applicant-grades/lib/parseGradesFile';

const FIXTURE: ParsedSheet = {
  sourceName: 'sample-general-dev.csv',
  format: 'csv',
  tables: [
    {
      name: 'بيانات',
      columns: [
        'الرقم القومي',
        'رقم الجلوس',
        'الاسم باللغة العربية',
        'النوع',
        'الشعبة',
        'سنة التخرج',
        'المجموع الكلي',
        'الدرجة العظمى',
      ],
      rows: [
        {
          'الرقم القومي': '30412180103456',
          'رقم الجلوس': '142018',
          'الاسم باللغة العربية': 'أحمد محمد إبراهيم سعد',
          'النوع': 'ذكر',
          'الشعبة': 'علمي علوم',
          'سنة التخرج': '2026',
          'المجموع الكلي': 392,
          'الدرجة العظمى': 410,
        },
        {
          'الرقم القومي': '30406240178923',
          'رقم الجلوس': '142119',
          'الاسم باللغة العربية': 'محمود السيد عبد الرحمن',
          'النوع': 'ذكر',
          'الشعبة': 'علمي رياضة',
          'سنة التخرج': '2026',
          'المجموع الكلي': 367,
          'الدرجة العظمى': 410,
        },
        {
          'الرقم القومي': 'BAD-NID',
          'رقم الجلوس': '142200',
          'الاسم باللغة العربية': 'صف برقم قومي خاطئ',
          'النوع': 'ذكر',
          'الشعبة': 'علمي علوم',
          'سنة التخرج': '2026',
          'المجموع الكلي': 410,
          'الدرجة العظمى': 410,
        },
        {
          'الرقم القومي': '30410050189012',
          'رقم الجلوس': '142204',
          'الاسم باللغة العربية': null,
          'النوع': 'ذكر',
          'الشعبة': 'علمي علوم',
          'سنة التخرج': '2026',
          'المجموع الكلي': 600,
          'الدرجة العظمى': 410,
        },
      ],
      rowCount: 4,
    },
  ],
};

export function ApplicantGradesImportReviewPage(): JSX.Element {
  const step = useImportWizardStore((s) => s.step);
  const setStep = useImportWizardStore((s) => s.setStep);
  const setParsed = useImportWizardStore((s) => s.setParsed);
  const setSelectedTableName = useImportWizardStore((s) => s.setSelectedTableName);
  const setMapping = useImportWizardStore((s) => s.setMapping);
  const reset = useImportWizardStore((s) => s.reset);

  useEffect(() => {
    setParsed(FIXTURE);
    const only = FIXTURE.tables[0]!;
    setSelectedTableName(only.name);
    setMapping(autoMapColumns(only.columns));
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-8">
      <PageHeader
        title="مراجعة استيراد درجات المتقدمين — معاينة الخطوات"
        subtitle="صفحة تطويرية لاستعراض كل خطوة من خطوات المُساعِد على بيانات ثابتة"
        actions={
          <Button variant="ghost" onClick={() => reset()}>
            إعادة الضبط
          </Button>
        }
      />

      <div className="mb-4 inline-flex gap-1 rounded-md border border-border-default bg-ink-50 p-1">
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(s as 1 | 2 | 3 | 4 | 5 | 6)}
            className="cursor-pointer rounded-sm border-0 px-3 py-1 text-2xs font-medium"
            style={{
              background: step === s ? 'var(--teal-500)' : 'transparent',
              color: step === s ? '#fff' : 'var(--ink-700)',
            }}
          >
            خطوة {s}
          </button>
        ))}
      </div>

      <section className="rounded-lg border border-border-subtle bg-white p-6">
        {step === 1 && <Step1Settings />}
        {step === 2 && <Step2TableSelect />}
        {step === 3 && <Step3ColumnMapping />}
        {step === 4 && <Step4Filters />}
        {step === 5 && <Step5DuplicateReview />}
        {step === 6 && <Step6Result />}
      </section>
    </div>
  );
}
