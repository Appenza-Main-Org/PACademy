/**
 * Special wide-table panels — نموذج 29 (foreign employed), نموذج 30
 * (naturalized), نموذج 31 (criminal cases). They share the same UX:
 * a «لا يوجد» toggle, an «إضافة سجل» button, and a tabular row layout
 * with one column per field. Kept separate from `RelativesListPanel`
 * because the field sets differ enough that conditional rendering
 * inside the generic panel would be uglier than a small dedicated
 * component.
 */

import { Plus, Trash2 } from 'lucide-react';
import type {
  CriminalCaseList,
  CriminalCaseRecord,
  ForeignEmployedList,
  ForeignEmployedRelativeRecord,
  NaturalizedList,
  NaturalizedRelativeRecord,
} from '../../lib/vothiqaTaaruf.types';
import {
  emptyCriminalCase,
  emptyForeignEmployed,
  emptyNaturalized,
} from '../../lib/vothiqaTaaruf.types';

const inputCls =
  'h-9 w-full rounded-md border border-border-default bg-surface-card px-2 text-2xs text-ink-900 outline-none transition-colors focus:border-teal-500 focus:shadow-focus-teal disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-500';

interface SharedHeaderProps {
  formNumber: string;
  title: string;
  hint?: string;
  none: boolean;
  setNone: (v: boolean) => void;
  onAdd: () => void;
  readOnly?: boolean;
  addLabel: string;
}

function PanelHeader({
  formNumber,
  title,
  hint,
  none,
  setNone,
  onAdd,
  readOnly,
  addLabel,
}: SharedHeaderProps): JSX.Element {
  return (
    <header className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle pb-3">
      <div className="flex items-start gap-3">
        <span className="inline-flex shrink-0 items-center rounded-md bg-teal-50 px-2 py-1 text-2xs font-bold text-teal-700">
          {formNumber}
        </span>
        <div>
          <h4 className="font-ar-display text-md font-bold text-ink-900">{title}</h4>
          {hint && <p className="mt-0.5 text-2xs text-ink-500 leading-relaxed">{hint}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border-default bg-surface-page px-3 py-1.5 text-2xs font-medium text-ink-700 hover:bg-ink-50">
          <input
            type="checkbox"
            checked={none}
            onChange={(e) => setNone(e.target.checked)}
            disabled={readOnly}
            className="h-3.5 w-3.5 accent-teal-600"
          />
          <span>لا يوجد</span>
        </label>
        {!none && (
          <button
            type="button"
            onClick={onAdd}
            disabled={readOnly}
            className="inline-flex items-center gap-1.5 rounded-md bg-teal-500 px-3 py-1.5 text-2xs font-medium text-white shadow-sm hover:bg-teal-600 disabled:cursor-not-allowed disabled:bg-ink-300"
          >
            <Plus size={12} strokeWidth={2} />
            {addLabel}
          </button>
        )}
      </div>
    </header>
  );
}

/* ── نموذج 29 — Foreign employed ──────────────────────────────────── */

interface ForeignEmployedTableProps {
  value: ForeignEmployedList;
  onChange: (next: ForeignEmployedList) => void;
  readOnly?: boolean;
}

export function ForeignEmployedTable({
  value,
  onChange,
  readOnly,
}: ForeignEmployedTableProps): JSX.Element {
  const setNone = (n: boolean): void =>
    onChange({ none: n, items: n ? [] : value.items });
  const add = (): void =>
    onChange({ none: false, items: [...value.items, emptyForeignEmployed()] });
  const remove = (i: number): void =>
    onChange({ none: false, items: value.items.filter((_, idx) => idx !== i) });
  const update = (i: number, patch: Partial<ForeignEmployedRelativeRecord>): void =>
    onChange({
      none: false,
      items: value.items.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    });

  return (
    <section className="rounded-lg border border-border-default bg-surface-card p-4 md:p-5">
      <PanelHeader
        formNumber="نموذج 29"
        title="الأقارب الذين يعملون لدى جهات أجنبية"
        hint="حتى الدرجة الرابعة (نسباً ومصاهرة)"
        none={value.none}
        setNone={setNone}
        onAdd={add}
        readOnly={readOnly}
        addLabel="إضافة سجل"
      />
      {value.none ? (
        <p className="rounded-md bg-ink-50 px-4 py-3 text-2xs text-ink-500">
          أكّدتَ عدم وجود أقارب يعملون لدى جهات أجنبية.
        </p>
      ) : value.items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-default bg-ink-50 px-4 py-3 text-2xs text-ink-500">
          لا توجد سجلات بعد — أضف سجلاً أو علّم «لا يوجد».
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-1 text-2xs">
            <thead>
              <tr className="text-end text-ink-500">
                <th className="px-2 py-1 font-medium">م</th>
                <th className="px-2 py-1 font-medium">الاسم رباعياً</th>
                <th className="px-2 py-1 font-medium">درجة القرابة</th>
                <th className="px-2 py-1 font-medium">تاريخ ومحل الميلاد</th>
                <th className="px-2 py-1 font-medium">المهنة والمؤهل</th>
                <th className="px-2 py-1 font-medium">الهيئة الأجنبية أو المنظمة الدولية</th>
                <th className="px-2 py-1 font-medium">محل الإقامة تفصيلاً</th>
                <th className="px-2 py-1 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {value.items.map((row, i) => (
                <tr key={i}>
                  <td className="px-2 py-1 text-ink-700">{i + 1}</td>
                  <td className="px-2"><input className={inputCls} value={row.fullNameQuad} onChange={(e) => update(i, { fullNameQuad: e.target.value })} disabled={readOnly} /></td>
                  <td className="px-2"><input className={inputCls} value={row.kinship} onChange={(e) => update(i, { kinship: e.target.value })} disabled={readOnly} /></td>
                  <td className="px-2"><input className={inputCls} value={row.dobAndPlace} onChange={(e) => update(i, { dobAndPlace: e.target.value })} disabled={readOnly} /></td>
                  <td className="px-2"><input className={inputCls} value={row.professionAndQualification} onChange={(e) => update(i, { professionAndQualification: e.target.value })} disabled={readOnly} /></td>
                  <td className="px-2"><input className={inputCls} value={row.foreignEntity} onChange={(e) => update(i, { foreignEntity: e.target.value })} disabled={readOnly} /></td>
                  <td className="px-2"><input className={inputCls} value={row.residence} onChange={(e) => update(i, { residence: e.target.value })} disabled={readOnly} /></td>
                  <td className="px-2 py-1">
                    {!readOnly && (
                      <button
                        type="button"
                        aria-label="حذف"
                        onClick={() => remove(i)}
                        className="rounded-md border border-terra-300 p-1 text-terra-700 hover:bg-terra-50"
                      >
                        <Trash2 size={12} strokeWidth={1.75} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ── نموذج 30 — Naturalized ───────────────────────────────────────── */

interface NaturalizedTableProps {
  value: NaturalizedList;
  onChange: (next: NaturalizedList) => void;
  readOnly?: boolean;
}

export function NaturalizedTable({
  value,
  onChange,
  readOnly,
}: NaturalizedTableProps): JSX.Element {
  const setNone = (n: boolean): void =>
    onChange({ none: n, items: n ? [] : value.items });
  const add = (): void =>
    onChange({ none: false, items: [...value.items, emptyNaturalized()] });
  const remove = (i: number): void =>
    onChange({ none: false, items: value.items.filter((_, idx) => idx !== i) });
  const update = (i: number, patch: Partial<NaturalizedRelativeRecord>): void =>
    onChange({
      none: false,
      items: value.items.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    });

  return (
    <section className="rounded-lg border border-border-default bg-surface-card p-4 md:p-5">
      <PanelHeader
        formNumber="نموذج 30"
        title="الأقارب المتجنسين بغير الجنسية المصرية"
        hint="حتى الدرجة الرابعة (نسباً ومصاهرة)"
        none={value.none}
        setNone={setNone}
        onAdd={add}
        readOnly={readOnly}
        addLabel="إضافة سجل"
      />
      {value.none ? (
        <p className="rounded-md bg-ink-50 px-4 py-3 text-2xs text-ink-500">
          أكّدتَ عدم وجود أقارب يحملون جنسية غير مصرية.
        </p>
      ) : value.items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-default bg-ink-50 px-4 py-3 text-2xs text-ink-500">
          لا توجد سجلات بعد — أضف سجلاً أو علّم «لا يوجد».
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-1 text-2xs">
            <thead>
              <tr className="text-end text-ink-500">
                <th className="px-2 py-1 font-medium">م</th>
                <th className="px-2 py-1 font-medium">الاسم رباعياً</th>
                <th className="px-2 py-1 font-medium">درجة القرابة</th>
                <th className="px-2 py-1 font-medium">تاريخ ومحل الميلاد</th>
                <th className="px-2 py-1 font-medium">المهنة والمؤهل</th>
                <th className="px-2 py-1 font-medium">الجنسية المنتسب إليها</th>
                <th className="px-2 py-1 font-medium">محل الإقامة تفصيلاً</th>
                <th className="px-2 py-1 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {value.items.map((row, i) => (
                <tr key={i}>
                  <td className="px-2 py-1 text-ink-700">{i + 1}</td>
                  <td className="px-2"><input className={inputCls} value={row.fullNameQuad} onChange={(e) => update(i, { fullNameQuad: e.target.value })} disabled={readOnly} /></td>
                  <td className="px-2"><input className={inputCls} value={row.kinship} onChange={(e) => update(i, { kinship: e.target.value })} disabled={readOnly} /></td>
                  <td className="px-2"><input className={inputCls} value={row.dobAndPlace} onChange={(e) => update(i, { dobAndPlace: e.target.value })} disabled={readOnly} /></td>
                  <td className="px-2"><input className={inputCls} value={row.professionAndQualification} onChange={(e) => update(i, { professionAndQualification: e.target.value })} disabled={readOnly} /></td>
                  <td className="px-2"><input className={inputCls} value={row.nationality} onChange={(e) => update(i, { nationality: e.target.value })} disabled={readOnly} /></td>
                  <td className="px-2"><input className={inputCls} value={row.residence} onChange={(e) => update(i, { residence: e.target.value })} disabled={readOnly} /></td>
                  <td className="px-2 py-1">
                    {!readOnly && (
                      <button
                        type="button"
                        aria-label="حذف"
                        onClick={() => remove(i)}
                        className="rounded-md border border-terra-300 p-1 text-terra-700 hover:bg-terra-50"
                      >
                        <Trash2 size={12} strokeWidth={1.75} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ── نموذج 31 — Criminal cases ────────────────────────────────────── */

interface CriminalCasesTableProps {
  value: CriminalCaseList;
  onChange: (next: CriminalCaseList) => void;
  readOnly?: boolean;
}

export function CriminalCasesTable({
  value,
  onChange,
  readOnly,
}: CriminalCasesTableProps): JSX.Element {
  const setNone = (n: boolean): void =>
    onChange({ none: n, items: n ? [] : value.items });
  const add = (): void =>
    onChange({ none: false, items: [...value.items, emptyCriminalCase()] });
  const remove = (i: number): void =>
    onChange({ none: false, items: value.items.filter((_, idx) => idx !== i) });
  const update = (i: number, patch: Partial<CriminalCaseRecord>): void =>
    onChange({
      none: false,
      items: value.items.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    });

  return (
    <section className="rounded-lg border border-border-default bg-surface-card p-4 md:p-5">
      <PanelHeader
        formNumber="نموذج 31"
        title="بيان القضايا المتهم فيها الطالب وأقاربه"
        hint="حتى الدرجة الرابعة (نسباً ومصاهرة)"
        none={value.none}
        setNone={setNone}
        onAdd={add}
        readOnly={readOnly}
        addLabel="إضافة قضية"
      />
      {value.none ? (
        <p className="rounded-md bg-ink-50 px-4 py-3 text-2xs text-ink-500">
          أكّدتَ عدم وجود قضايا متهم فيها الطالب أو أيّ من الأقارب.
        </p>
      ) : value.items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-default bg-ink-50 px-4 py-3 text-2xs text-ink-500">
          لا توجد قضايا مسجَّلة بعد — أضف قضية أو علّم «لا يوجد».
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-1 text-2xs">
            <thead>
              <tr className="text-end text-ink-500">
                <th className="px-2 py-1 font-medium">م</th>
                <th className="px-2 py-1 font-medium">الاسم رباعياً</th>
                <th className="px-2 py-1 font-medium">درجة القرابة</th>
                <th className="px-2 py-1 font-medium">رقم القضية ووصفها القانوني</th>
                <th className="px-2 py-1 font-medium">التصرف الجنائي النهائي وتاريخه</th>
                <th className="px-2 py-1 font-medium">الأحكام التي تم تنفيذها وتاريخ التنفيذ</th>
                <th className="px-2 py-1 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {value.items.map((row, i) => (
                <tr key={i}>
                  <td className="px-2 py-1 text-ink-700">{i + 1}</td>
                  <td className="px-2"><input className={inputCls} value={row.fullNameQuad} onChange={(e) => update(i, { fullNameQuad: e.target.value })} disabled={readOnly} /></td>
                  <td className="px-2"><input className={inputCls} value={row.kinship} onChange={(e) => update(i, { kinship: e.target.value })} disabled={readOnly} /></td>
                  <td className="px-2"><input className={inputCls} value={row.caseNumberAndDescription} onChange={(e) => update(i, { caseNumberAndDescription: e.target.value })} disabled={readOnly} /></td>
                  <td className="px-2"><input className={inputCls} value={row.finalDisposition} onChange={(e) => update(i, { finalDisposition: e.target.value })} disabled={readOnly} /></td>
                  <td className="px-2"><input className={inputCls} value={row.executedSentences} onChange={(e) => update(i, { executedSentences: e.target.value })} disabled={readOnly} /></td>
                  <td className="px-2 py-1">
                    {!readOnly && (
                      <button
                        type="button"
                        aria-label="حذف"
                        onClick={() => remove(i)}
                        className="rounded-md border border-terra-300 p-1 text-terra-700 hover:bg-terra-50"
                      >
                        <Trash2 size={12} strokeWidth={1.75} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
