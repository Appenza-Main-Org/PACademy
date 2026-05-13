/**
 * Bindings sub-tab — `?subtab=bindings` inside the admission-setup
 * wizard's committees step.
 *
 * Renders a per-active-category Radix tab strip (the wizard's
 * scoping) and, inside each panel, the same `ScheduleCategoryPanel`
 * the standalone `/admin/committee/schedule` page uses. The panel
 * provides:
 *   - DatePicker + capacity Input (1..999) + إضافة batch button
 *   - Schedule table with inline-editable capacity per row
 *   - Delete-icon per row
 *
 * The active category is mirrored to `?categoryId=<key>` so deep
 * links survive a reload.
 */

import { Link, useSearchParams } from 'react-router-dom';
import {
  Button,
  EmptyState,
  Tabs,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { ScheduleCategoryPanel } from '@/features/committees/components/ScheduleCategoryPanel';
import type {
  AdmissionCycle,
  ApplicantCategoryKey,
} from '@/shared/types/domain';

export interface CommitteeBindingsPanelProps {
  cycle: AdmissionCycle;
  active: Array<{ key: ApplicantCategoryKey; labelAr: string }>;
}

export function CommitteeBindingsPanel({
  active,
}: CommitteeBindingsPanelProps): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedCategoryId = searchParams.get('categoryId');

  const activeKeys = active.map((a) => a.key as string);
  const resolvedCategoryId: string | null =
    requestedCategoryId && activeKeys.includes(requestedCategoryId)
      ? requestedCategoryId
      : (active[0]?.key as string | undefined) ?? null;

  if (active.length === 0) {
    return (
      <EmptyState
        variant="generic"
        title="لا توجد فئات مفعّلة في هذه الدورة"
        description="ارجع إلى الخطوة الأولى لتفعيل فئة واحدة على الأقل."
        action={
          <Link to={ROUTES.admin.admissionSetup.wizard('application_settings')}>
            <Button variant="primary">العودة إلى إعدادات التقديم</Button>
          </Link>
        }
      />
    );
  }

  const handleCategoryChange = (next: string): void => {
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        sp.set('categoryId', next);
        return sp;
      },
      { replace: true },
    );
  };

  return (
    <Tabs
      value={resolvedCategoryId ?? activeKeys[0]!}
      onValueChange={handleCategoryChange}
    >
      <Tabs.List aria-label="فئات التقديم النشطة للربط">
        {active.map((cat) => (
          <Tabs.Tab key={cat.key} value={cat.key}>
            {cat.labelAr}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {active.map((cat) => (
        <Tabs.Panel key={cat.key} value={cat.key}>
          <div className="pt-3">
            <ScheduleCategoryPanel
              categoryKey={cat.key}
              categoryLabel={cat.labelAr}
              compact
            />
          </div>
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}
