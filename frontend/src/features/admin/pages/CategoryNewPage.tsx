/**
 * CategoryNewPage — full-page form for creating a custom applicant category.
 *
 * Replaces the previous in-modal create flow. Shape mirrors CategoryEditPage's
 * identity card (label / description / nominationOnly) so the visual language
 * is consistent. The full condition matrix and required-tests sections are
 * not edited here — on success we navigate to `/admin/categories/<key>` for
 * those, which is the same surface admins use to edit existing categories.
 *
 * The route MUST be registered BEFORE `/admin/categories/:key` so React
 * Router treats `/admin/categories/new` as the literal create page rather
 * than a category whose key is "new".
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, PlusCircle } from 'lucide-react';
import {
  Button,
  Card,
  Input,
  PageHeader,
  Textarea,
  toast,
} from '@/shared/components';
import type {
  ApplicantCategory,
  ApplicantCategoryKey,
} from '@/shared/types/domain';
import { ROUTES } from '@/config/routes';
import {
  useCategoriesAdmin,
  useCreateCategoryMutation,
} from '../api/categories.queries';


export function CategoryNewPage(): JSX.Element {
  const navigate = useNavigate();
  const listQuery = useCategoriesAdmin();
  const createMut = useCreateCategoryMutation();

  const existingKeys = useMemo(
    () => new Set((listQuery.data ?? []).map((c) => c.key as string)),
    [listQuery.data],
  );

  const [labelAr, setLabelAr] = useState('');
  const [description, setDescription] = useState('');
  const [nominationOnly, setNominationOnly] = useState(false);
  const [errors, setErrors] = useState<{ labelAr?: string }>({});

  /* Auto-generate a unique custom key — admins no longer pick this.
   * Loop on collision so a fast double-click can't reuse the timestamp. */
  const generateKey = (): ApplicantCategoryKey => {
    let candidate = `custom_${Date.now()}`;
    while (existingKeys.has(candidate)) {
      candidate = `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    }
    return candidate as ApplicantCategoryKey;
  };

  const onSubmit = (): void => {
    const next: { labelAr?: string } = {};
    const trimmedLabelAr = labelAr.trim();
    if (!trimmedLabelAr) next.labelAr = 'الاسم بالعربية مطلوب';
    if (next.labelAr) {
      setErrors(next);
      return;
    }
    setErrors({});

    const payload: ApplicantCategory = {
      key: generateKey(),
      labelAr: trimmedLabelAr,
      labelEn: '',
      description: description.trim(),
      isOpen: false,
      conditions: {
        ageMin: null,
        ageMax: null,
        minScorePercent: null,
        requiredQualification: 'any',
        gender: 'any',
        minHeightCm: null,
        medicalRequired: false,
        maritalStatus: 'any',
        conductCheck: false,
        egyptianNationalityRequired: false,
        employerApprovalRequired: false,
        nominationOnly,
        freeText: [],
      },
      requiredTests: [],
      procedures: [],
    };

    createMut.mutate(payload, {
      onSuccess: (cat) => {
        toast(`تم إنشاء "${cat.labelAr}"`, 'success');
        navigate(ROUTES.admin.categoryEdit(cat.key));
      },
      onError: (err) => toast((err as Error).message, 'danger'),
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="إضافة فئة جديدة"
        subtitle="املأ بيانات الفئة الأساسية، ثم أكمل الشروط والاختبارات في صفحة التعديل"
        breadcrumbs={[
          { label: 'إدارة الفئات', href: ROUTES.admin.categories },
          { label: 'فئة جديدة' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<ArrowLeft size={14} strokeWidth={1.75} className="rtl:scale-x-[-1]" />}
              onClick={() => navigate(ROUTES.admin.categories)}
            >
              رجوع
            </Button>
            <Button
              variant="primary"
              leadingIcon={<PlusCircle size={14} strokeWidth={1.75} />}
              onClick={onSubmit}
              isLoading={createMut.isPending}
            >
              إنشاء وفتح للتعديل
            </Button>
          </div>
        }
      />

      <Card>
        <h3 className="mb-3 font-ar-display text-md font-bold text-ink-900">بيانات الفئة</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="الاسم بالعربية"
            required
            value={labelAr}
            onChange={(e) => setLabelAr(e.target.value)}
            error={errors.labelAr}
            containerClassName="md:col-span-2"
          />
          <Textarea
            label="الوصف"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            containerClassName="md:col-span-2"
          />
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={nominationOnly}
            onChange={(e) => setNominationOnly(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-teal-500"
          />
          بالترشيح فقط (لا يظهر في التقديم العام)
        </label>
      </Card>
    </div>
  );
}
