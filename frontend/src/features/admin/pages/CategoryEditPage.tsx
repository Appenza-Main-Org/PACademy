/**
 * CategoryEditPage — mirrors CategoryNewPage; only name + description
 * are editable. Spec departments keep their labelAr immutable; admins
 * can still edit the description.
 */

import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Save } from 'lucide-react';
import {
  Button,
  Card,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Textarea,
  toast,
} from '@/shared/components';
import type { ApplicantCategoryKey } from '@/shared/types/domain';
import { ROUTES } from '@/config/routes';
import { zodResolver } from '@/shared/lib/zod-resolver';
import {
  useCategoryAdmin,
  useUpdateCategoryMutation,
} from '../api/categories.queries';

const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'اسم الفئة يجب ألا يقل عن حرفين')
    .max(80, 'اسم الفئة يجب ألا يزيد عن 80 حرفًا'),
  description: z
    .string()
    .trim()
    .max(500, 'الوصف يجب ألا يزيد عن 500 حرف')
    .optional()
    .or(z.literal('')),
});
type CategoryValues = z.infer<typeof categorySchema>;

export function CategoryEditPage(): JSX.Element {
  const { key = '' } = useParams<{ key: string }>();
  const categoryKey = key as ApplicantCategoryKey;
  const navigate = useNavigate();
  const detailQuery = useCategoryAdmin(categoryKey);
  const updateMut = useUpdateCategoryMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', description: '' },
  });

  useEffect(() => {
    if (detailQuery.data) {
      reset({
        name: detailQuery.data.labelAr,
        description: detailQuery.data.description ?? '',
      });
    }
  }, [detailQuery.data, reset]);

  if (detailQuery.isLoading) return <LoadingState variant="page" />;
  if (detailQuery.error) {
    return (
      <ErrorState
        error={detailQuery.error as Error}
        onRetry={() => detailQuery.refetch()}
      />
    );
  }
  if (!detailQuery.data) {
    return <ErrorState error={new Error('الفئة غير موجودة')} />;
  }

  const onSubmit = (values: CategoryValues): void => {
    updateMut.mutate(
      {
        key: categoryKey,
        patch: {
          labelAr: values.name.trim(),
          description: (values.description ?? '').trim(),
        },
      },
      {
        onSuccess: () => {
          toast('تم حفظ الفئة', 'success');
          navigate(ROUTES.admin.categories);
        },
        onError: (err) => toast((err as Error).message, 'danger'),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <PageHeader
        title="تعديل فئة"
        breadcrumbs={[
          { label: 'الإدارة' },
          { label: 'الفئات', href: ROUTES.admin.categories },
          { label: 'تعديل فئة' },
        ]}
      />

      <Card>
        <div className="flex flex-col gap-4">
          <Input
            label="اسم الفئة"
            required
            {...register('name')}
            error={errors.name?.message}
          />
          <Textarea
            label="الوصف"
            rows={4}
            helper="حد أقصى 500 حرف"
            {...register('description')}
            error={errors.description?.message}
          />

          <div className="mt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate(ROUTES.admin.categories)}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              leadingIcon={<Save size={14} strokeWidth={1.75} />}
              isLoading={updateMut.isPending}
            >
              حفظ
            </Button>
          </div>
        </div>
      </Card>
    </form>
  );
}
