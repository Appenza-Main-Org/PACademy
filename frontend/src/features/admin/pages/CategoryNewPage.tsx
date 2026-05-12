/**
 * CategoryNewPage — minimal create form for an applicant category.
 *
 * Only `name` and `description` are surfaced; every other field on
 * ApplicantCategory (conditions, requiredTests, key, …) is filled in by
 * the service with sensible defaults. Edit those from CategoryEditPage
 * after creation.
 */

import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Save } from 'lucide-react';
import {
  Button,
  Card,
  Input,
  PageHeader,
  Textarea,
  toast,
} from '@/shared/components';
import { zodResolver } from '@/shared/lib/zod-resolver';
import { ROUTES } from '@/config/routes';
import { useCreateCategoryMutation } from '../api/categories.queries';

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

export function CategoryNewPage(): JSX.Element {
  const navigate = useNavigate();
  const createMut = useCreateCategoryMutation();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CategoryValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: '', description: '' },
  });

  const onSubmit = (values: CategoryValues): void => {
    createMut.mutate(
      { labelAr: values.name, description: values.description ?? '' },
      {
        onSuccess: () => {
          toast('تم إنشاء الفئة', 'success');
          navigate(ROUTES.admin.categories);
        },
        onError: (err) => toast((err).message, 'danger'),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <PageHeader
        title="إضافة فئة"
        breadcrumbs={[
          { label: 'الإدارة' },
          { label: 'الفئات', href: ROUTES.admin.categories },
          { label: 'إضافة فئة' },
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
              isLoading={createMut.isPending}
            >
              حفظ
            </Button>
          </div>
        </div>
      </Card>
    </form>
  );
}
