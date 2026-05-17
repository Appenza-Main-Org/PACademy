/**
 * Step 2 — مراجعة إعدادات التقديم لكل فئة.
 *
 * Read-only summary screen that lists every configured applicant category
 * alongside its key configuration (specialization count, year count, whether
 * the category is single-axis or multi-axis, locked gender, etc.). The
 * admin reviews this snapshot before moving on to fees.
 *
 * Editing happens on the prior step (`application_settings`). This page
 * intentionally does not write anything — it surfaces the same joined
 * data from `applicationSettingsService.listCategoryConfigs()`.
 */

import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Pencil } from 'lucide-react';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { toEasternArabicNumerals } from '@/shared/lib/arabic';
import { useLookup } from '@/features/lookups';
import { AdmissionSetupShell } from '../components/AdmissionSetupShell';

export function ApplicationSettingsReviewPage(): JSX.Element {
  const configsQuery = useLookup('applicant-categories');

  return (
    <AdmissionSetupShell>
      <div className="flex flex-col gap-4">
        <PageHeader
          title="مراجعة إعدادات التقديم لكل فئة"
          subtitle="ملخص قراءة فقط للإعدادات المضبوطة في الخطوة السابقة. للتعديل، ارجع إلى «إعدادات التقديم»."
        />

        {configsQuery.isLoading && <LoadingState variant="list" />}
        {configsQuery.isError && (
          <ErrorState
            title="تعذر تحميل الملخص"
            description="حاول إعادة المحاولة بعد قليل."
            onRetry={() => configsQuery.refetch()}
          />
        )}
        {configsQuery.data && configsQuery.data.length === 0 && (
          <EmptyState
            variant="generic"
            title="لا توجد فئات مُعدّة بعد"
            description="ابدأ بإضافة الفئات من خطوة إعدادات التقديم."
            action={
              <Link
                to={ROUTES.admin.admissionSetup.wizard('application_settings')}
                className="inline-flex items-center gap-1 text-accent-700 hover:underline"
              >
                <ArrowRight size={14} />
                العودة لإعدادات التقديم
              </Link>
            }
          />
        )}
        {configsQuery.data && configsQuery.data.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {configsQuery.data.map((c) => {
              const isUniversity = (c.type as string) !== 'pre_university';
              const lockedGender = c.genderScope?.length === 1 ? c.genderScope[0] : null;
              const specializationCount = c.specializationCodes?.length ?? 0;
              const facultyCount = c.facultyCodes?.length ?? 0;
              return (
                <Card key={c.code} variant="default" className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2
                          size={16}
                          className={c.isActive ? 'text-teal-600' : 'text-ink-300'}
                        />
                        <h3 className="font-ar-display text-base font-semibold text-ink-900">
                          {c.name}
                        </h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={isUniversity ? 'info' : 'neutral'}>
                          {isUniversity ? 'جامعي' : 'ثانوي'}
                        </Badge>
                        {lockedGender && (
                          <Badge tone={lockedGender === 'male' ? 'info' : 'accent'}>
                            {lockedGender === 'male' ? 'ذكور فقط' : 'إناث فقط'}
                          </Badge>
                        )}
                        {!c.isActive && <Badge tone="warning">معطّلة</Badge>}
                      </div>
                    </div>
                    <Link
                      to={ROUTES.admin.admissionSetup.wizard('application_settings')}
                      className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-accent-700"
                      aria-label={`تعديل إعدادات ${c.name}`}
                    >
                      <Pencil size={14} />
                      تعديل
                    </Link>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="flex flex-col gap-0.5 rounded-md bg-surface-page px-2 py-1.5">
                      <dt className="text-ink-500">الكليات</dt>
                      <dd className="font-numeric tnum text-sm font-semibold text-ink-900">
                        {toEasternArabicNumerals(facultyCount)}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-0.5 rounded-md bg-surface-page px-2 py-1.5">
                      <dt className="text-ink-500">التخصصات</dt>
                      <dd className="font-numeric tnum text-sm font-semibold text-ink-900">
                        {toEasternArabicNumerals(specializationCount)}
                      </dd>
                    </div>
                  </dl>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdmissionSetupShell>
  );
}
