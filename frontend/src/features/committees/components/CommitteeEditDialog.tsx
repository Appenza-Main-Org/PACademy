/**
 * CommitteeEditDialog — shared inline-edit surface for the four fields
 * that drive `formatCommitteeGrade` + the capacity column:
 *
 *   - capacity (1..999)
 *   - score-mode  → gradeMin / gradeMax as 0..100 numeric inputs
 *   - tier-mode   → gradeMin / gradeMax as Select<GRADE_TIERS>
 *
 * Validation is `min ≤ max` locally; the service round-trips the
 * mutation with optimistic cache writes via `useCommitteeUpdate`.
 * Conflict codes from the service (CAPACITY_NOT_POSITIVE,
 * GRADE_RANGE_INVERTED, COMMITTEE_AT_CAPACITY) surface as Arabic
 * toasts.
 *
 * Opened from:
 *   - the list page's row "تعديل اللجنة" icon button
 *   - the detail page's "تعديل" button
 *
 * Shared single source of truth keeps the two surfaces in lockstep.
 */

import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  Field,
  Input,
  Select,
  toast,
} from '@/shared/components';
import { isConflictError } from '@/shared/lib/errors';
import {
  GRADE_TIERS,
  type Committee,
} from '@/shared/types/domain';
import { useCommitteeUpdate } from '../api/committee.queries';

interface CommitteeEditDialogProps {
  committee: Committee | null;
  onClose: () => void;
}

const CAPACITY_MIN = 1;
const CAPACITY_MAX = 999;

const TIER_OPTIONS = GRADE_TIERS.map((label, idx) => ({
  value: String(idx),
  label,
}));

export function CommitteeEditDialog({
  committee,
  onClose,
}: CommitteeEditDialogProps): JSX.Element {
  const open = committee !== null;
  const updateMut = useCommitteeUpdate();

  const [capacityStr, setCapacityStr] = useState('');
  const [gradeMinStr, setGradeMinStr] = useState('');
  const [gradeMaxStr, setGradeMaxStr] = useState('');
  const [errors, setErrors] = useState<{
    capacity?: string;
    gradeMin?: string;
    gradeMax?: string;
  }>({});

  useEffect(() => {
    if (!committee) return;
    setCapacityStr(String(committee.capacity));
    setGradeMinStr(String(committee.gradeMin));
    setGradeMaxStr(String(committee.gradeMax));
    setErrors({});
  }, [committee]);

  if (!committee) {
    return <Dialog open={false} onOpenChange={() => onClose()} title="" children={null} />;
  }

  const isScore = committee.gradeType === 'score';
  const isPending = updateMut.isPending;

  const handleSave = async (): Promise<void> => {
    const capacity = Number(capacityStr);
    const gradeMin = Number(gradeMinStr);
    const gradeMax = Number(gradeMaxStr);

    const nextErrors: typeof errors = {};
    if (!Number.isInteger(capacity) || capacity < CAPACITY_MIN || capacity > CAPACITY_MAX) {
      nextErrors.capacity = `السعة يجب أن تكون عدداً صحيحاً بين ${CAPACITY_MIN} و ${CAPACITY_MAX}`;
    }
    if (isScore) {
      if (!Number.isFinite(gradeMin) || gradeMin < 0 || gradeMin > 100) {
        nextErrors.gradeMin = 'الدرجة يجب أن تكون بين 0 و 100';
      }
      if (!Number.isFinite(gradeMax) || gradeMax < 0 || gradeMax > 100) {
        nextErrors.gradeMax = 'الدرجة يجب أن تكون بين 0 و 100';
      }
    } else {
      if (!Number.isInteger(gradeMin) || gradeMin < 0 || gradeMin >= GRADE_TIERS.length) {
        nextErrors.gradeMin = 'اختر تقديراً صالحاً';
      }
      if (!Number.isInteger(gradeMax) || gradeMax < 0 || gradeMax >= GRADE_TIERS.length) {
        nextErrors.gradeMax = 'اختر تقديراً صالحاً';
      }
    }
    if (
      nextErrors.gradeMin === undefined &&
      nextErrors.gradeMax === undefined &&
      gradeMin > gradeMax
    ) {
      nextErrors.gradeMax = 'الحد الأدنى يجب أن يكون أقل من أو يساوي الحد الأقصى';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});

    try {
      await updateMut.mutateAsync({
        id: committee.id,
        patch: { capacity, gradeMin, gradeMax },
      });
      toast('تم تحديث اللجنة', 'success');
      onClose();
    } catch (err) {
      if (isConflictError(err)) {
        toast(err.message, 'danger');
      } else {
        toast('تعذّر تحديث اللجنة', 'danger');
      }
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={`تعديل: ${committee.name}`}
      description={
        isScore
          ? 'عدّل السعة ونطاق الدرجة المئوية (0–100%).'
          : 'عدّل السعة ونطاق التقدير من سلم التقدير الأكاديمي.'
      }
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            إلغاء
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={isPending}
            isLoading={isPending}
          >
            حفظ
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 py-1">
        <Input
          type="number"
          inputMode="numeric"
          label="السعة"
          required
          min={CAPACITY_MIN}
          max={CAPACITY_MAX}
          step={1}
          value={capacityStr}
          onChange={(e) => setCapacityStr(e.target.value)}
          error={errors.capacity}
        />

        {isScore ? (
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              inputMode="decimal"
              label="الحد الأدنى للدرجة %"
              required
              min={0}
              max={100}
              step={0.01}
              value={gradeMinStr}
              onChange={(e) => setGradeMinStr(e.target.value)}
              error={errors.gradeMin}
              trailingIcon={<span className="text-2xs text-ink-500">%</span>}
            />
            <Input
              type="number"
              inputMode="decimal"
              label="الحد الأقصى للدرجة %"
              required
              min={0}
              max={100}
              step={0.01}
              value={gradeMaxStr}
              onChange={(e) => setGradeMaxStr(e.target.value)}
              error={errors.gradeMax}
              trailingIcon={<span className="text-2xs text-ink-500">%</span>}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="الحد الأدنى للتقدير" required error={errors.gradeMin}>
              <Select
                value={gradeMinStr}
                onChange={(e) => setGradeMinStr(e.target.value)}
                options={TIER_OPTIONS}
              />
            </Field>
            <Field label="الحد الأقصى للتقدير" required error={errors.gradeMax}>
              <Select
                value={gradeMaxStr}
                onChange={(e) => setGradeMaxStr(e.target.value)}
                options={TIER_OPTIONS}
              />
            </Field>
          </div>
        )}
      </div>
    </Dialog>
  );
}
