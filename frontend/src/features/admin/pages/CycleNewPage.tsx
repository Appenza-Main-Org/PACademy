/**
 * CycleNewPage — create form for an admission cycle.
 *
 * Surfaces: name + application submission period. The period is stored on
 * `openDate` / `closeDate` so it is visible before category-level setup and
 * can be checked against the existing active cycle before creation.
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
import { useCycleCreate, useCycles } from '../api/cycles.queries';
import {
  findActiveCycleApplicationPeriodOverlap,
  toCycleCloseIso,
  toCycleOpenIso,
  validateCycleApplicationPeriod,
} from '../api/cycles.service';
import type { AdmissionCycle } from '@/shared/types/domain';

const cycleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'اسم الدورة مطلوب')
    .min(3, 'اسم الدورة يجب ألا يقل عن 3 أحرف')
    .max(80, 'اسم الدورة يجب ألا يزيد عن 80 حرفًا'),
  startDate: z.string().min(1, 'تاريخ بداية التقديم مطلوب'),
  endDate: z.string().min(1, 'تاريخ نهاية التقديم مطلوب'),
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
  const year = Number(values.startDate.slice(0, 4));
  return {
    nameAr: values.name.trim(),
    cohort: 'male',
    year,
    openDate: toCycleOpenIso(values.startDate),
    closeDate: toCycleCloseIso(values.endDate),
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

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toInputDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function CycleNewPage(): JSX.Element {
  const navigate = useNavigate();
  const createMut = useCycleCreate();
  const cyclesQuery = useCycles();
  const today = new Date();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CycleValues>({
    resolver: zodResolver(cycleSchema),
    defaultValues: {
      name: '',
      startDate: toInputDate(today),
      endDate: toInputDate(addDays(today, 60)),
    },
  });

  const onSubmit = (values: CycleValues): void => {
    const name = values.name.trim();
    const nameError = cycleNameError(name);
    if (nameError !== null) {
      setError('name', { type: 'manual', message: nameError }, { shouldFocus: true });
      return;
    }

    const periodErrors = validateCycleApplicationPeriod(values);
    for (const [field, message] of Object.entries(periodErrors)) {
      setError(field as FieldPath<CycleValues>, { type: 'manual', message }, { shouldFocus: true });
    }
    if (Object.keys(periodErrors).length > 0) return;

    if (cyclesQuery.isLoading) {
      toast('جاري تحميل الدورات الحالية للتحقق من فترة التقديم', 'info');
      return;
    }
    if (cyclesQuery.error) {
      toast('تعذر تحميل الدورات الحالية للتحقق من تداخل فترة التقديم', 'danger');
      return;
    }

    const overlappingActive = findActiveCycleApplicationPeriodOverlap(cyclesQuery.data, {
      startDate: values.startDate,
      endDate: values.endDate,
    });
    if (overlappingActive) {
      const message = `فترة التقديم تتداخل مع الدورة النشطة "${overlappingActive.nameAr}"`;
      setError('startDate', { type: 'manual', message }, { shouldFocus: true });
      setError('endDate', { type: 'manual', message });
      toast(message, 'danger');
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
              const fieldName =
                field === 'nameAr'
                  ? 'name'
                  : field === 'openDate'
                    ? 'startDate'
                    : field === 'closeDate'
                      ? 'endDate'
                      : field;
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

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              type="date"
              label="تاريخ بداية التقديم"
              required
              {...register('startDate')}
              error={errors.startDate?.message}
            />
            <Input
              type="date"
              label="تاريخ نهاية التقديم"
              required
              {...register('endDate')}
              error={errors.endDate?.message}
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
              disabled={cyclesQuery.isLoading}
            >
              حفظ كمسودة
            </Button>
          </div>
        </div>
      </Card>
    </form>
  );
}
