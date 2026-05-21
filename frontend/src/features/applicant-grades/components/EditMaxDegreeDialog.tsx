/**
 * EditMaxDegreeDialog — dedicated overlay for editing the per-student
 * الدرجة العظمى override. Opens above the StudentDetailsDrawer.
 *
 * Validation surfaces three failure modes:
 *   - non-positive → "يجب أن تكون أكبر من صفر"
 *   - total > new max → "المجموع الحالي يتجاوز هذه القيمة"
 *   - active adjustments push past new max → terra conflict block with the
 *     offending entries listed, and a "فتح سجل التعديلات" shortcut.
 */

import { useMemo, useState } from 'react';
import { AlertTriangle, Check, History, Info, Lock } from 'lucide-react';
import { Badge, Button, Field, Modal } from '@/shared/components';
import { useUpdateOverrideMax } from '../api/grades.queries';
import type { DerivedRow } from '../lib/derive';

interface Props {
  open: boolean;
  onClose: () => void;
  row: DerivedRow;
  currentUserName?: string;
}

export function EditMaxDegreeDialog({
  open,
  onClose,
  row,
  currentUserName = 'مرتضى محمود',
}: Props): JSX.Element {
  const importMax = row.importMax;
  const currentMax = row.max;
  const total = row.total;
  const activeAdjustments = useMemo(() => row.log.filter((a) => a.isActive), [row.log]);
  const activeAdjSum = activeAdjustments.reduce((s, x) => s + x.amount, 0);

  const [valueRaw, setValueRaw] = useState<string>(String(currentMax));
  const value = Number(valueRaw);
  const isEmpty = valueRaw === '' || Number.isNaN(value);
  const isNotPositive = !isEmpty && value <= 0;
  const totalExceeds = !isEmpty && !isNotPositive && total > value;
  const projectedEff = total + activeAdjSum;
  const conflictsHigh = !isEmpty && !isNotPositive && activeAdjSum > 0 && projectedEff > value;
  const conflictsLow = !isEmpty && !isNotPositive && activeAdjSum < 0 && projectedEff < 0;
  const hasConflict = conflictsHigh || conflictsLow;
  const isReset = !isEmpty && value === importMax;
  const wasOverridden = row.isOverridden;
  const valid = !isEmpty && !isNotPositive && !totalExceeds && !hasConflict;

  const newPct = !isEmpty && value > 0 ? +((total / value) * 100).toFixed(2) : null;
  const newEff = !isEmpty && value > 0 ? Math.max(0, Math.min(value, total + activeAdjSum)) : null;
  const newEffPct =
    newEff != null && value > 0 ? +((newEff / value) * 100).toFixed(2) : null;

  const updateOverride = useUpdateOverrideMax();

  async function handleSave() {
    if (!valid) return;
    await updateOverride.mutateAsync({
      seat: row.seat,
      overrideMax: isReset ? null : value,
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
      title="تعديل الدرجة العظمى للطالب"
      subtitle={
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-500">
          <span>{row.name}</span>
          <span>·</span>
          <span dir="ltr" className="font-en">{row.nid}</span>
          {wasOverridden && (
            <span className="rounded-full border border-gold-200 bg-gold-50 px-1.5 text-2xs font-semibold text-gold-700">
              معدّل حالياً
            </span>
          )}
        </div>
      }
    >
      <Modal.Body>
        <div className="flex flex-col gap-4">
          {/* Import max — read-only */}
          <div className="flex items-center justify-between rounded-md border border-border-subtle bg-ink-50 px-3.5 py-2.5">
            <div className="flex flex-col">
              <span className="text-2xs text-ink-500">الدرجة العظمى عند الاستيراد</span>
              <span className="text-2xs text-ink-400">قيمة عامة للدفعة — لا تُعدَّل من هنا</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-ar-display font-en text-xl font-bold text-ink-700">
                {importMax}
              </span>
              <Lock size={14} className="text-ink-400" aria-hidden />
            </div>
          </div>

          <Field
            label="الدرجة العظمى لهذا الطالب"
            required
            helper={isReset && wasOverridden ? undefined : 'يطبَّق على هذا الصف فقط'}
            error={
              isNotPositive
                ? 'الدرجة العظمى يجب أن تكون أكبر من صفر'
                : totalExceeds
                  ? `المجموع الحالي (${total}) يتجاوز هذه القيمة`
                  : undefined
            }
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <label
                className={`inline-flex h-9 w-[130px] cursor-text items-center gap-2 rounded-md border bg-white px-3 text-sm font-medium text-ink-900 focus-within:border-teal-500 focus-within:shadow-focus-teal ${
                  isNotPositive || totalExceeds
                    ? 'border-terra-500 shadow-focus-terra'
                    : 'border-border-default'
                }`}
              >
                <input
                  type="number"
                  value={valueRaw}
                  autoFocus
                  onChange={(e) => setValueRaw(e.target.value)}
                  className="min-w-0 flex-1 border-0 bg-transparent p-0 font-en text-sm font-medium text-ink-900 outline-none"
                />
                <span className="text-xs text-ink-500">درجة</span>
              </label>
              {wasOverridden && !isReset && (
                <button
                  type="button"
                  onClick={() => setValueRaw(String(importMax))}
                  className="cursor-pointer border-0 bg-transparent p-0 text-xs font-semibold text-teal-700 underline"
                >
                  إعادة تعيين إلى الأصلي
                </button>
              )}
            </div>
          </Field>

          {/* Reset banner */}
          {isReset && wasOverridden && (
            <div className="flex items-start gap-2 rounded-md border border-gold-200 bg-gold-50 px-3 py-2.5 text-xs text-gold-700">
              <Info size={14} aria-hidden className="mt-0.5 shrink-0" />
              <span>
                ستلغى القيمة المعدّلة وتعود الدرجة العظمى إلى{' '}
                <span className="font-en font-semibold">{importMax}</span> (القيمة الأصلية).
              </span>
            </div>
          )}

          {/* Live preview */}
          {!isEmpty && !isNotPositive && !totalExceeds && (
            <div className="overflow-hidden rounded-md border border-border-subtle bg-white">
              <header className="flex items-center justify-between border-b border-border-subtle bg-ink-50 px-3 py-2 text-2xs font-bold uppercase tracking-wider text-ink-500">
                <span>معاينة الاحتساب</span>
                <span className="flex gap-4 text-2xs font-normal normal-case tracking-normal">
                  <span>الحالي</span>
                  <span>الجديد</span>
                </span>
              </header>
              <PreviewRow
                label="النسبة"
                oldValue={`${row.pct.toFixed(2)}٪`}
                newValue={`${newPct?.toFixed(2)}٪`}
                changed={newPct !== row.pct}
              />
              <PreviewRow
                label="المجموع بعد التعديل"
                oldValue={String(row.eff)}
                newValue={String(newEff)}
                changed={newEff !== row.eff}
              />
              <PreviewRow
                label="نسبة بعد التعديل"
                oldValue={`${row.effPct.toFixed(2)}٪`}
                newValue={`${newEffPct?.toFixed(2)}٪`}
                changed={newEffPct !== row.effPct}
                last
              />
            </div>
          )}

          {/* Adjustment conflict */}
          {hasConflict && (
            <div className="flex items-start gap-2.5 rounded-md border border-terra-300 border-s-[3px] border-s-terra-500 bg-terra-50 p-3.5">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-terra-700" aria-hidden />
              <div className="flex-1 text-xs leading-relaxed text-terra-700">
                <div className="mb-1 font-bold">
                  <span className="font-en">{activeAdjustments.length}</span> تعديل نشط يتعارض
                  مع الدرجة العظمى الجديدة
                </div>
                <div>
                  المجموع <span className="font-en">{total}</span> + التعديلات النشطة
                  (<span className="font-en">{activeAdjSum >= 0 ? '+' : ''}{activeAdjSum}</span>) ={' '}
                  <span className="font-en">{projectedEff}</span>
                  {conflictsHigh ? ` يتجاوز ${value}` : ' ينزل عن صفر'}.
                </div>
                <div className="mt-1 text-2xs text-terra-600">
                  أوقف التعديل/التعديلات المتعارضة من سجل التعديلات أولاً ثم أعد المحاولة.
                </div>
                <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
                  {activeAdjustments.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center gap-1.5 rounded-sm border border-terra-200 bg-white px-2 py-1"
                    >
                      <Badge tone={a.amount > 0 ? 'warning' : 'danger'}>{a.reasonLabel}</Badge>
                      <span
                        className={`font-en font-semibold ${
                          a.amount > 0 ? 'text-gold-700' : 'text-terra-700'
                        }`}
                      >
                        {a.amount > 0 ? '+' : '−'}
                        {Math.abs(a.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-sm border border-terra-300 bg-white px-2.5 py-1 text-2xs font-semibold text-terra-700"
                >
                  <History size={14} aria-hidden /> فتح سجل التعديلات
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>
          إلغاء
        </Button>
        <Button
          variant="primary"
          leadingIcon={<Check size={14} />}
          disabled={!valid}
          isLoading={updateOverride.isPending}
          onClick={() => {
            void handleSave();
          }}
        >
          {isReset && wasOverridden ? 'إلغاء التعديل' : 'حفظ'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

function PreviewRow({
  label,
  oldValue,
  newValue,
  changed,
  last,
}: {
  label: string;
  oldValue: string;
  newValue: string | undefined;
  changed: boolean;
  last?: boolean;
}): JSX.Element {
  return (
    <div
      className={`grid items-center gap-3 px-3.5 py-2 text-xs ${
        last ? '' : 'border-b border-border-subtle'
      }`}
      style={{ gridTemplateColumns: '1fr auto auto' }}
    >
      <span className="font-medium text-ink-600">{label}</span>
      <span
        className={`min-w-[64px] text-end font-en text-ink-500 ${changed ? 'line-through' : ''}`}
      >
        {oldValue}
      </span>
      <span
        className={`min-w-[64px] rounded-full text-end font-en ${
          changed
            ? 'border border-gold-200 bg-gold-50 px-2 py-px font-bold text-gold-700'
            : 'border border-transparent font-medium text-ink-500'
        }`}
      >
        {newValue}
      </span>
    </div>
  );
}
