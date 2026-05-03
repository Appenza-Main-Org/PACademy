/**
 * Stage 7 — family data (RFP Scope Document §2.2 stage 7).
 * Father/mother/grandparents fixed; siblings + relatives via useFieldArray.
 */

import { useNavigate } from 'react-router-dom';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Info, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { Button, Card, Input, Select, toast } from '@/shared/components';
import { zodResolver } from '@/shared/lib/zod-resolver';
import { stage7Schema, type Stage7Values } from '../schemas';
import { applicantPortalService } from '../api/applicantPortal.service';
import { REF_RELATIONSHIPS } from '@/shared/mock-data/referenceData';

const APPLICANT_ID = 'APP-2026000';

const RELATIONSHIP_OPTIONS = REF_RELATIONSHIPS.map((r) => ({ value: r.id, label: r.nameAr }));

const emptyMember = { fullName: '', alive: true };

const ROLE_TONES: Record<string, { bg: string; fg: string }> = {
  father:               { bg: 'bg-teal-50',  fg: 'text-teal-700'  },
  mother:               { bg: 'bg-gold-50',  fg: 'text-gold-700'  },
  paternalGrandfather:  { bg: 'bg-ink-100',  fg: 'text-ink-700'   },
  paternalGrandmother:  { bg: 'bg-ink-100',  fg: 'text-ink-700'   },
  maternalGrandfather:  { bg: 'bg-ink-100',  fg: 'text-ink-700'   },
  maternalGrandmother:  { bg: 'bg-ink-100',  fg: 'text-ink-700'   },
};

export function Stage7FamilyPage(): JSX.Element {
  const navigate = useNavigate();
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<Stage7Values>({
    resolver: zodResolver(stage7Schema),
    defaultValues: {
      father: { ...emptyMember },
      mother: { ...emptyMember },
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
    navigate('/applicant/exam-schedule');
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
              لإجراء تحريات شاملة وفقاً لما تنصّ عليه كرّاسة الشروط.
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
            بالتعاون مع المخابرات العامة، وأي بيان غير صحيح يُعتبر إخلالاً بشروط التقدم وفقاً لكرّاسة §6.5.
          </p>
        </div>
      </Card>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <SectionHeader title="الأسرة المباشرة" subtitle="الوالدان" />
        <FamilyMemberFields title="الأب" register={register} prefix="father" errors={errors} />
        <FamilyMemberFields title="الأم" register={register} prefix="mother" errors={errors} />

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
            حفظ والمتابعة
          </Button>
        </div>
      </form>
    </div>
  );
}

type FixedMemberKey =
  | 'father'
  | 'mother'
  | 'paternalGrandfather'
  | 'paternalGrandmother'
  | 'maternalGrandfather'
  | 'maternalGrandmother';

function FamilyMemberFields({
  title,
  register,
  prefix,
}: {
  title: string;
  register: ReturnType<typeof useForm<Stage7Values>>['register'];
  prefix: FixedMemberKey;
  errors: Record<string, unknown>;
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
        <Input label="الاسم بالكامل" required {...register(`${prefix}.fullName`)} />
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
  for (const s of values.siblings ?? []) if (s.nationalId) out.push(s.nationalId);
  for (const r of values.relatives ?? []) if (r.nationalId) out.push(r.nationalId);
  return out;
}
