/**
 * CycleEditPage — edit a saved admission cycle.
 *
 * Exposes every field present on /admin/cycles/new (CycleNewPage), in the
 * same order and with the same labels, pre-filled from the cycle record.
 * Save updates the cycle through `cyclesService.update` and routes back
 * to the list.
 *
 * Available regardless of cycle status — the prior published-status gate
 * was lifted in the same commit set.
 */

import { useEffect, useMemo } from 'react';
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
  toast,
} from '@/shared/components';
import { zodResolver } from '@/shared/lib/zod-resolver';
import { isValidationError } from '@/shared/lib/errors';
import { validationFieldErrors, validationMessage } from '@/shared/lib/validation-errors';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROUTES } from '@/config/routes';
import { useCycle, useCycleUpdate } from '../api/cycles.queries';

const cycleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'اسم الدورة مطلوب')
    .min(3, 'اسم الدورة يجب ألا يقل عن 3 أحرف')
    .max(80, 'اسم الدورة يجب ألا يزيد عن 80 حرفًا'),
  year: z.number().int(),
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
    reset,
    setError,
    formState: { errors },
  } = useForm<CycleValues>({
    resolver: zodResolver(cycleSchema),
    defaultValues: { name: '', year: currentYear },
  });

  /* Pre-fill once the cycle resolves. We use reset rather than
   * defaultValues so a year list expansion / cycle id swap doesn't
   * leave stale form state behind. */
  useEffect(() => {
    if (cycleQuery.data) {
      reset({ name: cycleQuery.data.nameAr, year: cycleQuery.data.year });
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

  const onSubmit = (values: CycleValues): void => {
    const name = values.name.trim();
    const nameError = cycleNameError(name);
    if (nameError !== null) {
      setError('name', { type: 'manual', message: nameError }, { shouldFocus: true });
      return;
    }

    const openIso = new Date(Date.UTC(values.year, 0, 1)).toISOString();
    const closeIso = new Date(Date.UTC(values.year, 11, 31)).toISOString();
    updateMut.mutate(
      {
        id,
        patch: {
          nameAr: name,
          year: values.year,
          openDate: openIso,
          closeDate: closeIso,
        },
      },
      {
        onSuccess: () => {
          toast('تم حفظ تعديلات الدورة', 'success');
          navigate(ROUTES.admin.cycles);
        },
        onError: (err) => {
          if (isValidationError(err)) {
            for (const [field, message] of Object.entries(validationFieldErrors(err))) {
              const fieldName = field === 'nameAr' ? 'name' : field;
              setError(fieldName as FieldPath<CycleValues>, { type: 'server', message });
            }
          }
          toast(validationMessage(err, 'تعذر حفظ تعديلات الدورة'), 'danger');
        },
      },
    );
  };

  return (
    <CenteredShell>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <PageHeader
          title="تعديل الدورة"
          breadcrumbs={[
            { label: 'الإدارة' },
            { label: 'دورات القبول', href: ROUTES.admin.cycles },
            { label: cycleQuery.data.nameAr },
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
                isLoading={updateMut.isPending}
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
