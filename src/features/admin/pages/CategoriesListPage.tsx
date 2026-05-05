/**
 * CategoriesListPage — Bucket D2.
 *
 * Lists the 7 spec departments + any custom departments. Per row:
 *   - label, key, type pill (public / nomination-only),
 *   - active-cycle status (open in current cycle / closed / no cycle),
 *   - actions (edit, delete-only-for-non-spec).
 *
 * Spec departments cannot be deleted; their delete button is hidden.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layers, Pencil, PlusCircle, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  IconStamp,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  toast,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import type {
  ApplicantCategory,
  ApplicantCategoryKey,
} from '@/shared/types/domain';
import { ROUTES } from '@/config/routes';
import {
  useCategoriesAdmin,
  useCreateCategoryMutation,
  useRemoveCategoryMutation,
} from '../api/categories.queries';
import { useActiveCycle } from '../api/cycles.queries';
import { categoriesAdminService } from '../api/categories.service';

export function CategoriesListPage(): JSX.Element {
  const navigate = useNavigate();
  const listQuery = useCategoriesAdmin();
  const cycleQuery = useActiveCycle();
  const removeMut = useRemoveCategoryMutation();
  const [isAddOpen, setAddOpen] = useState(false);

  if (listQuery.isLoading) return <LoadingState variant="page" />;
  if (listQuery.error) {
    return <ErrorState error={listQuery.error as Error} onRetry={() => listQuery.refetch()} />;
  }

  const categories = listQuery.data ?? [];
  const activeCycle = cycleQuery.data ?? null;

  const onDelete = (cat: ApplicantCategory): void => {
    if (categoriesAdminService.isSpecCategory(cat.key)) {
      toast('لا يمكن حذف الفئات المعتمدة من المواصفات', 'warning');
      return;
    }
    if (!window.confirm(`هل تريد حذف فئة "${cat.labelAr}"؟`)) return;
    removeMut.mutate(cat.key, {
      onSuccess: () => toast(`تم حذف "${cat.labelAr}"`, 'success'),
      onError: (err) => toast((err as Error).message, 'danger'),
    });
  };

  const columns: DataTableColumn<ApplicantCategory>[] = [
    {
      key: 'labelAr',
      label: 'الفئة',
      render: (cat) => (
        <Link
          to={ROUTES.admin.categoryEdit(cat.key)}
          className="font-medium text-teal-700 hover:underline"
        >
          {cat.labelAr}
        </Link>
      ),
    },
    {
      key: 'key',
      label: 'المفتاح',
      render: (cat) => (
        <span dir="ltr" className="font-mono text-2xs text-ink-500">{cat.key}</span>
      ),
    },
    {
      key: 'type',
      label: 'النوع',
      render: (cat) =>
        cat.conditions.nominationOnly ? (
          <Badge tone="warning">بالترشيح</Badge>
        ) : (
          <Badge tone="neutral">تقديم عام</Badge>
        ),
    },
    {
      key: 'conditions',
      label: 'الشروط',
      render: (cat) => {
        const parts: string[] = [];
        if (cat.conditions.ageMax !== null) parts.push(`السن ≤ ${cat.conditions.ageMax}`);
        if (cat.conditions.minHeightCm !== null) parts.push(`طول ≥ ${cat.conditions.minHeightCm}سم`);
        if (cat.conditions.minScorePercent !== null) parts.push(`مجموع ≥ ${cat.conditions.minScorePercent}%`);
        return <span className="text-2xs text-ink-500">{parts.join(' · ') || '—'}</span>;
      },
    },
    {
      key: 'tests',
      label: 'الاختبارات',
      numeric: true,
      render: (cat) => <span className="font-numeric tnum text-2xs text-ink-500">{cat.requiredTests.length}</span>,
    },
    {
      key: 'cycleStatus',
      label: 'الدورة الحالية',
      render: (cat) => {
        if (!activeCycle) return <span className="text-2xs text-ink-500">لا توجد دورة نشطة</span>;
        const cfg = activeCycle.openCategories?.[cat.key];
        return cfg?.isOpen ? (
          <span className="inline-flex items-center gap-1 text-2xs text-teal-700">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-teal-500" />
            مفتوح في الدورة الحالية
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-2xs text-ink-500">
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-ink-300" />
            مغلق في الدورة الحالية
          </span>
        );
      },
    },
    {
      key: '_actions',
      label: <span className="sr-only">إجراءات</span>,
      align: 'end',
      render: (cat) => {
        const isSpec = categoriesAdminService.isSpecCategory(cat.key);
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<Pencil size={12} strokeWidth={1.75} />}
              onClick={() => navigate(ROUTES.admin.categoryEdit(cat.key))}
            >
              تعديل
            </Button>
            {!isSpec && (
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<Trash2 size={12} strokeWidth={1.75} />}
                onClick={() => onDelete(cat)}
              >
                حذف
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="إدارة فئات التقديم"
        subtitle="عدّل الفئات السبع المعتمدة وأضف فئات مخصصة"
        actions={
          <div className="flex items-center gap-2">
            <Link to={ROUTES.admin.cycles}>
              <Button variant="secondary" leadingIcon={<IconStamp width={12} height={12} />}>
                إدارة الدورات والفترات
              </Button>
            </Link>
            <Button
              variant="primary"
              leadingIcon={<PlusCircle size={14} strokeWidth={1.75} />}
              onClick={() => setAddOpen(true)}
            >
              إضافة فئة
            </Button>
          </div>
        }
      />

      <DataTable
        data={categories}
        columns={columns}
        rowKey={(c) => c.key}
        loading={listQuery.isFetching}
        empty={
          <EmptyState
            variant="generic"
            title="لا توجد فئات"
            description="لم يتم إنشاء فئات تقديم بعد."
            icon={<Layers size={32} strokeWidth={1.75} />}
          />
        }
        zebraStripes
      />

      <NewCategoryDialog
        open={isAddOpen}
        onClose={() => setAddOpen(false)}
        existingKeys={categories.map((c) => c.key)}
        onCreated={(cat) => {
          setAddOpen(false);
          toast(`تم إنشاء "${cat.labelAr}"`, 'success');
          navigate(ROUTES.admin.categoryEdit(cat.key));
        }}
      />
    </div>
  );
}

const KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

function NewCategoryDialog({
  open,
  onClose,
  existingKeys,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  existingKeys: ApplicantCategoryKey[];
  onCreated: (cat: ApplicantCategory) => void;
}): JSX.Element {
  const createMut = useCreateCategoryMutation();
  const [key, setKey] = useState('');
  const [labelAr, setLabelAr] = useState('');
  const [labelEn, setLabelEn] = useState('');
  const [nominationOnly, setNominationOnly] = useState(false);
  const [errors, setErrors] = useState<{ key?: string; labelAr?: string }>({});

  const reset = (): void => {
    setKey('');
    setLabelAr('');
    setLabelEn('');
    setNominationOnly(false);
    setErrors({});
  };

  const handleClose = (): void => {
    reset();
    onClose();
  };

  const handleSubmit = (): void => {
    const next: { key?: string; labelAr?: string } = {};
    const trimmedKey = key.trim();
    const trimmedLabelAr = labelAr.trim();
    if (!trimmedKey) {
      next.key = 'المفتاح مطلوب';
    } else if (!KEY_PATTERN.test(trimmedKey)) {
      next.key = 'يبدأ بحرف صغير ويتكوّن من أحرف لاتينية صغيرة وأرقام و _';
    } else if (existingKeys.includes(trimmedKey as ApplicantCategoryKey)) {
      next.key = 'هذا المفتاح موجود بالفعل';
    }
    if (!trimmedLabelAr) next.labelAr = 'الاسم بالعربية مطلوب';
    if (next.key || next.labelAr) {
      setErrors(next);
      return;
    }
    setErrors({});

    const payload: ApplicantCategory = {
      key: trimmedKey as ApplicantCategoryKey,
      labelAr: trimmedLabelAr,
      labelEn: labelEn.trim(),
      description: '',
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
        reset();
        onCreated(cat);
      },
      onError: (err) => toast((err as Error).message, 'danger'),
    });
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="إضافة فئة جديدة"
      subtitle="أنشئ فئة مخصصة ثم أكمل شروطها واختباراتها في صفحة التعديل"
      size="sm"
    >
      <Modal.Body>
        <div className="flex flex-col gap-3">
          <Input
            label="المفتاح"
            dir="ltr"
            required
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="custom_department"
            helper="معرّف لاتيني فريد — لا يمكن تغييره لاحقاً"
            error={errors.key}
          />
          <Input
            label="الاسم بالعربية"
            required
            value={labelAr}
            onChange={(e) => setLabelAr(e.target.value)}
            error={errors.labelAr}
          />
          <Input
            label="Label (English)"
            dir="ltr"
            value={labelEn}
            onChange={(e) => setLabelEn(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              checked={nominationOnly}
              onChange={(e) => setNominationOnly(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-teal-500"
            />
            بالترشيح فقط (لا يظهر في التقديم العام)
          </label>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={handleClose} disabled={createMut.isPending}>
          إلغاء
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          isLoading={createMut.isPending}
          leadingIcon={<PlusCircle size={14} strokeWidth={1.75} />}
        >
          إنشاء وفتح للتعديل
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
