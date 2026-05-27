/**
 * CycleEditPage — edit a saved admission cycle.
 *
 * Exposes the admin-editable cycle metadata: name, list-facing lifecycle
 * status, and the orthogonal active flag. System year fields remain internal
 * and are not modified by this form.
 *
 * Available regardless of cycle status — the prior published-status gate
 * was lifted in the same commit set.
 */

import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Controller, useForm, type FieldPath } from 'react-hook-form';
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
  Switch,
  toast,
} from '@/shared/components';
import { zodResolver } from '@/shared/lib/zod-resolver';
import { isValidationError } from '@/shared/lib/errors';
import { validationFieldErrors, validationMessage } from '@/shared/lib/validation-errors';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROUTES } from '@/config/routes';
import { useCycle, useCycleSetActive, useCycleUpdate } from '../api/cycles.queries';
import {
  fromListStatus,
  LIST_STATUS_OPTIONS,
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
  isActive: z.boolean(),
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
  const updateMut = useCycleUpdate();
  const setActiveMut = useCycleSetActive();

  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<CycleValues>({
    resolver: zodResolver(cycleSchema),
    defaultValues: { name: '', status: 'review', isActive: false },
  });

  /* Pre-fill once the cycle resolves. We use reset rather than
   * defaultValues so a year list expansion / cycle id swap doesn't
   * leave stale form state behind. */
  useEffect(() => {
    if (cycleQuery.data) {
      reset({
        name: cycleQuery.data.nameAr,
        status: toListStatus(cycleQuery.data.status),
        isActive: Boolean(cycleQuery.data.isActive),
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

    const nextStatus = fromListStatus(values.status);

    try {
      if (values.isActive && !cycle.isActive) {
        await setActiveMut.mutateAsync(id);
      }

      await updateMut.mutateAsync({
        id,
        patch: {
          nameAr: name,
          status: nextStatus,
          isActive: values.isActive,
        },
      });

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

  const isSaving = updateMut.isPending || setActiveMut.isPending;

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

            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="حالة الدورة"
                required
                options={LIST_STATUS_OPTIONS}
                {...register('status')}
                error={errors.status?.message}
              />

              <Controller
                control={control}
                name="isActive"
                render={({ field }) => (
                  <div className="flex min-h-[4.625rem] flex-col justify-end gap-2 rounded-md border border-ink-200 bg-white px-4 py-3">
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      label="التفعيل"
                      helper={field.value ? 'نشطة' : 'غير نشطة'}
                      disabled={isSaving}
                    />
                    {errors.isActive?.message && (
                      <span className="text-xs text-terra-700">
                        {errors.isActive.message}
                      </span>
                    )}
                  </div>
                )}
              />
            </div>

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
