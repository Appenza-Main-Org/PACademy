/**
 * CycleNewPage — minimal create form for an admission cycle.
 *
 * Surfaces: name only.
 * year/openDate/closeDate default internally to the current year and are
 * configured later from the admission-setup flow.
 * Every other AdmissionCycle field (cohort, fees, capacity, openCategories, …)
 * is filled in by the service with sensible defaults.
 *
 * On حفظ the cycle is persisted as the first status in the
 * "إدراج ومراجعة" stage — `draft`. No auto-advance to active; admins
 * promote later from the list.
 */

import { useNavigate } from 'react-router-dom';
import { useForm, type FieldPath } from 'react-hook-form';
import { z } from 'zod';
import { Save } from 'lucide-react';
import {
  Button,
  Card,
  Input,
  PageHeader,
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
    .min(1, 'اسم الدورة مطلوب')
    .min(3, 'اسم الدورة يجب ألا يقل عن 3 أحرف')
    .max(80, 'اسم الدورة يجب ألا يزيد عن 80 حرفًا'),
});

type CycleValues = z.infer<typeof cycleSchema>;

function cycleNameError(name: string): string | null {
  const length = name.trim().length;
  if (length === 0) return 'اسم الدورة مطلوب';
  if (length < 3) return 'اسم الدورة يجب ألا يقل عن 3 أحرف';
  if (length > 80) return 'اسم الدورة يجب ألا يزيد عن 80 حرفًا';
  return null;
}

function buildPayload(values: CycleValues): Omit<AdmissionCycle, 'id' | 'applicantCount'> {
  const nowIso = new Date().toISOString();
  const year = new Date().getFullYear();
  /* Dates are intentionally left as current-year bookends here — admins
   * configure the real application window from admission-setup. */
  const openIso = new Date(Date.UTC(year, 0, 1)).toISOString();
  const closeIso = new Date(Date.UTC(year, 11, 31)).toISOString();
  return {
    nameAr: values.name.trim(),
    cohort: 'male',
    year,
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

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CycleValues>({
    resolver: zodResolver(cycleSchema),
    defaultValues: {
      name: '',
    },
  });

  const onSubmit = (values: CycleValues): void => {
    const name = values.name.trim();
    const nameError = cycleNameError(name);
    if (nameError !== null) {
      setError('name', { type: 'manual', message: nameError }, { shouldFocus: true });
      return;
    }

    createMut.mutate(
      { payload: buildPayload({ ...values, name }) },
      {
        onSuccess: () => {
          toast('تم حفظ المسودة', 'success');
          navigate(ROUTES.admin.cycles);
        },
        onError: (err) => {
          if (isValidationError(err)) {
            for (const [field, message] of Object.entries(validationFieldErrors(err))) {
              const fieldName = field === 'nameAr' ? 'name' : field;
              setError(fieldName as FieldPath<CycleValues>, { type: 'server', message });
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
