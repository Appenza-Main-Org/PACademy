/**
 * Stage 11 — Acquaintance Document (وثيقة التعارف).
 * Source: RFP Scope Document §2.2 stage 11.
 * Comprehensive form for investigations; submit generates a printable PDF.
 */

import { useNavigate } from 'react-router-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import { Plus, Printer, Trash2 } from 'lucide-react';
import {
  Button,
  Card,
  Input,
  PrintLayout,
  Select,
  Textarea,
  toast,
} from '@/shared/components';
import { zodResolver } from '@/shared/lib/zod-resolver';
import { stage11Schema, type Stage11Values } from '../schemas';
import { applicantPortalService } from '../api/applicantPortal.service';

const APPLICANT_ID = 'APP-2026000';

export function Stage11AcquaintanceDocPage(): JSX.Element {
  const navigate = useNavigate();
  const { register, handleSubmit, control, watch, formState: { errors, isSubmitting } } = useForm<Stage11Values>({
    resolver: zodResolver(stage11Schema),
    defaultValues: {
      housing: 'family-owned',
      politicalAffiliation: { has: false },
      travelHistory: [],
      socialAccounts: [],
    },
  });

  const travelArr = useFieldArray({ control, name: 'travelHistory' });
  const socialArr = useFieldArray({ control, name: 'socialAccounts' });
  const hasPolitical = watch('politicalAffiliation.has');

  const onSubmit = async (values: Stage11Values): Promise<void> => {
    await applicantPortalService.submitStage(APPLICANT_ID, 11, { acquaintance: values });
    toast('تم حفظ وثيقة التعارف. يمكنك طباعتها الآن.', 'success');
    window.print();
    navigate('/applicant/follow-up');
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <Card className="flex items-center justify-between no-print">
        <div>
          <h2 className="font-ar-display text-xl font-bold text-ink-900">وثيقة التعارف</h2>
          <p className="text-sm text-ink-500">
            هذه الوثيقة جزء أساسي من ملف التحريات. تُحفظ وتُطبع لاحقاً.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          leadingIcon={<Printer size={14} strokeWidth={1.75} />}
          onClick={() => window.print()}
        >
          معاينة الطباعة
        </Button>
      </Card>

      <Card>
        <h3 className="mb-3 font-ar-display text-md font-bold text-ink-900">السكن</h3>
        <Select
          label="نوع السكن"
          required
          {...register('housing')}
          options={[
            { value: 'own', label: 'ملك' },
            { value: 'rent', label: 'إيجار' },
            { value: 'family-owned', label: 'ملك العائلة' },
          ]}
          error={errors.housing?.message}
        />
      </Card>

      <Card>
        <h3 className="mb-3 font-ar-display text-md font-bold text-ink-900">الانتماءات السياسية والدينية</h3>
        <label className="mb-3 flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            {...register('politicalAffiliation.has')}
            className="h-4 w-4 cursor-pointer accent-teal-500"
          />
          هل لديك أو أحد أفراد أسرتك انتماء لجهة سياسية؟
        </label>
        {hasPolitical && (
          <Textarea
            label="التفاصيل"
            required
            {...register('politicalAffiliation.details')}
            error={errors.politicalAffiliation?.details?.message}
          />
        )}
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Input label="الجماعة الدينية (اختياري)" {...register('religiousGroup')} />
          <Input label="الدور (اختياري)" {...register('religiousRole')} />
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-ar-display text-md font-bold text-ink-900">السفر خارج البلاد (آخر 10 سنوات)</h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leadingIcon={<Plus size={12} strokeWidth={1.75} />}
            onClick={() => travelArr.append({ country: '', year: new Date().getFullYear(), reason: '' })}
          >
            إضافة سفر
          </Button>
        </div>
        {travelArr.fields.length === 0 && <p className="text-sm text-ink-500">لا توجد سفريات مسجلة</p>}
        <div className="flex flex-col gap-3">
          {travelArr.fields.map((f, i) => (
            <div key={f.id} className="grid gap-2 md:grid-cols-[1fr_120px_1fr_auto]">
              <Input label="الدولة" {...register(`travelHistory.${i}.country` as const)} />
              <Input label="السنة" type="number" {...register(`travelHistory.${i}.year` as const)} />
              <Input label="السبب" {...register(`travelHistory.${i}.reason` as const)} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="حذف"
                onClick={() => travelArr.remove(i)}
                className="self-end"
              >
                <Trash2 size={14} strokeWidth={1.75} />
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-ar-display text-md font-bold text-ink-900">حسابات التواصل الاجتماعي (اختياري)</h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leadingIcon={<Plus size={12} strokeWidth={1.75} />}
            onClick={() => socialArr.append({ platform: '', handle: '' })}
          >
            إضافة حساب
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          {socialArr.fields.map((f, i) => (
            <div key={f.id} className="grid gap-2 md:grid-cols-[200px_1fr_auto]">
              <Input label="المنصة" {...register(`socialAccounts.${i}.platform` as const)} placeholder="Twitter / Facebook…" />
              <Input label="المُعرّف" dir="ltr" {...register(`socialAccounts.${i}.handle` as const)} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="حذف"
                onClick={() => socialArr.remove(i)}
                className="self-end"
              >
                <Trash2 size={14} strokeWidth={1.75} />
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <PrintLayout
        title="وثيقة التعارف الرسمية"
        subtitle="جزء من ملف تحريات المتقدم"
        reportId={`AQT-${APPLICANT_ID}`}
        generatedAt={new Date().toLocaleDateString('ar-EG')}
        restricted
      >
        <p className="mb-4 text-sm">
          أُقرّ بأن البيانات المُدرجة في هذه الوثيقة صحيحة وكاملة، وأتحمل المسؤولية القانونية الكاملة عن أي معلومات
          مُضللة أو ناقصة. هذه الوثيقة جزء من ملف التحريات وتُستخدم لأغراض الفحص الأمني فقط.
        </p>
        <p className="mt-12 text-sm">
          توقيع المتقدم: __________________________ &nbsp;&nbsp; التاريخ: __________________
        </p>
      </PrintLayout>

      <div className="flex justify-end no-print">
        <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting}>
          حفظ والطباعة
        </Button>
      </div>
    </form>
  );
}
