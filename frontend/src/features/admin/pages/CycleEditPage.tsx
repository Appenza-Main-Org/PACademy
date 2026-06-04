/**
 * CycleEditPage — edit a saved admission cycle.
 *
 * Exposes the admin-editable cycle metadata: name and list-facing
 * lifecycle status. The application submission period
 * (تاريخ بداية / تاريخ نهاية التقديم) is **not** edited here — it is
 * derived from the per-category start/end dates configured in the
 * admission-setup wizard's إعدادات التقديم step via
 * `resolveCycleApplicationPeriod`. When activating, the overlap check
 * uses that derived period (it is skipped if no categories have been
 * configured yet).
 *
 * Available regardless of cycle status — the prior published-status gate
 * was lifted in the same commit set.
 */

import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, type FieldPath } from 'react-hook-form';
import { z } from 'zod';
import { Save } from 'lucide-react';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Select,
  toast,
} from '@/shared/components';
import { zodResolver } from '@/shared/lib/zod-resolver';
import { isValidationError } from '@/shared/lib/errors';
import { validationFieldErrors, validationMessage } from '@/shared/lib/validation-errors';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROUTES } from '@/config/routes';
import { useCycle, useCycleUpdate, useCycleUpdateStatus, useCycles } from '../api/cycles.queries';
import {
  findActiveCycleApplicationPeriodOverlap,
  resolveCycleApplicationPeriod,
} from '../api/cycles.service';
import {
  LIST_STATUS_OPTIONS,
  listStatusToCyclePatch,
  toListStatus,
} from '../components/cycles/cycleListStatus';

const cycleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'اسم الدورة مطلوب')
    .min(3, 'اسم الدورة يجب ألا يقل عن 3 أحرف')
    .max(80, 'اسم الدورة يجب ألا يزيد عن 80 حرفًا'),
  status: z.enum(['review', 'published']),
});

type CycleValues = z.infer<typeof cycleSchema>;

function cycleNameError(name: string): string | null {
  const length = name.trim().length;
  if (length === 0) return 'اسم الدورة مطلوب';
  if (length < 3) return 'اسم الدورة يجب ألا يقل عن 3 أحرف';
  if (length > 80) return 'اسم الدورة يجب ألا يزيد عن 80 حرفًا';
  return null;
}

export function CycleEditPage(): JSX.Element {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const cycleQuery = useCycle(id);
  const cyclesQuery = useCycles();
  const updateMut = useCycleUpdate();
  const updateStatusMut = useCycleUpdateStatus();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CycleValues>({
    resolver: zodResolver(cycleSchema),
    defaultValues: { name: '', status: 'review' },
  });

  /* Pre-fill once the cycle resolves. We use reset rather than
   * defaultValues so a year list expansion / cycle id swap doesn't
   * leave stale form state behind. */
  useEffect(() => {
    if (cycleQuery.data) {
      reset({
        name: cycleQuery.data.nameAr,
        status: toListStatus(cycleQuery.data.status),
      });
    }
  }, [cycleQuery.data, reset]);

  if (cycleQuery.isLoading) {
    return (
      <CenteredShell>
        <LoadingState variant="page" />
      </CenteredShell>
    );
  }
  if (cycleQuery.error) {
    return (
      <CenteredShell>
        <ErrorState error={cycleQuery.error} onRetry={() => cycleQuery.refetch()} />
      </CenteredShell>
    );
  }
  if (!cycleQuery.data) {
    return (
      <CenteredShell>
        <EmptyState variant="generic" title="الدورة غير موجودة" />
      </CenteredShell>
    );
  }

  const cycle = cycleQuery.data;

  const onSubmit = async (values: CycleValues): Promise<void> => {
    const name = values.name.trim();
    const nameError = cycleNameError(name);
    if (nameError !== null) {
      setError('name', { type: 'manual', message: nameError }, { shouldFocus: true });
      return;
    }

    const statusPatch = listStatusToCyclePatch(values.status);

    if (statusPatch.isActive) {
      if (cyclesQuery.isLoading) {
        toast('جاري تحميل الدورات الحالية للتحقق من فترة التقديم', 'info');
        return;
      }
      if (cyclesQuery.error) {
        toast('تعذر تحميل الدورات الحالية للتحقق من تداخل فترة التقديم', 'danger');
        return;
      }
      /* Overlap check uses the derived period from configured categories.
       * If no categories are configured yet, the derived period is empty
       * and we skip the check (validateCycleApplicationPeriod inside
       * findActiveCycleApplicationPeriodOverlap short-circuits on empty). */
      const derivedPeriod = resolveCycleApplicationPeriod(cycle);
      const overlappingActive = findActiveCycleApplicationPeriodOverlap(
        cyclesQuery.data,
        derivedPeriod,
        cycle.id,
      );
      if (overlappingActive) {
        const message = `فترة التقديم تتداخل مع الدورة النشطة "${overlappingActive.nameAr}"`;
        toast(message, 'danger');
        return;
      }
    }

    try {
      await updateMut.mutateAsync({
        id,
        patch: { nameAr: name },
      });

      if (toListStatus(cycle.status) !== values.status) {
        await updateStatusMut.mutateAsync({
          id,
          next: statusPatch.status,
          demoteCurrentActive: statusPatch.isActive,
        });
      }

      toast('تم حفظ تعديلات الدورة', 'success');
      navigate(ROUTES.admin.cycles);
    } catch (err) {
      if (isValidationError(err)) {
        for (const [field, message] of Object.entries(validationFieldErrors(err))) {
          const fieldName = field === 'nameAr' ? 'name' : field;
          setError(fieldName as FieldPath<CycleValues>, { type: 'server', message });
        }
      }
      toast(validationMessage(err, 'تعذر حفظ تعديلات الدورة'), 'danger');
    }
  };

  const isSaving = updateMut.isPending || updateStatusMut.isPending;

  return (
    <CenteredShell size="default">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <PageHeader
          title="تعديل الدورة"
          breadcrumbs={[
            { label: 'الإدارة' },
            { label: 'دورات القبول', href: ROUTES.admin.cycles },
            { label: cycle.nameAr },
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

            <Select
              label="حالة الدورة"
              required
              options={LIST_STATUS_OPTIONS}
              {...register('status')}
              error={errors.status?.message}
            />

            <p className="text-2xs text-ink-500">
              فترة التقديم تُحدَّد من إعدادات التقديم لكل فئة في معالج إعداد القبول.
            </p>

            <div className="mt-2 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate(ROUTES.admin.cycles)}
                disabled={isSaving}
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                variant="primary"
                leadingIcon={<Save size={14} strokeWidth={1.75} />}
                isLoading={isSaving}
              >
                حفظ التعديلات
              </Button>
            </div>
          </div>
        </Card>
      </form>
    </CenteredShell>
  );
}
