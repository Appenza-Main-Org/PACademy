/**
 * CommitteeSchedulePage — /admin/committee/schedule
 *
 * Four-tab admin surface for the per-(committee × date) exam calendar.
 * Each tab scopes both the form (DatePicker + capacity + إضافة) and
 * the table beneath to one applicant category. The actual form/table
 * markup lives in the shared `ScheduleCategoryPanel`, which is also
 * embedded inside the admission-setup wizard's "ربط اللجان بالمواعيد"
 * sub-tab.
 */

import { useSearchParams } from 'react-router-dom';
import { Card, PageHeader, Tabs } from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ScheduleCategoryPanel } from '../components/ScheduleCategoryPanel';
import { type ApplicantCategoryKey } from '@/shared/types/domain';

interface ScheduleTab {
  key: ApplicantCategoryKey;
  labelAr: string;
}

const TABS: readonly ScheduleTab[] = [
  { key: 'officers_general',             labelAr: 'القسم العام' },
  { key: 'specialized_officers',         labelAr: 'الضباط المتخصصين' },
  { key: 'law_bachelor',                 labelAr: 'الحقوقيين' },
  { key: 'physical_education_bachelor',  labelAr: 'تربية رياضية إناث' },
];

function isTabKey(v: string | null): v is ApplicantCategoryKey {
  if (!v) return false;
  return TABS.some((t) => t.key === v);
}

export function CommitteeSchedulePage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedKey = searchParams.get('tab');
  const activeKey: ApplicantCategoryKey = isTabKey(requestedKey)
    ? requestedKey
    : TABS[0]!.key;

  const handleTabChange = (next: string): void => {
    if (!isTabKey(next)) return;
    setSearchParams(
      (prev) => {
        const sp = new URLSearchParams(prev);
        sp.set('tab', next);
        return sp;
      },
      { replace: true },
    );
  };

  return (
    <CenteredShell>
      <PageHeader
        title="مواعيد الاختبارات"
        subtitle="حدّد تاريخ الاختبار والسعة لكل فئة — يُضاف موعد لكل لجنة تابعة للفئة."
      />

      <Card className="mt-3">
        <Tabs value={activeKey} onValueChange={handleTabChange}>
          <Tabs.List aria-label="فئات الاختبارات">
            {TABS.map((tab) => (
              <Tabs.Tab key={tab.key} value={tab.key}>
                {tab.labelAr}
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {TABS.map((tab) => (
            <Tabs.Panel key={tab.key} value={tab.key}>
              <div className="pt-3">
                <ScheduleCategoryPanel
                  categoryKey={tab.key}
                  categoryLabel={tab.labelAr}
                />
              </div>
            </Tabs.Panel>
          ))}
        </Tabs>
      </Card>
    </CenteredShell>
  );
}
