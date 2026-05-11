/**
 * CycleNewPage — minimal create form for an admission cycle.
 *
 * Surfaces: name, year, openingDate, closingDate, status.
 * Every other AdmissionCycle field (cohort, fees, capacity, openCategories, …)
 * is filled in by the service with sensible defaults. Configure them
 * afterwards from CycleDetailPage / the admission-setup wizard.
 *
 * Submit behaviour is status-driven:
 *  • status = draft  → "حفظ كمسودة"   — straight create.
 *  • status = closed → "إغلاق الدورة" — straight create.
 *  • status = active → "إنشاء الدورة" — runs the single-active-cycle check.
 *    If an active cycle already exists, the admin sees a confirm dialog;
 *    on confirm the service atomically demotes the existing active to
 *    draft and creates the new one as active.
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
  DatePicker,
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

type CycleFormStatus = 'draft' | 'active' | 'closed';

const cycleSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, 'اسم الدورة يجب ألا يقل عن 3 أحرف')
      .max(80, 'اسم الدورة يجب ألا يزيد عن 80 حرفًا'),
    year: z.number().int(),
    openingDate: z.date({
      required_error: 'تاريخ الفتح مطلوب',
      invalid_type_error: 'تاريخ الفتح مطلوب',
    }),
    closingDate: z.date({
      required_error: 'تاريخ الإغلاق مطلوب',
      invalid_type_error: 'تاريخ الإغلاق مطلوب',
    }),
    status: z.enum(['draft', 'active', 'closed']),
  })
  .refine((v) => v.closingDate.getTime() >= v.openingDate.getTime(), {
    message: 'تاريخ الإغلاق يجب أن يكون بعد تاريخ الفتح',
    path: ['closingDate'],
  });

type CycleValues = z.infer<typeof cycleSchema>;

const STATUS_OPTIONS: ReadonlyArray<{ value: CycleFormStatus; label: string }> = [
  { value: 'draft', label: 'مسودة' },
  { value: 'active', label: 'نشطة' },
  { value: 'closed', label: 'مغلقة' },
];

const SUBMIT_LABEL: Record<CycleFormStatus, string> = {
  draft: 'حفظ كمسودة',
  active: 'إنشاء الدورة',
  closed: 'إغلاق الدورة',
};

const SUCCESS_TOAST: Record<CycleFormStatus, string> = {
  draft: 'تم حفظ المسودة',
  active: 'تم تفعيل الدورة',
  closed: 'تم إغلاق الدورة',
};

function buildPayload(values: CycleValues): Omit<AdmissionCycle, 'id' | 'applicantCount'> {
  const nowIso = new Date().toISOString();
  return {
    nameAr: values.name.trim(),
    cohort: 'male',
    year: values.year,
    openDate: values.openingDate.toISOString(),
    closeDate: values.closingDate.toISOString(),
    expectedCapacity: 0,
    status: values.status,
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
      openingDate: undefined,
      closingDate: undefined,
      status: 'draft',
    },
  });

  const status = watch('status') as CycleFormStatus;

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
        onSuccess: (cycle) => {
          if (options.demoteCurrentActive) {
            toast('تم تفعيل الدورة الجديدة وتحويل الدورة السابقة إلى مسودة', 'success');
          } else {
            toast(SUCCESS_TOAST[cycle.status as CycleFormStatus] ?? 'تم حفظ الدورة', 'success');
          }
          setConflictDialog(null);
          navigate(ROUTES.admin.cycleDetail(cycle.id));
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
    if (values.status === 'active') {
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
                  options={STATUS_OPTIONS as ReadonlyArray<{ value: string; label: string }>}
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value as CycleFormStatus)}
                  error={errors.status?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="openingDate"
              render={({ field }) => (
                <DatePicker
                  label="تاريخ الفتح"
                  required
                  value={field.value ?? null}
                  onChange={(d) => field.onChange(d ?? undefined)}
                  error={errors.openingDate?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="closingDate"
              render={({ field }) => {
                const opening = watch('openingDate');
                const minIso = opening
                  ? opening.toISOString().slice(0, 10)
                  : undefined;
                return (
                  <DatePicker
                    label="تاريخ الإغلاق"
                    required
                    value={field.value ?? null}
                    onChange={(d) => field.onChange(d ?? undefined)}
                    min={minIso}
                    error={errors.closingDate?.message}
                  />
                );
              }}
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
        title="تأكيد تفعيل دورة جديدة"
        description={
          conflictDialog ? (
            <>
              يوجد دورة نشطة حالياً باسم{' '}
              <strong className="font-semibold text-ink-900">
                &quot;{conflictDialog.activeCycleName}&quot;
              </strong>
              . عند تفعيل الدورة الجديدة، سيتم تحويل الدورة الحالية إلى مسودة تلقائياً. هل تريد المتابعة؟
            </>
          ) : null
        }
        actionLabel="تأكيد التفعيل"
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
