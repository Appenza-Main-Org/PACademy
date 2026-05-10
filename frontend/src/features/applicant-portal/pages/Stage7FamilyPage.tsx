/**
 * Stage 7 — family data (RFP Scope Document §2.2 stage 7).
 * Father/mother/grandparents fixed; siblings + relatives via useFieldArray.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Info, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { Button, Card, Input, Modal, Select, toast } from '@/shared/components';
import { zodResolver } from '@/shared/lib/zod-resolver';
import { withAudit } from '@/shared/lib/audit';
import { stage7Schema, type Stage7Values } from '../schemas';
import { applicantPortalService } from '../api/applicantPortal.service';
import { REF_RELATIONSHIPS } from '@/shared/mock-data/referenceData';

const APPLICANT_ID = 'APP-2026000';

const RELATIONSHIP_OPTIONS = REF_RELATIONSHIPS.map((r) => ({ value: r.id, label: r.nameAr }));

const emptyMember = { fullName: '', alive: true };

const ROLE_TONES: Record<string, { bg: string; fg: string }> = {
  father:               { bg: 'bg-teal-50',  fg: 'text-teal-700'  },
  mother:               { bg: 'bg-gold-50',  fg: 'text-gold-700'  },
  stepfather:           { bg: 'bg-ink-50',   fg: 'text-ink-600'   },
  paternalGrandfather:  { bg: 'bg-ink-100',  fg: 'text-ink-700'   },
  paternalGrandmother:  { bg: 'bg-ink-100',  fg: 'text-ink-700'   },
  maternalGrandfather:  { bg: 'bg-ink-100',  fg: 'text-ink-700'   },
  maternalGrandmother:  { bg: 'bg-ink-100',  fg: 'text-ink-700'   },
};

export function Stage7FamilyPage(): JSX.Element {
  const navigate = useNavigate();
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<Stage7Values>({
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- zodResolver returns any; see src/shared/lib/zod-resolver.ts header.
    resolver: zodResolver(stage7Schema),
    defaultValues: {
      father: { ...emptyMember },
      mother: { ...emptyMember },
      stepfather: { ...emptyMember, fullName: '' },
      paternalGrandfather: { ...emptyMember },
      paternalGrandmother: { ...emptyMember },
      maternalGrandfather: { ...emptyMember },
      maternalGrandmother: { ...emptyMember },
      siblings: [],
      relatives: [],
    },
  });

  const sibArr = useFieldArray({ control, name: 'siblings' });
  const relArr = useFieldArray({ control, name: 'relatives' });

  /* اعتماد gate — the MOI reference shows an explicit approval step
   * after data entry, before exam-slot pick. We render the saved values
   * as a read-only summary modal; the applicant must tick the
   * declaration checkbox and click 'اعتماد' before navigation continues. */
  const [pendingValues, setPendingValues] = useState<Stage7Values | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const onSubmit = async (values: Stage7Values): Promise<void> => {
    /* NID uniqueness check across all members. */
    const nids = collectNids(values);
    const dup = nids.find((nid, i) => nid && nids.indexOf(nid) !== i);
    if (dup) {
      toast(`الرقم القومي ${dup} مكرر — تأكد من عدم تكرار البيانات.`, 'danger');
      return;
    }
    await applicantPortalService.submitStage(APPLICANT_ID, 7, { family: values });
    toast('تم حفظ بيانات الأسرة', 'success');
    setPendingValues(values);
    setAcknowledged(false);
  };

  const onApprove = async (): Promise<void> => {
    if (!pendingValues || !acknowledged) return;
    setIsApproving(true);
    try {
      /* AF-6 — emit audit event for the explicit اعتماد action. The
       * applicant is the actor; investigations / committee review the
       * family data afterward and need a durable record of when the
       * applicant signed off on it. */
      const approvedAt = Date.now();
      await withAudit(
        () =>
          applicantPortalService.submitStage(APPLICANT_ID, 7, {
            family: pendingValues,
            familyApprovedAt: approvedAt,
          }),
        {
          action: 'applicant.transition',
          module: 'applicants',
          entityType: 'applicant_family',
          entityLabel: 'بيانات الأسرة (المتقدم)',
          entityId: APPLICANT_ID,
          details: 'اعتماد المتقدم لبيانات الأسرة قبل حجز موعد الاختبار',
          afterFrom: () => ({ familyApprovedAt: approvedAt, acknowledged: true }),
          actor: { id: APPLICANT_ID, name: 'المتقدم', role: 'applicant' },
        },
      );
      toast('تم اعتماد بيانات الأسرة', 'success');
      navigate('/applicant/exam-schedule');
    } finally {
      setIsApproving(false);
    }
  };

  const watched = useWatch({ control });
  const filledFixed = ['father', 'mother', 'paternalGrandfather', 'paternalGrandmother', 'maternalGrandfather', 'maternalGrandmother']
    .filter((k) => Boolean((watched as Record<string, { fullName?: string }>)[k]?.fullName?.trim())).length;
  const totalMembers = filledFixed + (watched?.siblings?.length ?? 0) + (watched?.relatives?.length ?? 0);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-md bg-teal-50 text-teal-700">
            <Users size={20} strokeWidth={1.75} />
          </span>
          <div className="flex-1">
            <h2 className="font-ar-display text-xl font-bold text-ink-900">بيانات الأسرة</h2>
            <p className="mt-1 text-sm text-ink-500 leading-normal">
              يلزم إدخال بيانات الوالدين والأجداد ومن بعدهم حتى الدرجة الرابعة. وتُستخدم هذه البيانات
              لإجراء التحريات الأمنية الشاملة.
            </p>
          </div>
          <span className="hidden self-center rounded-pill bg-teal-50 px-3 py-1 text-2xs font-bold text-teal-700 md:inline-flex">
            <span className="font-numeric tnum">{totalMembers}</span>
            <span className="ms-1">فرداً مُسجّل</span>
          </span>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-md border border-gold-300 bg-gold-50 p-3 text-2xs text-gold-700">
          <ShieldCheck size={14} strokeWidth={1.75} className="mt-0.5 flex-shrink-0" aria-hidden />
          <p className="leading-normal">
            <strong>تنبيه أمني:</strong> هذه البيانات تخضع لتحرّ مفصّل من إدارات قطاع الأمن العام
            بالتعاون مع المخابرات العامة، وأي بيان غير صحيح يُعتبر إخلالاً بشروط التقدم.
          </p>
        </div>
      </Card>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <SectionHeader title="الأسرة المباشرة" subtitle="الوالدان" />
        <FamilyMemberFields title="الأب" register={register} prefix="father" errors={errors} />
        <FamilyMemberFields title="الأم" register={register} prefix="mother" errors={errors} />
        <FamilyMemberFields
          title="زوج الوالدة (اختياري)"
          register={register}
          prefix="stepfather"
          errors={errors}
          optional
        />

        <SectionHeader title="من ناحية الأب" subtitle="الجدّان من جهة الوالد" />
        <FamilyMemberFields title="الجد لأب" register={register} prefix="paternalGrandfather" errors={errors} />
        <FamilyMemberFields title="الجدة لأب" register={register} prefix="paternalGrandmother" errors={errors} />

        <SectionHeader title="من ناحية الأم" subtitle="الجدّان من جهة الوالدة" />
        <FamilyMemberFields title="الجد لأم" register={register} prefix="maternalGrandfather" errors={errors} />
        <FamilyMemberFields title="الجدة لأم" register={register} prefix="maternalGrandmother" errors={errors} />

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-ar-display text-md font-bold text-ink-900">الإخوة والأخوات</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leadingIcon={<Plus size={12} strokeWidth={1.75} />}
              onClick={() => sibArr.append({ ...emptyMember })}
            >
              إضافة
            </Button>
          </div>
          {sibArr.fields.length === 0 && (
            <p className="text-sm text-ink-500">لا توجد بيانات إخوة مسجلة</p>
          )}
          <div className="flex flex-col gap-3">
            {sibArr.fields.map((field, i) => (
              <DynamicMemberRow
                key={field.id}
                register={register}
                prefix={`siblings.${i}` as const}
                onRemove={() => sibArr.remove(i)}
              />
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-ar-display text-md font-bold text-ink-900">الأقارب حتى الدرجة الرابعة</h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leadingIcon={<Plus size={12} strokeWidth={1.75} />}
              onClick={() => relArr.append({ ...emptyMember, relationshipId: '' })}
            >
              إضافة
            </Button>
          </div>
          {relArr.fields.length === 0 && (
            <p className="text-sm text-ink-500">لا توجد بيانات أقارب مسجلة</p>
          )}
          <div className="flex flex-col gap-3">
            {relArr.fields.map((field, i) => (
              <div key={field.id} className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
                <Input label="الاسم" {...register(`relatives.${i}.fullName` as const)} />
                <Input label="الرقم القومي" dir="ltr" {...register(`relatives.${i}.nationalId` as const)} />
                <Select
                  label="درجة القرابة"
                  required
                  {...register(`relatives.${i}.relationshipId` as const)}
                  options={RELATIONSHIP_OPTIONS}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="حذف"
                  onClick={() => relArr.remove(i)}
                  className="self-end"
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                </Button>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="rounded-md border border-dashed border-gold-300 bg-gold-50 px-3 py-2 text-2xs text-gold-700 leading-normal">
            ستُحفظ هذه البيانات بصورة <span className="font-bold">«أوليّة»</span> ولن تُعتمد إلا بعد اكتمال
            التحريات الأمنية على جميع الدرجات. أيّ بيان غير دقيق قد يؤدي إلى إيقاف الترشّح.
          </div>
          <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting}>
            حفظ ومراجعة
          </Button>
        </div>
      </form>

      <Modal
        open={pendingValues !== null}
        onClose={() => {
          if (!isApproving) setPendingValues(null);
        }}
        title="اعتماد بيانات الأسرة"
        size="lg"
      >
        <Modal.Body>
          <p className="mb-3 text-sm text-ink-700">
            راجِع البيانات قبل الاعتماد. لا يمكن المتابعة إلى حجز موعد الاختبار قبل اعتماد بيانات الأسرة بشكل صريح.
          </p>
          {pendingValues && <FamilySummary values={pendingValues} />}
          <label className="mt-4 flex items-start gap-2 rounded-md border border-dashed border-gold-300 bg-gold-50 p-3 text-sm text-gold-700">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-1 h-4 w-4 cursor-pointer accent-teal-500"
            />
            <span>
              <span className="font-bold">أُقرّ بصحة بيانات الأسرة</span> الواردة أعلاه، وأعلم أن أيّ بيان غير صحيح يُعدّ
              إخلالاً بشروط التقدم وقد يؤدي إلى إيقاف الترشّح.
            </span>
          </label>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="ghost"
            onClick={() => setPendingValues(null)}
            disabled={isApproving}
          >
            تعديل البيانات
          </Button>
          <Button
            variant="primary"
            onClick={onApprove}
            disabled={!acknowledged}
            isLoading={isApproving}
          >
            اعتماد ومتابعة
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

function FamilySummary({ values }: { values: Stage7Values }): JSX.Element {
  const fixed: Array<{ label: string; key: FixedMemberKey; required: boolean }> = [
    { label: 'الأب', key: 'father', required: true },
    { label: 'الأم', key: 'mother', required: true },
    { label: 'زوج الوالدة', key: 'stepfather', required: false },
    { label: 'الجد لأب', key: 'paternalGrandfather', required: true },
    { label: 'الجدة لأب', key: 'paternalGrandmother', required: true },
    { label: 'الجد لأم', key: 'maternalGrandfather', required: true },
    { label: 'الجدة لأم', key: 'maternalGrandmother', required: true },
  ];
  return (
    <div className="grid gap-3 rounded-md border border-border-default bg-ink-50 p-3 text-sm md:grid-cols-2">
      {fixed.map(({ label, key, required }) => {
        const m = values[key];
        const hasName = Boolean(m?.fullName?.trim());
        if (!required && !hasName) return null;
        return (
          <div key={key} className="rounded-md border border-border-subtle bg-surface-card p-2">
            <p className="text-2xs uppercase tracking-wide text-ink-500">{label}</p>
            <p className="mt-0.5 font-medium text-ink-900">{m?.fullName?.trim() || '— لم يُدخَل —'}</p>
            {m?.nationalId && (
              <p className="text-2xs text-ink-500" dir="ltr">{m.nationalId}</p>
            )}
          </div>
        );
      })}
      {values.siblings.length > 0 && (
        <div className="md:col-span-2 rounded-md border border-border-subtle bg-surface-card p-2">
          <p className="text-2xs uppercase tracking-wide text-ink-500">الإخوة والأخوات</p>
          <p className="mt-0.5 font-numeric tnum font-bold text-ink-900">
            {values.siblings.length} مُسجَّل
          </p>
        </div>
      )}
      {values.relatives.length > 0 && (
        <div className="md:col-span-2 rounded-md border border-border-subtle bg-surface-card p-2">
          <p className="text-2xs uppercase tracking-wide text-ink-500">الأقارب حتى الدرجة الرابعة</p>
          <p className="mt-0.5 font-numeric tnum font-bold text-ink-900">
            {values.relatives.length} مُسجَّل
          </p>
        </div>
      )}
    </div>
  );
}

type FixedMemberKey =
  | 'father'
  | 'mother'
  | 'stepfather'
  | 'paternalGrandfather'
  | 'paternalGrandmother'
  | 'maternalGrandfather'
  | 'maternalGrandmother';

function FamilyMemberFields({
  title,
  register,
  prefix,
  optional,
}: {
  title: string;
  register: ReturnType<typeof useForm<Stage7Values>>['register'];
  prefix: FixedMemberKey;
  errors: Record<string, unknown>;
  optional?: boolean;
}): JSX.Element {
  const tone = ROLE_TONES[prefix] ?? { bg: 'bg-ink-100', fg: 'text-ink-700' };
  return (
    <Card>
      <header className="mb-3 flex items-center gap-3">
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${tone.bg} ${tone.fg}`} aria-hidden>
          <Users size={14} strokeWidth={1.75} />
        </span>
        <h3 className="font-ar-display text-md font-bold text-ink-900">{title}</h3>
      </header>
      <div className="grid gap-3 md:grid-cols-3">
        <Input label="الاسم بالكامل" required={!optional} {...register(`${prefix}.fullName`)} />
        <Input label="الرقم القومي" dir="ltr" {...register(`${prefix}.nationalId`)} />
        <Input label="المهنة" {...register(`${prefix}.occupation`)} />
        <Input label="المحافظة" {...register(`${prefix}.governorate`)} />
        <Input label="المؤهل التعليمي" {...register(`${prefix}.education`)} />
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" {...register(`${prefix}.alive`)} className="h-4 w-4 cursor-pointer accent-teal-500" />
          على قيد الحياة
        </label>
      </div>
    </Card>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }): JSX.Element {
  return (
    <div className="-mb-2 flex items-center gap-3">
      <span aria-hidden className="h-px flex-1 bg-border-default" />
      <div className="flex items-center gap-2 text-2xs font-medium text-ink-500">
        <Info size={11} strokeWidth={1.75} />
        <span className="font-ar-display text-md font-bold text-ink-900">{title}</span>
        <span>·</span>
        <span>{subtitle}</span>
      </div>
      <span aria-hidden className="h-px flex-1 bg-border-default" />
    </div>
  );
}

function DynamicMemberRow({
  register,
  prefix,
  onRemove,
}: {
  register: ReturnType<typeof useForm<Stage7Values>>['register'];
  prefix: `siblings.${number}`;
  onRemove: () => void;
}): JSX.Element {
  return (
    <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]">
      <Input label="الاسم" {...register(`${prefix}.fullName` as const)} />
      <Input label="الرقم القومي" dir="ltr" {...register(`${prefix}.nationalId` as const)} />
      <Input label="المهنة" {...register(`${prefix}.occupation` as const)} />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="حذف"
        onClick={onRemove}
        className="self-end"
      >
        <Trash2 size={14} strokeWidth={1.75} />
      </Button>
    </div>
  );
}

function collectNids(values: Stage7Values): string[] {
  const out: string[] = [];
  const fixed = ['father', 'mother', 'paternalGrandfather', 'paternalGrandmother', 'maternalGrandfather', 'maternalGrandmother'] as const;
  for (const key of fixed) {
    const nid = values[key]?.nationalId;
    if (nid) out.push(nid);
  }
  if (values.stepfather?.nationalId) out.push(values.stepfather.nationalId);
  for (const s of values.siblings ?? []) if (s.nationalId) out.push(s.nationalId);
  for (const r of values.relatives ?? []) if (r.nationalId) out.push(r.nationalId);
  return out;
}
