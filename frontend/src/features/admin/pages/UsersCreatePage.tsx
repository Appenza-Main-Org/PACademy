/**
 * UsersCreatePage — super-admin provisions a new system operator.
 * Uses react-hook-form + local zod resolver for client-side validation (spec 003, T176).
 */

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Button, Input, PageHeader, Select, toast } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROLE_DEFINITIONS, ROLES } from '@/features/auth';
import { ROUTES } from '@/config/routes';
import { zodResolver } from '@/shared/lib/zod-resolver';
import { useUserCreate } from '../api/users.queries';
import type { ApiError } from '@/shared/types/api';

const ROLE_OPTIONS = ROLES
  .filter((r) => r !== 'applicant')
  .map((r) => ({ value: r, label: ROLE_DEFINITIONS[r].labelAr }));

const schema = z.object({
  nationalId: z
    .string()
    .min(1, 'الرقم القومي مطلوب')
    .length(14, 'الرقم القومي يجب أن يتكوّن من 14 رقماً')
    .regex(/^\d{14}$/, 'الرقم القومي يجب أن يحتوي على أرقام فقط'),
  officerCode: z
    .string()
    .min(1, 'الكود الوظيفي مطلوب')
    .max(32, 'الكود الوظيفي يجب ألا يتجاوز 32 حرفاً')
    .regex(/^[A-Za-z0-9]+$/, 'الكود الوظيفي يجب أن يحتوي على أحرف وأرقام فقط'),
  fullName: z.string().min(1, 'الاسم الكامل مطلوب').max(200, 'الاسم لا يمكن أن يتجاوز 200 حرف'),
  mobile: z
    .string()
    .min(1, 'رقم الهاتف مطلوب')
    .regex(/^(010|011|012|015)\d{8}$/, 'رقم الهاتف يجب أن يكون مصري (010/011/012/015 + 8 أرقام)'),
  email: z.string().min(1, 'البريد الإلكتروني مطلوب').email('البريد الإلكتروني غير صحيح'),
  unit: z.string().optional(),
  role: z.string().min(1, 'الدور الوظيفي مطلوب'),
  issueDate: z.string().min(1, 'تاريخ الإصدار مطلوب'),
  cardFactoryNumber: z.string().min(1, 'رقم مصنع البطاقة مطلوب').max(32),
  password: z
    .string()
    .min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل')
    .regex(/\d/, 'كلمة المرور يجب أن تحتوي على رقم واحد على الأقل'),
});

type FormValues = z.infer<typeof schema>;

export function UsersCreatePage(): JSX.Element {
  const navigate = useNavigate();
  const createMut = useUserCreate();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'committee_user' },
  });

  const onSubmit = (values: FormValues) => {
    createMut.mutate(
      {
        ...values,
        issueDate: new Date(values.issueDate).toISOString(),
      },
      {
        onSuccess: (dto) => {
          toast('تم إنشاء المستخدم بنجاح', 'success');
          navigate(ROUTES.admin.userDetail(dto.id));
        },
        onError: (err) => {
          const apiErr = err as ApiError;
          if (apiErr.code === 'NATIONAL_ID_TAKEN') {
            setError('nationalId', { message: 'الرقم القومي مستخدم مسبقاً' });
          } else if (apiErr.code === 'EMAIL_TAKEN') {
            setError('email', { message: 'البريد الإلكتروني مستخدم مسبقاً' });
          } else {
            toast('فشل إنشاء المستخدم — ' + (apiErr.message ?? 'خطأ غير متوقع'), 'danger');
          }
        },
      },
    );
  };

  return (
    <CenteredShell>
      <PageHeader
        title="مستخدم جديد"
        subtitle="إضافة مشغّل جديد للمنظومة"
        breadcrumbs={[{ label: 'مستخدمو المنظومة', href: ROUTES.admin.users }, { label: 'جديد' }]}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-2xl space-y-5" noValidate>
        {/* Identity */}
        <fieldset className="rounded-lg border border-border-subtle bg-surface-card p-5 space-y-4">
          <legend className="px-2 text-sm font-medium text-ink-700">بيانات الهوية</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="الرقم القومي"
              inputMode="numeric"
              dir="ltr"
              maxLength={14}
              error={errors.nationalId?.message}
              {...register('nationalId')}
            />
            <Input
              label="الاسم الكامل"
              error={errors.fullName?.message}
              {...register('fullName')}
            />
            <Input
              label="الكود الوظيفي"
              dir="ltr"
              error={errors.officerCode?.message}
              {...register('officerCode')}
            />
            <Input
              label="رقم مصنع البطاقة"
              dir="ltr"
              error={errors.cardFactoryNumber?.message}
              {...register('cardFactoryNumber')}
            />
            <Input
              label="تاريخ إصدار البطاقة"
              type="date"
              error={errors.issueDate?.message}
              {...register('issueDate')}
            />
          </div>
        </fieldset>

        {/* Contact */}
        <fieldset className="rounded-lg border border-border-subtle bg-surface-card p-5 space-y-4">
          <legend className="px-2 text-sm font-medium text-ink-700">بيانات التواصل</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="رقم الهاتف (010/011/012/015)"
              inputMode="tel"
              dir="ltr"
              placeholder="01xxxxxxxxx"
              error={errors.mobile?.message}
              {...register('mobile')}
            />
            <Input
              label="البريد الإلكتروني"
              type="email"
              dir="ltr"
              error={errors.email?.message}
              {...register('email')}
            />
          </div>
        </fieldset>

        {/* Role & Access */}
        <fieldset className="rounded-lg border border-border-subtle bg-surface-card p-5 space-y-4">
          <legend className="px-2 text-sm font-medium text-ink-700">الصلاحيات</legend>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="الدور الوظيفي"
              options={ROLE_OPTIONS}
              error={errors.role?.message}
              {...register('role')}
            />
            <Input
              label="الوحدة / الإدارة"
              error={errors.unit?.message}
              {...register('unit')}
            />
          </div>
        </fieldset>

        {/* Credentials */}
        <fieldset className="rounded-lg border border-border-subtle bg-surface-card p-5 space-y-4">
          <legend className="px-2 text-sm font-medium text-ink-700">بيانات الدخول</legend>
          <Input
            label="كلمة المرور الأولية — 8 أحرف على الأقل وتحتوي على رقم"
            type="password"
            dir="ltr"
            error={errors.password?.message}
            {...register('password')}
          />
        </fieldset>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(ROUTES.admin.users)}
          >
            إلغاء
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting || createMut.isPending}>
            إنشاء المستخدم
          </Button>
        </div>
      </form>
    </CenteredShell>
  );
}
