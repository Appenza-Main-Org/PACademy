/**
 * AttachSpecializationCombobox — inline grouped dropdown that attaches
 * a specialization lookup row to the given category config.
 *
 * Replaces the popup dialog form: the picker is the affordance. Selecting
 * a specialization fires `useAttachSpecialization` and resets the picker
 * for the next add.
 *
 * Options come from `useEligibleSpecializations(configId)` and are
 * grouped by their parent faculty (`facultyCode`). Faculty group order
 * follows the active rows from the `faculties` lookup so a backend-side
 * sort change flows through without touching this file.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button, Combobox, type ComboboxGroup, type ComboboxOption } from '@/shared/components';
import { useLookup } from '@/features/lookups';
import {
  useAttachSpecialization,
  useEligibleSpecializations,
} from '../../api/applicationSettings.queries';

interface AttachSpecializationComboboxProps {
  configId: string;
}

const LOOKUP_MAPPING_URL = '/admin/lookups/applicant-categories';

export function AttachSpecializationCombobox({
  configId,
}: AttachSpecializationComboboxProps): JSX.Element {
  const [picked, setPicked] = useState<string | null>(null);
  const eligibleQuery = useEligibleSpecializations(configId, true);
  const facultiesQuery = useLookup('faculties');
  const attachMut = useAttachSpecialization();

  const eligible = eligibleQuery.data ?? [];
  const faculties = facultiesQuery.data ?? [];

  const groups: ComboboxGroup[] = useMemo(
    () =>
      faculties
        .filter((f) => f.isActive)
        .map((f) => ({ id: f.code, label: f.name })),
    [faculties],
  );

  const options: ComboboxOption[] = useMemo(
    () =>
      eligible.map((s) => ({
        value: s.code,
        label: s.name,
        badge: s.code,
        groupId: s.facultyCode,
        keywords: s.facultyCode,
      })),
    [eligible],
  );

  const isLoading = eligibleQuery.isLoading || facultiesQuery.isLoading;
  const isEmpty = !isLoading && options.length === 0;

  const handleChange = (next: string | null): void => {
    if (!next) {
      setPicked(null);
      return;
    }
    setPicked(next);
    attachMut.mutate(
      { configId, specializationId: next },
      {
        onSuccess: () => setPicked(null),
        onError: () => setPicked(null),
      },
    );
  };

  if (isLoading) {
    return (
      <p className="font-ar text-sm text-ink-500">جارٍ تحميل التخصصات…</p>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-border-subtle bg-ink-50/40 px-4 py-3">
        <p className="text-2xs text-ink-600">
          لا توجد تخصصات قابلة للربط — إما أن جميع التخصصات مرتبطة بهذه الفئة،
          أو لم يتم تعريف تخصصات في الأكواد المرجعية بعد.
        </p>
        <Link to={LOOKUP_MAPPING_URL} className="inline-flex">
          <Button
            variant="secondary"
            size="sm"
            trailingIcon={
              <ArrowLeft
                size={14}
                strokeWidth={1.75}
                className="rtl:scale-x-[-1]"
              />
            }
          >
            افتح إدارة البيانات المرجعية
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <Combobox
      value={picked}
      onChange={handleChange}
      options={options}
      groups={groups}
      ariaLabel="إضافة تخصص"
      placeholder={attachMut.isPending ? 'جارٍ الربط…' : 'اختر تخصصاً…'}
      disabled={attachMut.isPending}
    />
  );
}
