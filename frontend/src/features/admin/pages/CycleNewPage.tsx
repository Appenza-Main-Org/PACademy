/**
 * CycleNewPage — minimal create form for an admission cycle.
 *
 * Surfaces: name, year, status.
 * openDate/closeDate default to Jan 1 / Dec 31 of the selected year and
 * are configured later from CycleDetailPage / the admission-setup wizard.
 * Every other AdmissionCycle field (cohort, fees, capacity, openCategories, …)
 * is filled in by the service with sensible defaults.
 *
 * Status is a two-state enum on this surface:
 *   إدراج ومراجعة → draft (straight create)
 *   اعتماد ونشر  → active (runs the single-active-cycle check; if another
 *                  active cycle exists, the conflict dialog offers to
 *                  atomically demote it to draft on confirm).
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Save } from 'lucide-react';
import {
  AlertDialog,
  Button,
  Card,
  Input,
  PageHeader,
  Select,
  toast,
} from '@/shared/components';
import { zodResolver } from '@/shared/lib/zod-resolver';
import { ROUTES } from '@/config/routes';
import { isConflictError } from '@/shared/lib/errors';
import { useCycleCreate, useCycles } from '../api/cycles.queries';
import type { AdmissionCycle } from '@/shared/types/domain';
import {
  fromListStatus,
  LIST_STATUS_OPTIONS,
  type CycleListStatus,
} from '../components/cycles/cycleListStatus';

const cycleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'اسم الدورة يجب ألا يقل عن 3 أحرف')
    .max(80, 'اسم الدورة يجب ألا يزيد عن 80 حرفًا'),
  year: z.number().int(),
  status: z.enum(['review', 'published']),
});

type CycleValues = z.infer<typeof cycleSchema>;

const SUBMIT_LABEL: Record<CycleListStatus, string> = {
  review: 'حفظ كمسودة',
  published: 'إنشاء الدورة',
};

const SUCCESS_TOAST: Record<CycleListStatus, string> = {
  review: 'تم حفظ المسودة',
  published: 'تم اعتماد ونشر الدورة',
};

function buildPayload(values: CycleValues): Omit<AdmissionCycle, 'id' | 'applicantCount'> {
  const nowIso = new Date().toISOString();
  /* Dates are intentionally left as year-bookends here — admins configure
   * the real application window from CycleDetailPage / admission-setup. */
  const openIso = new Date(Date.UTC(values.year, 0, 1)).toISOString();
  const closeIso = new Date(Date.UTC(values.year, 11, 31)).toISOString();
  return {
    nameAr: values.name.trim(),
    cohort: 'male',
    year: values.year,
    openDate: openIso,
    closeDate: closeIso,
    expectedCapacity: 0,
    status: fromListStatus(values.status),
    openCategories: {},
    conditionOverrides: {},
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function CycleNewPage(): JSX.Element {
  const navigate = useNavigate();
  const createMut = useCycleCreate();
  const cyclesQuery = useCycles();

  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [];
    for (let y = currentYear - 5; y <= currentYear + 5; y += 1) {
      opts.push({ value: String(y), label: String(y) });
    }
    return opts;
  }, [currentYear]);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<CycleValues>({
    resolver: zodResolver(cycleSchema),
    defaultValues: {
      name: '',
      year: currentYear,
      status: 'review',
    },
  });

  const status = watch('status') as CycleListStatus;

  const [conflictDialog, setConflictDialog] = useState<{
    activeCycleName: string;
    pending: CycleValues;
  } | null>(null);

  const submitCreate = (
    values: CycleValues,
    options: { demoteCurrentActive?: boolean } = {},
  ): void => {
    createMut.mutate(
      { payload: buildPayload(values), demoteCurrentActive: options.demoteCurrentActive },
      {
        onSuccess: () => {
          if (options.demoteCurrentActive) {
            toast('تم اعتماد ونشر الدورة الجديدة وتحويل الدورة السابقة إلى مسودة', 'success');
          } else {
            toast(SUCCESS_TOAST[values.status], 'success');
          }
          setConflictDialog(null);
          navigate(ROUTES.admin.cycles);
        },
        onError: (err) => {
          if (isConflictError(err) && err.conflictCode === 'ACTIVE_CYCLE_EXISTS') {
            /* Should only reach here if the caller did not pass
             * demoteCurrentActive — surface the dialog so the admin
             * can choose. */
            const payload = err.payload as { activeCycleName?: string };
            setConflictDialog({
              activeCycleName: payload?.activeCycleName ?? '',
              pending: values,
            });
            return;
          }
          toast((err as Error).message, 'danger');
        },
      },
    );
  };

  const onSubmit = (values: CycleValues): void => {
    if (values.status === 'published') {
      const existingActive = (cyclesQuery.data ?? []).find(
        (c) => c.status === 'active' || c.status === 'open' || c.status === 'extended',
      );
      if (existingActive) {
        setConflictDialog({ activeCycleName: existingActive.nameAr, pending: values });
        return;
      }
    }
    submitCreate(values);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <PageHeader
        title="دورة جديدة"
        breadcrumbs={[
          { label: 'الإدارة' },
          { label: 'دورات القبول', href: ROUTES.admin.cycles },
          { label: 'دورة جديدة' },
        ]}
      />

      <Card>
        <div className="flex flex-col gap-4">
          <Input
            label="اسم الدورة"
            required
            placeholder="مثال: دورة 2027 - الذكور"
            {...register('name')}
            error={errors.name?.message}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <Controller
              control={control}
              name="year"
              render={({ field }) => (
                <Select
                  label="السنة"
                  required
                  options={yearOptions}
                  value={String(field.value)}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  error={errors.year?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select
                  label="حالة الدورة"
                  required
                  options={LIST_STATUS_OPTIONS as ReadonlyArray<{ value: string; label: string }>}
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value as CycleListStatus)}
                  error={errors.status?.message}
                />
              )}
            />
          </div>

          <div className="mt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate(ROUTES.admin.cycles)}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              leadingIcon={<Save size={14} strokeWidth={1.75} />}
              isLoading={createMut.isPending}
            >
              {SUBMIT_LABEL[status]}
            </Button>
          </div>
        </div>
      </Card>

      <AlertDialog
        open={Boolean(conflictDialog)}
        onOpenChange={(next) => {
          if (!next) setConflictDialog(null);
        }}
        title="تأكيد اعتماد ونشر دورة جديدة"
        description={
          conflictDialog ? (
            <>
              يوجد دورة معتمدة ومنشورة حالياً باسم{' '}
              <strong className="font-semibold text-ink-900">
                &quot;{conflictDialog.activeCycleName}&quot;
              </strong>
              . عند اعتماد الدورة الجديدة، سيتم تحويل الدورة الحالية إلى مسودة تلقائياً. هل تريد المتابعة؟
            </>
          ) : null
        }
        actionLabel="تأكيد الاعتماد"
        cancelLabel="إلغاء"
        tone="danger"
        isActionLoading={createMut.isPending}
        onAction={() => {
          if (!conflictDialog) return;
          submitCreate(conflictDialog.pending, { demoteCurrentActive: true });
        }}
      />
    </form>
  );
}
