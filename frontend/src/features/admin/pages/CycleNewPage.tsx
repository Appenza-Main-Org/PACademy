/**
 * CycleNewPage — minimal create form for an admission cycle.
 *
 * Surfaces: name, year.
 * openDate/closeDate default to Jan 1 / Dec 31 of the selected year and
 * are configured later from CycleDetailPage / the admission-setup wizard.
 * Every other AdmissionCycle field (cohort, fees, capacity, openCategories, …)
 * is filled in by the service with sensible defaults.
 *
 * On حفظ the cycle is persisted as the first status in the
 * "إدراج ومراجعة" stage — `draft`. No auto-advance to active; admins
 * promote later from the list.
 */

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Controller, useForm, type FieldPath } from 'react-hook-form';
import { z } from 'zod';
import { Save } from 'lucide-react';
import {
  Button,
  Card,
  Input,
  PageHeader,
  Select,
  toast,
} from '@/shared/components';
import { zodResolver } from '@/shared/lib/zod-resolver';
import { isValidationError } from '@/shared/lib/errors';
import { validationFieldErrors, validationMessage } from '@/shared/lib/validation-errors';
import { ROUTES } from '@/config/routes';
import { useCycleCreate } from '../api/cycles.queries';
import type { AdmissionCycle } from '@/shared/types/domain';

const cycleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'اسم الدورة يجب ألا يقل عن 3 أحرف')
    .max(80, 'اسم الدورة يجب ألا يزيد عن 80 حرفًا'),
  year: z.number().int(),
});

type CycleValues = z.infer<typeof cycleSchema>;

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
    /* Always draft on create — the "إدراج ومراجعة" stage starts here.
     * Admins promote to "اعتماد ونشر" later from /admin/cycles. */
    status: 'draft',
    openCategories: {},
    conditionOverrides: {},
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function CycleNewPage(): JSX.Element {
  const navigate = useNavigate();
  const createMut = useCycleCreate();

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
    setError,
    formState: { errors },
  } = useForm<CycleValues>({
    resolver: zodResolver(cycleSchema),
    defaultValues: {
      name: '',
      year: currentYear,
    },
  });

  const onSubmit = (values: CycleValues): void => {
    createMut.mutate(
      { payload: buildPayload(values) },
      {
        onSuccess: () => {
          toast('تم حفظ المسودة', 'success');
          navigate(ROUTES.admin.cycles);
        },
        onError: (err) => {
          if (isValidationError(err)) {
            for (const [field, message] of Object.entries(validationFieldErrors(err))) {
              setError(field as FieldPath<CycleValues>, { type: 'server', message });
            }
          }
          toast(validationMessage(err, 'تعذر حفظ الدورة'), 'danger');
        },
      },
    );
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
              حفظ كمسودة
            </Button>
          </div>
        </div>
      </Card>
    </form>
  );
}
