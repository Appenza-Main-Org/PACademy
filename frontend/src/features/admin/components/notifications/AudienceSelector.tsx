/**
 * AudienceSelector — Gap L (admin-gaps).
 *
 * Discriminated UI by audience.type:
 *   - general: no further input
 *   - student: national-id input
 *   - department / category / committee: multi-select against lookups
 */

import { Input, Select } from '@/shared/components';
import type {
  AudienceSelector as AudienceSelectorValue,
  ApplicantCategoryKey,
} from '@/shared/types/domain';
import { useLookupList } from '@/features/lookups';

const AUDIENCE_TYPES: AudienceSelectorValue['type'][] = [
  'general',
  'student',
  'category',
  'committee',
  'department',
];

const TYPE_LABEL_AR: Record<AudienceSelectorValue['type'], string> = {
  general: 'عام (كل المتقدمين)',
  student: 'متقدم محدد',
  category: 'فئة قبول',
  committee: 'لجنة',
  department: 'قسم',
};

export interface AudienceSelectorProps {
  value: AudienceSelectorValue;
  onChange: (next: AudienceSelectorValue) => void;
}

export function AudienceSelector({ value, onChange }: AudienceSelectorProps): JSX.Element {
  const departmentsQuery = useLookupList({ typeCode: 'NOTIFICATION_DEPARTMENTS', pageSize: 100 });
  const committeeTypesQuery = useLookupList({ typeCode: 'COMMITTEE_TYPES', pageSize: 100 });

  const setType = (type: AudienceSelectorValue['type']): void => {
    if (type === 'general') onChange({ type: 'general' });
    else if (type === 'student') onChange({ type: 'student', nationalId: '' });
    else if (type === 'department') onChange({ type: 'department', departmentIds: [] });
    else if (type === 'category') onChange({ type: 'category', categoryKeys: [] });
    else onChange({ type: 'committee', committeeIds: [] });
  };

  return (
    <div className="flex flex-col gap-3">
      <Select
        label="جمهور الإشعار"
        value={value.type}
        onChange={(e) => setType(e.target.value as AudienceSelectorValue['type'])}
        options={AUDIENCE_TYPES.map((t) => ({ value: t, label: TYPE_LABEL_AR[t] }))}
      />
      {value.type === 'student' && (
        <Input
          label="الرقم القومي للمتقدم"
          dir="ltr"
          maxLength={14}
          required
          value={value.nationalId}
          onChange={(e) => onChange({ type: 'student', nationalId: e.target.value })}
          placeholder="14 رقماً"
        />
      )}
      {value.type === 'category' && (
        <ChipsList
          label="الفئات"
          options={[
            { value: 'officers_general', label: 'الضباط العام' },
            { value: 'officers_specialized', label: 'الضباط المتخصصون' },
            { value: 'postgraduate', label: 'الدراسات العليا' },
            { value: 'institute_officers_training', label: 'تأهيل ضباط' },
            { value: 'institute_traffic', label: 'معهد المرور' },
            { value: 'institute_guarding', label: 'معهد الحراسات' },
            { value: 'special_units', label: 'الوحدات الخاصة' },
          ]}
          selected={value.categoryKeys}
          onToggle={(v) => {
            const cur = value.categoryKeys;
            const next = cur.includes(v as ApplicantCategoryKey)
              ? cur.filter((k) => k !== v)
              : [...cur, v as ApplicantCategoryKey];
            onChange({ type: 'category', categoryKeys: next });
          }}
        />
      )}
      {value.type === 'department' && (
        <ChipsList
          label="الأقسام"
          options={(departmentsQuery.data?.data ?? []).filter((r) => r.isActive).map((r) => ({ value: r.code, label: r.nameAr }))}
          selected={value.departmentIds}
          onToggle={(v) => {
            const cur = value.departmentIds;
            const next = cur.includes(v) ? cur.filter((k) => k !== v) : [...cur, v];
            onChange({ type: 'department', departmentIds: next });
          }}
        />
      )}
      {value.type === 'committee' && (
        <ChipsList
          label="اللجان"
          options={(committeeTypesQuery.data?.data ?? []).filter((r) => r.isActive).map((r) => ({ value: r.code, label: r.nameAr }))}
          selected={value.committeeIds}
          onToggle={(v) => {
            const cur = value.committeeIds;
            const next = cur.includes(v) ? cur.filter((k) => k !== v) : [...cur, v];
            onChange({ type: 'committee', committeeIds: next });
          }}
        />
      )}
      {value.type === 'general' && (
        <p className="rounded-md border border-border-subtle bg-ink-50 px-3 py-2 text-2xs text-ink-500">
          الإشعار سيظهر لجميع المتقدمين النشطين في الدورة.
        </p>
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
