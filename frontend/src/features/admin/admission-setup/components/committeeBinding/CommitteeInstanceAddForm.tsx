/**
 * إضافة موعد اختبار — reusable add form for committee instances.
 *
 * Extracted from `CommitteeBindingsPanel` so the same authoring surface
 * can be mounted on:
 *
 *   1. `/admin/cycles/admission-setup/wizard/committees` — the wizard
 *      step that drives initial authoring during cycle setup.
 *   2. `/admin/committees-exam-config` — the management page, so admins
 *      can add new committee dates without re-entering the wizard once
 *      the cycle is published.
 *
 * Behavior (shared across both surfaces):
 *   - Admin picks one or more active categories, a date, and a capacity.
 *   - The form fans out to every active committee definition in each
 *     picked category and creates one `CommitteeInstance` per
 *     (definition × date).
 *   - If a row already exists at `(cycle × definition × date)`, the
 *     existing capacity is accumulated (`addMany` would 409 otherwise).
 *   - A summary toast reports added + merged counts.
 *
 * The form is intentionally stateless w.r.t. the day-grouped table that
 * sits below it — both surfaces own their own presentation and react to
 * the same `useCommitteeInstances` query.
 */

import { useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import {
  AlertDialog,
  Button,
  Card,
  CardHeader,
  DatePicker,
  Input,
  MultiSelect,
  toast,
} from '@/shared/components';
import type { ComboboxOption } from '@/shared/components';
import { num } from '@/shared/lib/format';
import { useLookup } from '@/features/lookups';
import type { CommitteeDefinition } from '@/features/lookups';
import {
  useAddCommitteeInstancesMutation,
  useCommitteeInstances,
  useUpdateCommitteeInstanceMutation,
} from '@/features/committees';
import type {
  AdmissionCycle,
  CommitteeInstance,
} from '@/shared/types/domain';

export interface CommitteeInstanceAddFormProps {
  cycle: AdmissionCycle;
  active: ReadonlyArray<{ key: string; labelAr: string }>;
}

interface CapacityIncreaseUpdate {
  id: string;
  committeeName: string;
  currentCapacity: number;
  increaseBy: number;
  nextCapacity: number;
}

interface CapacityAddPlan {
  date: string;
  updates: CapacityIncreaseUpdate[];
  inserts: Array<{
    categoryKey: string;
    definitionCode: string;
    date: string;
    capacity: number;
  }>;
}

/* ── Numeric-input guards ────────────────────────────────────────────
 * `type="number"` lets users paste/keystroke `-`, `+`, `e`, `.` and end
 * up with a value the JS layer reads as `NaN` (or worse: a negative).
 * We swap to `type="text"` with `inputMode="numeric"`, sanitize the
 * value on change, and block the offending keystrokes outright. */

const BLOCKED_NUMERIC_KEYS = new Set(['-', '+', 'e', 'E', '.', ',']);

function sanitizeDigits(s: string): string {
  return s.replace(/\D+/g, '');
}

function isBlockedNumericKey(event: KeyboardEvent<HTMLInputElement>): boolean {
  return BLOCKED_NUMERIC_KEYS.has(event.key);
}

function toIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toDateKey(value: string): string {
  return value.slice(0, 10);
}

function instanceKey(input: {
  cycleId: string;
  categoryKey: string;
  definitionCode: string;
  date: string;
}): string {
  return [
    input.cycleId,
    input.categoryKey,
    input.definitionCode,
    toDateKey(input.date),
  ].join('|');
}

/* Friday is the weekly day off — admins shouldn't be able to schedule
 * exam committees on it. `Date.getDay()` returns 5 for Friday. */
function isFriday(d: Date): boolean {
  return d.getDay() === 5;
}

export function CommitteeInstanceAddForm({
  cycle,
  active,
}: CommitteeInstanceAddFormProps): JSX.Element {
  const definitionsQuery = useLookup('committees');
  const allDefinitions = definitionsQuery.data ?? [];

  /* Filter by `isActive` so retired definitions can't be re-assigned, and
   * group by category for the per-(category × definition) fan-out below. */
  const definitionsByCategory = useMemo(() => {
    const map = new Map<string, CommitteeDefinition[]>();
    for (const def of allDefinitions) {
      if (!def.isActive) continue;
      const list = map.get(def.applicantCategoryId);
      if (list) list.push(def);
      else map.set(def.applicantCategoryId, [def]);
    }
    return map;
  }, [allDefinitions]);

  /* Instances scoped to this cycle — the form needs them to partition
   * targets into accumulate-via-update vs. insert. */
  const instancesQuery = useCommitteeInstances({ cycleId: cycle.id });
  const addMut = useAddCommitteeInstancesMutation();
  const updateMut = useUpdateCommitteeInstanceMutation();

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [pickedDate, setPickedDate] = useState<Date | null>(null);
  const [capacityStr, setCapacityStr] = useState<string>('');
  const [pendingPlan, setPendingPlan] = useState<CapacityAddPlan | null>(null);

  const capacityRaw = Number(capacityStr);
  const capacityValid =
    capacityStr.length > 0 &&
    Number.isInteger(capacityRaw) &&
    capacityRaw >= 1;
  const dateValid = pickedDate !== null;
  const categoriesValid = selectedCategories.length >= 1;

  const submitting = addMut.isPending || updateMut.isPending;
  const loading = instancesQuery.isLoading || definitionsQuery.isLoading;

  const canSubmit =
    dateValid && capacityValid && categoriesValid && !submitting && !loading;

  const categoryOptions = useMemo<ComboboxOption[]>(
    () => active.map((a) => ({ value: a.key, label: a.labelAr })),
    [active],
  );

  const formCommitteeCount = useMemo(() => {
    return selectedCategories.reduce((sum, key) => {
      return sum + (definitionsByCategory.get(key)?.length ?? 0);
    }, 0);
  }, [definitionsByCategory, selectedCategories]);

  const executePlan = async (plan: CapacityAddPlan): Promise<void> => {
    try {
      await Promise.all([
        ...plan.updates.map((u) =>
          updateMut.mutateAsync({
            id: u.id,
            patch: { capacity: u.nextCapacity },
          }),
        ),
        plan.inserts.length > 0
          ? addMut.mutateAsync(
              plan.inserts.map((i) => ({
                cycleId: cycle.id,
                categoryKey: i.categoryKey,
                definitionCode: i.definitionCode,
                date: i.date,
                capacity: i.capacity,
              })),
            )
          : Promise.resolve(null),
      ]);
      const added = plan.inserts.length;
      const merged = plan.updates.length;
      const message =
        added > 0 && merged > 0
          ? `تمت إضافة ${num(added)} موعد جديد وزيادة سعة ${num(merged)} موعد قائم`
          : added > 0
            ? `تمت إضافة ${num(added)} موعد`
            : `تمت زيادة سعة ${num(merged)} موعد قائم`;
      toast(message, 'success');
      setPendingPlan(null);
      setSelectedCategories([]);
      setPickedDate(null);
      setCapacityStr('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'تعذّر إضافة المواعيد';
      toast(message, 'danger');
    }
  };

  const buildPlan = (iso: string): CapacityAddPlan => {
    /* Build (category × definition × date) targets for the selected
     * categories. */
    const targets: Array<{
      categoryKey: string;
      definitionCode: string;
      date: string;
      capacity: number;
    }> = [];
    for (const key of selectedCategories) {
      const defs = definitionsByCategory.get(key) ?? [];
      for (const def of defs) {
        targets.push({
          categoryKey: key,
          definitionCode: def.code,
          date: iso,
          capacity: capacityRaw,
        });
      }
    }

    /* Partition: rows already present for the exact
     * (cycle × category × definition × date) accumulate; rows missing are
     * inserted. Keep the cycle/category scope explicit because the API can
     * legally return broader datasets and committee codes are not enough
     * to identify a category-day on their own. */
    const existingByKey = new Map<string, CommitteeInstance>();
    for (const e of instancesQuery.data ?? []) {
      if (e.cycleId !== cycle.id) continue;
      existingByKey.set(instanceKey(e), e);
    }
    const definitionNameByCode = new Map<string, string>();
    for (const def of allDefinitions) definitionNameByCode.set(def.code, def.name);

    const updates: CapacityIncreaseUpdate[] = [];
    const inserts: typeof targets = [];
    for (const t of targets) {
      const existing = existingByKey.get(
        instanceKey({
          cycleId: cycle.id,
          categoryKey: t.categoryKey,
          definitionCode: t.definitionCode,
          date: t.date,
        }),
      );
      if (existing) {
        updates.push({
          id: existing.id,
          committeeName: definitionNameByCode.get(existing.definitionCode) ?? existing.definitionCode,
          currentCapacity: existing.capacity,
          increaseBy: t.capacity,
          nextCapacity: existing.capacity + t.capacity,
        });
      } else {
        inserts.push(t);
      }
    }
    return { date: iso, updates, inserts };
  };

  const handleAdd = async (): Promise<void> => {
    if (!canSubmit || !pickedDate) return;
    const plan = buildPlan(toIsoDate(pickedDate));
    if (plan.updates.length > 0) {
      setPendingPlan(plan);
      return;
    }
    await executePlan(plan);
  };

  return (
    <Card variant="elevated">
      <CardHeader
        title="إضافة موعد اختبار"
        subtitle={
          selectedCategories.length === 0
            ? 'اختر فئة واحدة على الأقل ليتم إنشاء موعد لكل لجنة فيها.'
            : `سيتم إنشاء موعد لكل لجنة في الفئات المحددة (${num(formCommitteeCount)} موعد).`
        }
      />
      {/*
       * 2-row grid keeps the "إضافة" button anchored to the input
       * baseline:
       *  row 1 = labels   ·  row 2 = inputs + button
       * The `auto auto` row track plus `items-end` on row 2
       * gives the button (matching block-size `h-9`) a bottom flush
       * with the inputs.
       */}
      <div className="grid grid-rows-[auto_auto] items-end gap-x-3 gap-y-1 p-4 md:grid-cols-[1fr_1fr_220px_auto]">
        {/* ── row 1: labels ───────────────────────────────────── */}
        <FieldLabel htmlFor="bindings-cats">الفئات</FieldLabel>
        <FieldLabel>اليوم</FieldLabel>
        <FieldLabel htmlFor="bindings-capacity">سعة اللجنة</FieldLabel>
        <span aria-hidden />

        {/* ── row 2: inputs + button ──────────────────────────── */}
        <MultiSelect
          ariaLabel="الفئات"
          options={categoryOptions}
          value={selectedCategories}
          onChange={setSelectedCategories}
          placeholder="اختر فئة أو أكثر…"
          centered
        />
        <DatePicker
          value={pickedDate}
          onChange={setPickedDate}
          placeholder="اختر اليوم…"
          isDateDisabled={isFriday}
        />
        <Input
          id="bindings-capacity"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label="سعة اللجنة"
          value={capacityStr}
          onChange={(e) => setCapacityStr(sanitizeDigits(e.target.value))}
          onKeyDown={(e) => {
            if (isBlockedNumericKey(e)) e.preventDefault();
          }}
          onPaste={(e) => {
            const data = e.clipboardData.getData('text');
            const cleaned = sanitizeDigits(data);
            if (cleaned !== data) {
              e.preventDefault();
              setCapacityStr((prev) => prev + cleaned);
            }
          }}
        />
        <Button
          variant="primary"
          size="md"
          onClick={handleAdd}
          disabled={!canSubmit}
          isLoading={submitting}
          className="self-end"
        >
          إضافة
        </Button>
      </div>
      <AlertDialog
        open={pendingPlan !== null}
        onOpenChange={(next) => {
          if (!next) setPendingPlan(null);
        }}
        title="يوجد موعد اختبار في نفس اليوم"
        description={
          pendingPlan
            ? `تم العثور على ${num(pendingPlan.updates.length)} موعد قائم بتاريخ ${pendingPlan.date}. هل تريد زيادة السعة الحالية لهذه المواعيد، أم إلغاء العملية؟`
            : ''
        }
        actionLabel="زيادة السعة الحالية"
        cancelLabel="إلغاء العملية"
        tone="primary"
        onAction={() => {
          if (pendingPlan) void executePlan(pendingPlan);
        }}
        isActionLoading={submitting}
      >
        {pendingPlan && (
          <ul className="mt-3 max-h-48 overflow-auto rounded-md border border-gold-200 bg-gold-50 p-2 text-2xs text-ink-700">
            {pendingPlan.updates.map((update) => (
              <li
                key={update.id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-0.5"
              >
                <span className="truncate font-medium">{update.committeeName}</span>
                <span className="font-numeric tnum">
                  {num(update.currentCapacity)} + {num(update.increaseBy)} = {num(update.nextCapacity)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </AlertDialog>
    </Card>
  );
}

interface FieldLabelProps {
  htmlFor?: string;
  children: string;
}

function FieldLabel({ htmlFor, children }: FieldLabelProps): JSX.Element {
  return (
    <label
      htmlFor={htmlFor}
      className="text-sm font-medium text-ink-700"
    >
      {children}
      <span className="ms-1 text-terra-500" aria-hidden>
        *
      </span>
    </label>
  );
}
