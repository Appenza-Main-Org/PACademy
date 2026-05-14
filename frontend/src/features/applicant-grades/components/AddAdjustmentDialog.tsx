/**
 * AddAdjustmentDialog — single modal with two visually-distinct edit zones:
 *   A. الدرجة العظمى للطالب (per-student override)
 *   B. إضافة تعديل على الدرجة (the original adjustment flow)
 *
 * Submitting commits both the override (if changed) and the adjustment in
 * one mutation per zone, so the table and drawers reflect both changes
 * after a single save.
 */

import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Info, Pencil } from 'lucide-react';
import { Badge, Button, Field, Modal } from '@/shared/components';
import { useAddAdjustment, useUpdateOverrideMax } from '../api/grades.queries';
import type { AdjustmentReason } from '../types';
import type { DerivedRow } from '../lib/derive';

const REASONS: ReadonlyArray<{ v: AdjustmentReason; label: string }> = [
  { v: 'SPORTS_ACTIVITY', label: 'نشاط رياضي' },
  { v: 'GRIEVANCE', label: 'تظلم' },
  { v: 'LEGAL_CASE', label: 'قضية' },
  { v: 'OTHER', label: 'أخرى' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  row: DerivedRow;
  currentUserName?: string;
}

export function AddAdjustmentDialog({
  open,
  onClose,
  row,
  currentUserName = 'مرتضى محمود',
}: Props): JSX.Element {
  const importMax = row.importMax;
  const existingAdjSum = row.adj;
  const existingAdjCount = row.log.filter((x) => x.isActive).length;

  const [reason, setReason] = useState<AdjustmentReason>('SPORTS_ACTIVITY');
  const [note, setNote] = useState<string>('');
  const [amount, setAmount] = useState<number>(5);
  const [isActive, setIsActive] = useState<boolean>(true);

  const [maxRaw, setMaxRaw] = useState<string>(String(row.max));
  const maxNum = Number(maxRaw);
  const maxValid = !Number.isNaN(maxNum) && maxNum > 0;
  const effMax = maxValid ? maxNum : row.max;
  const maxChanged = effMax !== row.max;

  const noteRequired = reason === 'OTHER';
  const noteEmpty = noteRequired && note.trim().length === 0;

  const liveExistingEff = useMemo(
    () => Math.max(0, Math.min(effMax, row.total + existingAdjSum)),
    [effMax, row.total, existingAdjSum],
  );
  const liveExistingEffPct = +((liveExistingEff / effMax) * 100).toFixed(2);

  const newProjected = row.total + existingAdjSum + (Number.isFinite(amount) ? amount : 0);
  const newEff = useMemo(
    () => Math.max(0, Math.min(effMax, newProjected)),
    [effMax, newProjected],
  );
  const newEffPct = +((newEff / effMax) * 100).toFixed(2);

  const totalExceedsMax = row.total > effMax;
  const existingPushesPastMax = row.total + existingAdjSum > effMax;
  const existingPushesBelowZero = row.total + existingAdjSum < 0;
  const overMax = newProjected > effMax;
  const belowZero = newProjected < 0;

  const canSubmit =
    !noteEmpty
    && !overMax
    && !belowZero
    && amount !== 0
    && maxValid
    && !totalExceedsMax
    && !existingPushesPastMax
    && !existingPushesBelowZero;

  const addAdj = useAddAdjustment();
  const updateOverride = useUpdateOverrideMax();

  async function handleSubmit() {
    if (!canSubmit) return;
    if (maxChanged) {
      await updateOverride.mutateAsync({
        seat: row.seat,
        overrideMax: effMax === importMax ? null : effMax,
        by: currentUserName,
      });
    }
    await addAdj.mutateAsync({
      seat: row.seat,
      reason,
      note: noteRequired ? note : null,
      amount,
      isActive,
      by: currentUserName,
    });
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      transparentBackdrop={false}
      title={<span className="text-md font-bold text-ink-900">إضافة تعديل على الدرجة</span>}
      subtitle={
        <span className="inline-flex flex-wrap items-center gap-2 text-xs text-ink-500">
          <span>{row.name}</span>
          <Badge tone={row.kind === 'general' ? 'info' : 'warning'}>
            {row.kind === 'general' ? 'عامة' : 'أزهرية'}
          </Badge>
          <span className="text-ink-400">·</span>
          <span dir="ltr" className="font-en">رقم الجلوس {row.seat.toLocaleString('en')}</span>
        </span>
      }
    >
      <Modal.Body>
        <div className="flex flex-col gap-5">
          {/* Stats strip */}
          <div className="grid grid-cols-3 overflow-hidden rounded-md border border-border-subtle">
            <StatCell
              label="المجموع الأصلي"
              value={String(row.total)}
              sub={
                <span className="inline-flex items-center gap-1">
                  <span>
                    من <span className={maxChanged ? 'font-en font-semibold text-gold-700' : 'font-en'}>{effMax}</span>
                  </span>
                  {maxChanged && (
                    <span className="rounded-full border border-gold-200 bg-gold-50 px-1.5 text-2xs font-semibold text-gold-700">
                      معدّل
                    </span>
                  )}
                </span>
              }
            />
            <StatCell
              label="مجموع التعديلات الحالية"
              value={(existingAdjSum >= 0 ? '+' : '') + existingAdjSum}
              tone="gold"
              sub={`${existingAdjCount} ${existingAdjCount === 1 ? 'تعديل' : 'تعديلات'} نشطة`}
            />
            <StatCell
              label="المجموع الفعلي"
              value={String(liveExistingEff)}
              tone="ink-strong"
              sub={
                <span>
                  (<span className="font-en">{liveExistingEffPct.toFixed(2)}٪</span>)
                  {maxChanged && <span className="ms-1 text-2xs text-gold-700">· بعد التعديل</span>}
                </span>
              }
            />
          </div>

          {totalExceedsMax && (
            <ErrorBanner>
              المجموع الحالي (<span className="font-en">{row.total}</span>) يتجاوز الدرجة العظمى الجديدة (<span className="font-en">{effMax}</span>). عدّل الدرجة العظمى أو إلغِ التغيير.
            </ErrorBanner>
          )}
          {!totalExceedsMax && existingPushesPastMax && (
            <ErrorBanner>
              التعديلات النشطة تدفع المجموع الفعلي (<span className="font-en">{row.total + existingAdjSum}</span>) فوق الدرجة العظمى الجديدة (<span className="font-en">{effMax}</span>). أوقف تعديلات معارضة أو ارفع الدرجة العظمى.
            </ErrorBanner>
          )}

          {/* Section A — student max override */}
          <section
            className={`flex flex-col gap-2.5 rounded-md border border-s-[3px] p-4 ${
              maxChanged
                ? 'border-gold-200 border-s-gold-500 bg-gold-50'
                : 'border-border-subtle border-s-ink-300 bg-ink-50'
            }`}
          >
            <header className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2">
                <span
                  className={`inline-grid h-6 w-6 place-items-center rounded-sm border bg-white ${
                    maxChanged ? 'border-gold-300 text-gold-700' : 'border-border-default text-ink-700'
                  }`}
                >
                  <Pencil size={12} />
                </span>
                <span className="text-sm font-bold text-ink-900">الدرجة العظمى للطالب</span>
                {maxChanged && (
                  <span className="rounded-full border border-gold-300 bg-white px-2 text-2xs font-semibold text-gold-700">
                    معدّل
                  </span>
                )}
              </div>
              <span className="text-2xs text-ink-500">
                الأصلي عند الاستيراد:{' '}
                <strong className="font-en text-ink-700">{importMax}</strong>
              </span>
            </header>

            <p className="m-0 text-2xs leading-relaxed text-ink-500">
              تخصيص الحد الأقصى لهذا الطالب فقط — لا يؤثر على باقي الدفعة. النسب في البطاقات أعلاه
              تُحتسب على القيمة هنا.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <NumberField
                value={maxRaw}
                onChange={setMaxRaw}
                width={150}
                suffix="درجة"
                invalid={!maxValid || totalExceedsMax}
                ariaLabel="الدرجة العظمى للطالب"
              />
              {maxChanged && (
                <button
                  type="button"
                  onClick={() => setMaxRaw(String(importMax))}
                  className="cursor-pointer border-0 bg-transparent p-0 text-xs font-semibold text-teal-700 underline"
                >
                  إعادة تعيين إلى <span className="font-en">{importMax}</span>
                </button>
              )}
              {!maxValid && (
                <span className="text-2xs text-terra-700">يجب أن تكون أكبر من صفر</span>
              )}
            </div>
          </section>

          {/* Section B — adjustment */}
          <h3 className="m-0 flex items-center gap-2 text-2xs font-bold uppercase tracking-wider text-ink-500">
            <span className="h-px flex-1 bg-border-subtle" />
            <span>إضافة تعديل على الدرجة</span>
            <span className="h-px flex-1 bg-border-subtle" />
          </h3>

          <Field label="سبب التعديل" required>
            <div className="flex flex-wrap gap-1.5">
              {REASONS.map(({ v, label }) => {
                const active = reason === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setReason(v)}
                    className={`cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-focus-teal'
                        : 'border-border-default bg-white text-ink-700 hover:bg-ink-50'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field
            label={
              <span className="inline-flex items-center gap-2">
                <span>السبب التفصيلي</span>
                {noteRequired && <span className="text-terra-500">*</span>}
                {noteRequired && (
                  <span className="rounded-full border border-gold-200 bg-gold-50 px-2 text-2xs font-semibold text-gold-700">
                    مطلوب لأن السبب «أخرى»
                  </span>
                )}
              </span>
            }
            error={noteEmpty ? 'يجب كتابة سبب التعديل' : undefined}
          >
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                noteRequired ? 'اكتب السبب التفصيلي…' : 'اختياري — مطلوب عند اختيار «أخرى»'
              }
              className={`min-h-[84px] w-full resize-y rounded-md border bg-white p-3 text-sm leading-relaxed text-ink-900 outline-none focus-visible:border-teal-500 focus-visible:shadow-focus-teal ${
                noteEmpty
                  ? 'border-terra-500 shadow-focus-terra'
                  : 'border-border-default'
              }`}
            />
          </Field>

          <Field
            label="قيمة التعديل"
            required
            helper="أدخل قيمة موجبة للإضافة، أو سالبة للخصم"
            error={
              overMax ? 'التعديل يتجاوز الدرجة العظمى' : belowZero ? 'التعديل ينزل عن صفر' : undefined
            }
          >
            <div className="flex items-center gap-2.5">
              <div className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => setAmount((a) => a - 1)}
                  className="h-9 w-9 cursor-pointer rounded-s-md border border-e-0 border-border-default bg-white font-en text-md font-semibold text-ink-700 hover:bg-ink-50"
                >
                  −
                </button>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? 0 : Number(e.target.value))}
                  className={`h-9 w-20 border border-border-default bg-white text-center font-en text-md font-semibold outline-none ${
                    amount > 0 ? 'text-success' : amount < 0 ? 'text-terra-700' : 'text-ink-900'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setAmount((a) => a + 1)}
                  className="h-9 w-9 cursor-pointer rounded-e-md border border-s-0 border-border-default bg-white font-en text-md font-semibold text-ink-700 hover:bg-ink-50"
                >
                  +
                </button>
              </div>
              <span className="text-xs text-ink-500">درجة</span>
              <span className="ms-auto inline-flex items-center gap-1.5 text-2xs text-ink-500">
                الفعلي الجديد سيصبح
                <span
                  className={`rounded-full border px-2.5 py-0.5 font-en text-sm font-bold ${
                    overMax || belowZero
                      ? 'border-terra-300 bg-terra-50 text-terra-700'
                      : 'border-gold-200 bg-gold-50 text-gold-700'
                  }`}
                >
                  {newEff} · {newEffPct.toFixed(2)}٪
                </span>
              </span>
            </div>
          </Field>

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-md border border-border-subtle bg-ink-50 px-3.5 py-2.5">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-ink-900">تفعيل التعديل فوراً</span>
              <span className="text-2xs text-ink-500">
                سيُضاف إلى المجموع الفعلي. يمكن إيقافه لاحقاً من السجل.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsActive((v) => !v)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border-default bg-white px-2.5 py-1 text-xs text-ink-800"
              role="switch"
              aria-checked={isActive}
            >
              {isActive ? 'نشط' : 'موقوف'}
              <span
                className={`relative h-[18px] w-8 rounded-full transition-colors ${
                  isActive ? 'bg-teal-500' : 'bg-ink-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-[inset-inline-start] ${
                    isActive ? 'start-4' : 'start-0.5'
                  }`}
                />
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-2xs text-ink-500">
            <Info size={14} aria-hidden />
            سيُسجَّل التعديل باسم{' '}
            <strong className="text-ink-700">{currentUserName}</strong>
            {' · '}
            <span className="font-en">{formatTodayArabic()}</span>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          إلغاء
        </Button>
        <Button
          variant="primary"
          leadingIcon={<Check size={14} />}
          disabled={!canSubmit}
          isLoading={addAdj.isPending || updateOverride.isPending}
          onClick={() => {
            void handleSubmit();
          }}
        >
          حفظ التعديل
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

function StatCell({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  tone?: 'gold' | 'ink-strong';
}): JSX.Element {
  return (
    <div
      className={`flex flex-col gap-0.5 border-s border-border-subtle px-3.5 py-3 first:border-s-0 ${
        tone === 'gold' ? 'bg-gold-50' : 'bg-white'
      }`}
    >
      <span className="text-2xs text-ink-500">{label}</span>
      <span
        className={`font-ar-display font-en text-xl font-bold leading-tight ${
          tone === 'gold' ? 'text-gold-700' : 'text-ink-900'
        }`}
      >
        {value}
      </span>
      {sub && <span className="text-2xs text-ink-500">{sub}</span>}
    </div>
  );
}

function NumberField({
  value,
  onChange,
  width,
  suffix,
  invalid,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  width?: number;
  suffix?: string;
  invalid?: boolean;
  ariaLabel?: string;
}): JSX.Element {
  return (
    <label
      className={`inline-flex h-9 cursor-text items-center gap-2 rounded-md border bg-white px-3 font-ar text-sm font-medium text-ink-900 focus-within:border-teal-500 focus-within:shadow-focus-teal ${
        invalid ? 'border-terra-500 shadow-focus-terra' : 'border-border-default'
      }`}
      style={width ? { width } : undefined}
    >
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="min-w-0 flex-1 border-0 bg-transparent p-0 font-en text-sm font-medium text-ink-900 outline-none"
      />
      {suffix && <span className="text-xs text-ink-500">{suffix}</span>}
    </label>
  );
}

function ErrorBanner({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex items-start gap-2 rounded-md border border-terra-300 border-s-[3px] border-s-terra-500 bg-terra-50 px-3 py-2.5 text-xs leading-relaxed text-terra-700">
      <AlertTriangle size={14} aria-hidden className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function formatTodayArabic(): string {
  const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const d = new Date();
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
