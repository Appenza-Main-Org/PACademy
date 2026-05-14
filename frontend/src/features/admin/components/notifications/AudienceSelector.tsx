/**
 * AudienceSelector — Gap L (admin-gaps).
 *
 * Multi-audience editor. The top control is a MultiSelect over the five
 * audience kinds (`general` / `student` / `category` / `committee` /
 * `department`). For each selected kind we render its own sub-form;
 * matching at delivery time is OR semantics — the notification reaches
 * an applicant if ANY entry in the array matches.
 */

import { useMemo } from 'react';
import { Input, MultiSelect } from '@/shared/components';
import type {
  AudienceSelector as AudienceSelectorValue,
  ApplicantCategoryKey,
} from '@/shared/types/domain';
import { useLookup } from '@/features/lookups';

type AudienceKind = AudienceSelectorValue['type'];

/* Notification departments are organizational, not admin-managed lookups —
 * hard-coded inline so the admin UI doesn't depend on a removed lookup. */
const DEPARTMENT_OPTIONS = [
  { value: 'admissions',     label: 'إدارة القبول'      },
  { value: 'investigations', label: 'إدارة التحريات'   },
  { value: 'medical',        label: 'القومسيون الطبي'  },
  { value: 'exams',          label: 'إدارة الاختبارات' },
  { value: 'finance',        label: 'الإدارة المالية'  },
  { value: 'it',             label: 'إدارة التكنولوجيا' },
] as const;

const AUDIENCE_KINDS: AudienceKind[] = [
  'general',
  'student',
  'category',
  'committee',
  'department',
];

const KIND_LABEL_AR: Record<AudienceKind, string> = {
  general: 'عام (كل المتقدمين)',
  student: 'متقدم محدد',
  category: 'فئة قبول',
  committee: 'لجنة',
  department: 'قسم',
};

/** Empty payload for each kind — used when the kind is first added. */
function freshAudience(kind: AudienceKind): AudienceSelectorValue {
  switch (kind) {
    case 'general':
      return { type: 'general' };
    case 'student':
      return { type: 'student', nationalId: '' };
    case 'category':
      return { type: 'category', categoryKeys: [] };
    case 'committee':
      return { type: 'committee', committeeIds: [] };
    case 'department':
      return { type: 'department', departmentIds: [] };
  }
}

export interface AudienceSelectorProps {
  value: AudienceSelectorValue[];
  onChange: (next: AudienceSelectorValue[]) => void;
}

export function AudienceSelector({ value, onChange }: AudienceSelectorProps): JSX.Element {
  const committeesQuery = useLookup('committees');
  const categoriesQuery = useLookup('applicant-categories');
  const categoryOptions = (categoriesQuery.data ?? []).map((c) => ({
    value: c.code,
    label: c.name,
  }));

  const selectedKinds = useMemo<AudienceKind[]>(
    () => value.map((a) => a.type),
    [value],
  );

  const handleKindsChange = (next: string[]): void => {
    const nextKinds = next.filter((k): k is AudienceKind =>
      (AUDIENCE_KINDS as string[]).includes(k),
    );
    /* Preserve the existing payload for each kind that survives.
     * Add a fresh payload for any kind newly picked. */
    const byKind = new Map<AudienceKind, AudienceSelectorValue>();
    for (const a of value) byKind.set(a.type, a);
    const result = nextKinds.map((k) => byKind.get(k) ?? freshAudience(k));
    onChange(result);
  };

  const patch = (kind: AudienceKind, next: AudienceSelectorValue): void => {
    onChange(value.map((a) => (a.type === kind ? next : a)));
  };

  const has = (kind: AudienceKind): boolean => selectedKinds.includes(kind);
  const get = <K extends AudienceKind>(kind: K): Extract<AudienceSelectorValue, { type: K }> | undefined =>
    value.find((a) => a.type === kind) as Extract<AudienceSelectorValue, { type: K }> | undefined;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-1 text-sm font-medium text-ink-700">جمهور الإشعار</p>
        <MultiSelect
          ariaLabel="جمهور الإشعار"
          options={AUDIENCE_KINDS.map((k) => ({ value: k, label: KIND_LABEL_AR[k] }))}
          value={selectedKinds}
          onChange={handleKindsChange}
          placeholder="اختر جمهوراً أو أكثر…"
        />
      </div>

      {has('general') && (
        <p className="rounded-md border border-border-subtle bg-ink-50 px-3 py-2 text-2xs text-ink-500">
          الإشعار سيظهر لجميع المتقدمين النشطين في الدورة.
        </p>
      )}

      {has('student') && (
        <Input
          label="الرقم القومي للمتقدم"
          dir="ltr"
          maxLength={14}
          required
          value={get('student')?.nationalId ?? ''}
          onChange={(e) =>
            patch('student', { type: 'student', nationalId: e.target.value })
          }
          placeholder="14 رقماً"
        />
      )}

      {has('category') && (
        <ChipsList
          label="الفئات"
          options={categoryOptions}
          selected={get('category')?.categoryKeys ?? []}
          onToggle={(v) => {
            const cur = get('category')?.categoryKeys ?? [];
            const next = cur.includes(v as ApplicantCategoryKey)
              ? cur.filter((k) => k !== v)
              : [...cur, v as ApplicantCategoryKey];
            patch('category', { type: 'category', categoryKeys: next });
          }}
        />
      )}

      {has('committee') && (
        <ChipsList
          label="اللجان"
          options={(committeesQuery.data ?? [])
            .filter((r) => r.isActive)
            .map((r) => ({ value: r.code, label: r.name }))}
          selected={get('committee')?.committeeIds ?? []}
          onToggle={(v) => {
            const cur = get('committee')?.committeeIds ?? [];
            const next = cur.includes(v) ? cur.filter((k) => k !== v) : [...cur, v];
            patch('committee', { type: 'committee', committeeIds: next });
          }}
        />
      )}

      {has('department') && (
        <ChipsList
          label="الأقسام"
          options={DEPARTMENT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          selected={get('department')?.departmentIds ?? []}
          onToggle={(v) => {
            const cur = get('department')?.departmentIds ?? [];
            const next = cur.includes(v) ? cur.filter((k) => k !== v) : [...cur, v];
            patch('department', { type: 'department', departmentIds: next });
          }}
        />
      )}
    </div>
  );
}

function ChipsList({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (v: string) => void;
}): JSX.Element {
  return (
    <div>
      <p className="mb-1 text-2xs uppercase tracking-wide text-ink-500">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const isOn = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onToggle(opt.value)}
              className={
                'rounded-pill border px-3 py-1 text-2xs transition-colors duration-fast ease-standard ' +
                (isOn
                  ? 'border-teal-500 bg-teal-50 text-teal-700'
                  : 'border-border-default bg-surface-card text-ink-700 hover:bg-ink-50')
              }
            >
              {opt.label}
            </button>
          );
        })}
        {options.length === 0 && <span className="text-2xs text-ink-500">لا توجد خيارات نشطة.</span>}
      </div>
    </div>
  );
}
