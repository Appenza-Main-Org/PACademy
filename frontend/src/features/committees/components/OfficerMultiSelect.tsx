/**
 * OfficerMultiSelect — Gap H (admin-gaps).
 *
 * Multi-select bound to the eligible-officers query (system users with
 * `committee_admin` or `committee_user` role only). Uses the shared
 * MultiSelect primitive so picker chrome matches the rest of the admin.
 */

import { MultiSelect } from '@/shared/components';
import { useEligibleOfficers } from '../api/committee.queries';

export interface OfficerMultiSelectProps {
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
  required?: boolean;
}

export function OfficerMultiSelect({
  value,
  onChange,
  label = 'الضباط المسؤولون',
  required,
}: OfficerMultiSelectProps): JSX.Element {
  const { data: officers = [] } = useEligibleOfficers();
  return (
    <MultiSelect
      label={label}
      required={required}
      value={value}
      onChange={onChange}
      options={officers.map((o) => ({
        value: o.id,
        label: o.name,
      }))}
      placeholder="اختر الضباط من قائمة الموظفين بصلاحية اللجنة"
    />
  );
}
