/**
 * LookupFormDrawer — create or edit a single LookupItem.
 *
 * Uses the shared `Drawer` (focus-trapped, Esc-closable) + react-hook-form
 * + zodResolver. The schema enforces the brief's `[A-Z]+-\d{3,}` code
 * format, date-range validity, and JSON parseability when metadata is
 * authored as raw JSON.
 *
 * The parent picker is shown only for hierarchical types; the metadata
 * editor is shown only for ACADEMIC_GRADES (the lone type whose seed
 * carries first-class metadata fields).
 */

import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Button,
  Drawer,
  Input,
  Switch,
  Textarea,
  toast,
} from '@/shared/components';
import { zodResolver } from '@/shared/lib/zod-resolver';
import {
  useCreateLookup,
  useLookupList,
  useUpdateLookup,
} from '../api/lookups.queries';
import {
  HIERARCHICAL_TYPES,
  type LookupItem,
  type LookupTypeCode,
} from '../types';

const CODE_PATTERN = /^[A-Z][A-Z0-9_]*-\d{3,}$/;

const schema = z
  .object({
    code: z
      .string()
      .min(1, 'الكود مطلوب')
      .regex(CODE_PATTERN, 'الكود يجب أن يطابق النمط ABC-001'),
    nameAr: z.string().min(1, 'الاسم بالعربية مطلوب'),
    nameEn: z.string().nullable(),
    description: z.string().nullable(),
    sortOrder: z.number().int().min(0),
    isActive: z.boolean(),
    parentId: z.string().nullable(),
    metadataRaw: z.string(),
    startDate: z.string().nullable(),
    endDate: z.string().nullable(),
  })
  .superRefine((values, ctx) => {
    if (values.metadataRaw.trim().length > 0) {
      try {
        JSON.parse(values.metadataRaw);
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['metadataRaw'],
          message: 'البيانات الإضافية يجب أن تكون JSON صالحاً',
        });
      }
    }
    if (values.startDate && values.endDate) {
      if (new Date(values.startDate).getTime() > new Date(values.endDate).getTime()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endDate'],
          message: 'تاريخ النهاية يجب أن يكون بعد البداية',
        });
      }
    }
  });

type FormValues = z.infer<typeof schema>;

export interface LookupFormDrawerProps {
  open: boolean;
  onClose: () => void;
  /** When provided, the drawer is in edit mode. */
  editing: LookupItem | null;
  /** Required for create. Inferred from `editing` when editing. */
  typeCode: LookupTypeCode;
  /** Pre-selected parent for create-child flows. Ignored on edit. */
  defaultParentId?: string | null;
}

export function LookupFormDrawer({
  open,
  onClose,
  editing,
  typeCode,
  defaultParentId,
}: LookupFormDrawerProps): JSX.Element {
  const isEdit = editing !== null;
  const isHierarchical = HIERARCHICAL_TYPES.has(typeCode);
  const showMetadata = typeCode === 'ACADEMIC_GRADES';

  const createMut = useCreateLookup();
  const updateMut = useUpdateLookup();

  const parentsQuery = useLookupList({
    typeCode,
    includeInactive: false,
    pageSize: 200,
  });

  const defaults = useMemo<FormValues>(
    () => ({
      code: editing?.code ?? '',
      nameAr: editing?.nameAr ?? '',
      nameEn: editing?.nameEn ?? null,
      description: editing?.description ?? null,
      sortOrder: editing?.sortOrder ?? 10,
      isActive: editing?.isActive ?? true,
      parentId: editing?.parentId ?? defaultParentId ?? null,
      metadataRaw: editing?.metadata ? JSON.stringify(editing.metadata, null, 2) : '',
      startDate: editing?.startDate ?? null,
      endDate: editing?.endDate ?? null,
    }),
    [editing, defaultParentId],
  );

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  useEffect(() => {
    reset(defaults);
  }, [defaults, reset]);

  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const tryClose = (): void => {
    if (isDirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  };

  const onSubmit = (values: FormValues): void => {
    const metadata =
      values.metadataRaw.trim().length > 0
        ? (JSON.parse(values.metadataRaw) as Record<string, unknown>)
        : null;
    const payload = {
      code: values.code,
      nameAr: values.nameAr,
      nameEn: values.nameEn,
      description: values.description,
      sortOrder: values.sortOrder,
      isActive: values.isActive,
      parentId: values.parentId,
      metadata,
      startDate: values.startDate,
      endDate: values.endDate,
    };
    if (isEdit && editing) {
      updateMut.mutate(
        { id: editing.id, patch: payload },
        {
          onSuccess: () => {
            toast(`تم تحديث ${values.nameAr}`, 'success');
            onClose();
          },
        },
      );
    } else {
      createMut.mutate(
        { lookupTypeCode: typeCode, ...payload },
        {
          onSuccess: () => {
            toast(`تم إضافة ${values.nameAr}`, 'success');
            onClose();
          },
        },
      );
    }
  };

  const submitting = createMut.isPending || updateMut.isPending;
  const parents = parentsQuery.data?.data ?? [];

  return (
    <>
      <Drawer
        open={open}
        onClose={tryClose}
        size="md"
        title={isEdit ? 'تعديل عنصر' : 'إضافة عنصر'}
        subtitle={`النوع: ${typeCode}`}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="الكود"
                placeholder="UNI-001"
                required
                error={errors.code?.message}
                {...register('code')}
              />
              <Input
                label="الترتيب"
                type="number"
                inputMode="numeric"
                {...register('sortOrder', { valueAsNumber: true })}
              />
              <Input
                label="الاسم بالعربية"
                required
                error={errors.nameAr?.message}
                containerClassName="col-span-2"
                {...register('nameAr')}
              />
              <Input
                label="الاسم بالإنجليزية"
                containerClassName="col-span-2"
                {...register('nameEn', {
                  setValueAs: (v: string) => (v === '' ? null : v),
                })}
              />
              <Textarea
                label="الوصف"
                rows={3}
                containerClassName="col-span-2"
                {...register('description', {
                  setValueAs: (v: string) => (v === '' ? null : v),
                })}
              />
              {isHierarchical && (
                <div className="col-span-2">
                  <label className="mb-1 block text-sm text-ink-800 font-ar">العنصر الأب</label>
                  <Controller
                    control={control}
                    name="parentId"
                    render={({ field }) => (
                      <select
                        className="w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.currentTarget.value || null)}
                      >
                        <option value="">— (جذر)</option>
                        {parents
                          .filter((p) => p.id !== editing?.id)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nameAr} ({p.code})
                            </option>
                          ))}
                      </select>
                    )}
                  />
                </div>
              )}
              <Input
                label="تاريخ بداية الصلاحية"
                type="date"
                {...register('startDate', {
                  setValueAs: (v: string) => (v === '' ? null : v),
                })}
              />
              <Input
                label="تاريخ نهاية الصلاحية"
                type="date"
                error={errors.endDate?.message}
                {...register('endDate', {
                  setValueAs: (v: string) => (v === '' ? null : v),
                })}
              />
              {showMetadata && (
                <Textarea
                  label="بيانات إضافية (JSON)"
                  helper='مثال: {"minPercentage": 75, "maxPercentage": 84.99}'
                  rows={5}
                  containerClassName="col-span-2"
                  error={errors.metadataRaw?.message}
                  className="font-mono text-xs"
                  {...register('metadataRaw')}
                />
              )}
              <div className="col-span-2">
                <Controller
                  control={control}
                  name="isActive"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      label="مفعّل"
                    />
                  )}
                />
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border-subtle px-5 py-3">
            <Button type="button" variant="ghost" onClick={tryClose}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              {isEdit ? 'حفظ' : 'إضافة'}
            </Button>
          </div>
        </form>
      </Drawer>
      <Drawer
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        size="sm"
        title="تأكيد الإلغاء"
      >
        <div className="flex flex-col gap-4 p-5">
          <p className="text-sm text-ink-700">
            توجد تغييرات لم تُحفظ. هل أنت متأكد من إغلاق النموذج؟
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDiscard(false)}>
              متابعة التعديل
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmDiscard(false);
                onClose();
              }}
            >
              إغلاق وتجاهل
            </Button>
          </div>
        </div>
      </Drawer>
    </>
  );
}
