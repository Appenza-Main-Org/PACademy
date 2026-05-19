/**
 * ApplicantCategoryDetailPage — `/admin/lookups/applicant-categories/:id`.
 *
 * Read-only view of a single applicant-categories lookup row. Mirrors the
 * fields surfaced by the add drawer + list: name, status, stage, faculty
 * and specialization mapping, plus the optional openness flag and description.
 *
 * Patterns lifted from CycleDetailPage — CenteredShell + PageHeader +
 * Card sections with a small Field row component. The `:id` path param
 * matches the row's `code` (e.g. `officers_general`).
 */

import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROUTES } from '@/config/routes';
import { MOCK } from '@/shared/mock-data';
import { useLookup } from '../api/lookups.queries';
import type {
  ApplicantCategoryRow,
  FacultyRow,
  SpecializationRow,
} from '../types';

const STAGE_LABEL: Record<ApplicantCategoryRow['type'], string> = {
  pre_university: 'ثانوي',
  university: 'جامعي',
};

interface FieldProps {
  label: string;
  value: React.ReactNode;
  span?: 'full' | 'half';
}

function Field({ label, value, span = 'half' }: FieldProps): JSX.Element {
  return (
    <div className={`flex flex-col gap-1 ${span === 'full' ? 'md:col-span-2' : ''}`}>
      <span className="text-2xs uppercase tracking-wide text-ink-500">{label}</span>
      <span className="text-sm text-ink-900">{value}</span>
    </div>
  );
}

function Dash(): JSX.Element {
  return <span className="text-ink-400">—</span>;
}

function labelByCode<T extends { code: string; name: string }>(
  rows: readonly T[],
  code: string,
): string {
  return rows.find((r) => r.code === code)?.name ?? code;
}

export function ApplicantCategoryDetailPage(): JSX.Element {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useLookup('applicant-categories');

  const row = useMemo(
    () => (data ?? []).find((c) => c.code === id) ?? null,
    [data, id],
  );

  if (isLoading) {
    return (
      <CenteredShell>
        <LoadingState variant="page" />
      </CenteredShell>
    );
  }
  if (error) {
    return (
      <CenteredShell>
        <ErrorState error={error} onRetry={() => refetch()} />
      </CenteredShell>
    );
  }
  if (!row) {
    return (
      <CenteredShell>
        <EmptyState
          variant="generic"
          title="الفئة غير موجودة"
          description="تأكد من الرابط أو ارجع إلى قائمة الفئات."
          action={
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<ArrowRight size={14} strokeWidth={1.75} />}
              onClick={() =>
                navigate(ROUTES.admin.adminLookupsType('applicant-categories'))
              }
            >
              العودة إلى الفئات
            </Button>
          }
        />
      </CenteredShell>
    );
  }

  const faculties = MOCK.lookups.faculties as FacultyRow[];
  const specializations = MOCK.lookups.specializations as SpecializationRow[];
  const excellenceCriteria = MOCK.lookups['excellence-criteria'];
  const excellenceLabel =
    row.excellenceCriterion === null
      ? null
      : excellenceCriteria.find((c) => c.code === row.excellenceCriterion)?.name ??
        row.excellenceCriterion;

  return (
    <CenteredShell>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-3">
            {row.name}
            <Badge tone={row.isActive ? 'success' : 'neutral'}>
              {row.isActive ? 'نشط' : 'غير نشط'}
            </Badge>
            {row.isOpen ? (
              <Badge tone="info">مفتوحة للتقديم</Badge>
            ) : (
              <Badge tone="neutral">مغلقة</Badge>
            )}
          </span>
        }
        subtitle={row.description || undefined}
        breadcrumbs={[
          { label: 'الإدارة', href: ROUTES.admin.dashboard },
          { label: 'الأكواد المرجعية', href: ROUTES.admin.adminLookups },
          {
            label: 'فئات المتقدمين',
            href: ROUTES.admin.adminLookupsType('applicant-categories'),
          },
          { label: row.name },
        ]}
      />

      <div className="flex flex-col gap-4">
        {/* Stage + faculty/specialization mapping (mirrors add drawer + list) */}
        <Card>
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              label="مرحلة الالتحاق"
              value={
                <Badge tone={row.type === 'university' ? 'info' : 'neutral'}>
                  {STAGE_LABEL[row.type]}
                </Badge>
              }
            />
            <Field
              label="الكليات المؤهلة"
              value={
                row.facultyCodes.length === 0 ? (
                  <Dash />
                ) : (
                  <span className="inline-flex flex-wrap items-center gap-1">
                    {row.facultyCodes.map((c) => (
                      <Badge key={c} tone="neutral">
                        {labelByCode(faculties, c)}
                      </Badge>
                    ))}
                  </span>
                )
              }
            />
            <Field
              label="التخصصات المؤهلة"
              span="full"
              value={
                row.specializationCodes.length === 0 ? (
                  <span className="text-ink-500">الكل</span>
                ) : (
                  <span className="inline-flex flex-wrap items-center gap-1">
                    {row.specializationCodes.map((c) => (
                      <Badge key={c} tone="accent">
                        {labelByCode(specializations, c)}
                      </Badge>
                    ))}
                  </span>
                )
              }
            />
          </div>
        </Card>

        {/* معيار التميز Card — only rendered for categories that
         *  actually carry a criterion. Pre-university (ثانوي)
         *  categories don't use this axis at all, so showing an empty
         *  "مفعّل / غير مفعّل" pair next to a Dash is just noise. */}
        {row.excellenceCriterion !== null && (
          <Card>
            <div className="grid gap-5 md:grid-cols-2">
              <Field
                label="إظهار «معيار التميز» في إعدادات التقديم"
                value={
                  <Badge tone={row.excellenceCriteriaVisible ? 'success' : 'neutral'}>
                    {row.excellenceCriteriaVisible ? 'مفعّل' : 'غير مفعّل'}
                  </Badge>
                }
              />
              <Field
                label="معيار التميز"
                value={<Badge tone="accent">{excellenceLabel}</Badge>}
              />
            </div>
          </Card>
        )}
      </div>
    </CenteredShell>
  );
}
