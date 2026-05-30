/**
 * CategorySelectionPage — pre-wizard gate, MOI-aligned (PDF p.3).
 *
 * Reference layout: a `Card`-wrapped vertical stack with read-only header
 * rows (applicant identity, eligibility, specializations, instructions —
 * each opens a `Drawer` via a blue `عرض` button) followed by one row per
 * RFP category whose action enables/disables based on the cycle window.
 * The previous card-grid UI is gone.
 *
 * The applicant identity rows are populated from `MOI_APPLICANT_SESSION`
 * (the mock for the moi.gov.eg handoff). The cycle picker remains for
 * the multi-cycle case (e.g. concurrent male/female cohorts).
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarRange,
  ChevronDown,
  CheckCircle2,
  ClipboardList,
  FileText,
  GraduationCap,
  Info,
  Layers,
  Lock,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  PageHeader,
  Tooltip,
  TooltipProvider,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { cn } from '@/shared/lib/cn';
import type {
  AdmissionCycle,
  ApplicantCategory,
  CategoryCondition,
} from '@/shared/types/domain';
import { date as fmtDate } from '@/shared/lib/format';
import {
  TEST_KIND_LABEL_AR,
  TEST_KIND_ICON,
} from '../lib/category-test-labels';
import {
  useActiveCycles,
  useCategories,
  useEligibleCategories,
} from '../api/categories.queries';
import type { ApplicantCategoryEligibility } from '../api/categories.service';
import { useApplicantPortalStore } from '../store/applicantPortal.store';
import { MOI_APPLICANT_SESSION } from '../lib/moi-session.mock';
import { applicantPortalService } from '../api/applicantPortal.service';
import { useLookup } from '@/features/lookups/api/lookups.queries';
import type { FacultyRow, SpecializationRow } from '@/features/lookups';
import { toSpecializedProgramPickerOptions } from '../lib/specialized-program-options';

const COHORT_LABEL: Record<AdmissionCycle['cohort'], string> = {
  male: 'الذكور',
  female: 'الإناث',
};

const QUALIFICATION_LABEL: Record<CategoryCondition['requiredQualification'], string> = {
  thanaweya_amma: 'الثانوية العامة',
  azhar: 'الثانوية الأزهرية',
  bachelor: 'مؤهل عالي',
  bachelor_law: 'بكالوريوس حقوق',
  bachelor_medicine: 'بكالوريوس طب',
  bachelor_engineering: 'بكالوريوس هندسة',
  bachelor_media: 'بكالوريوس إعلام',
  police_academy_grad: 'خريج كلية الشرطة',
  serving_officer: 'ضابط شرطة',
  any: 'أي مؤهل معتمد',
};

const APPLICATION_FEE_LABEL = 'مقابل تقديم الخدمة إلكترونياً: ٢٥٠ جنيه';

export function CategorySelectionPage(): JSX.Element {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const cyclesQuery = useActiveCycles();
  const storedCycleId = useApplicantPortalStore((s) => s.selectedCycleId);
  const setStoredCycleId = useApplicantPortalStore((s) => s.setSelectedCycleId);
  const moiSession = useApplicantPortalStore((s) => s.moiSession);
  const storeNid = useApplicantPortalStore((s) => s.nationalId);
  const setSelectedCategoryKey = useApplicantPortalStore((s) => s.setSelectedCategoryKey);
  const selectedCategoryKey = useApplicantPortalStore((s) => s.selectedCategoryKey);
  const setSelectedFaculty = useApplicantPortalStore((s) => s.setSelectedFaculty);
  const setSelectedSpecialization = useApplicantPortalStore((s) => s.setSelectedSpecialization);
  const setAssignedCommittee = useApplicantPortalStore((s) => s.setAssignedCommittee);
  /* Faculty + specialization picker shown after specialized-officers
   * selection. Applicant picks الكلية first, then chooses a specialization
   * scoped to that faculty. Sourced from the lookups module. */
  const [specializationPickerOpen, setSpecializationPickerOpen] = useState(false);
  const [pickedFacultyCode, setPickedFacultyCode] = useState<string | null>(null);
  const [pickedSpecializationCode, setPickedSpecializationCode] = useState<string | null>(null);
  /* Source-of-truth for the identity strip: prefer the MOI snapshot
   * captured at login; for not_found scenarios we fall back to a stub
   * derived from the entered NID and route directly to the profile
   * (no MOI data = no eligibility comparison to run). */
  const identity = moiSession ?? null;

  const cycles = cyclesQuery.data ?? [];
  const cycleParam = params.get('cycle');

  const selectedCycle = useMemo<AdmissionCycle | null>(() => {
    if (!cycles.length) return null;
    const tryFind = (id: string | null): AdmissionCycle | null =>
      id ? cycles.find((c) => c.id === id) ?? null : null;
    return (
      tryFind(cycleParam) ??
      tryFind(storedCycleId) ??
      (cycles.length === 1 ? cycles[0]! : null)
    );
  }, [cycles, cycleParam, storedCycleId]);
  const effectiveCycleId = selectedCycle?.id ?? cycleParam ?? null;

  useEffect(() => {
    if (!selectedCycle) return;
    if (cycleParam !== selectedCycle.id) {
      const next = new URLSearchParams(params);
      next.set('cycle', selectedCycle.id);
      setParams(next, { replace: true });
    }
    if (storedCycleId !== selectedCycle.id) {
      setStoredCycleId(selectedCycle.id);
    }
  }, [selectedCycle, cycleParam, params, setParams, storedCycleId, setStoredCycleId]);

  const categoriesQuery = useCategories(effectiveCycleId ?? undefined);
  const applicantNationalId = identity?.nationalId ?? storeNid;
  const eligibilityCategoriesQuery = useEligibleCategories(
    applicantNationalId,
    effectiveCycleId,
  );

  const specializedOfficersEligibility = useMemo(
    () =>
      eligibilityCategoriesQuery.data?.categories.find(
        (category) => category.categoryId === 'specialized_officers',
      ) ?? null,
    [eligibilityCategoriesQuery.data],
  );
  /* When the backend/MOI eligibility response includes the specialized
   * officers category, its academicPrograms are already filtered by age,
   * gender, cycle, and configured rules. In that path we do not fetch the
   * full lookup catalogue for the applicant picker. */
  const shouldLoadLookupPickerCatalog = !applicantNationalId && specializedOfficersEligibility === null;
  const facultiesQuery = useLookup('faculties', { enabled: shouldLoadLookupPickerCatalog });
  const specializationsQuery = useLookup('specializations', { enabled: shouldLoadLookupPickerCatalog });

  /* Restrict the category list to the backend eligibility verdict when it
   * exists. A previously selected category can stay in sessionStorage after
   * navigating back to /applicant/start, so it must not override a live
   * backend response that can legitimately return multiple categories. */
  const derivedEligibleKeys = useMemo<readonly string[] | null>(() => {
    const cats = eligibilityCategoriesQuery.data?.categories;
    if (cats) return cats.filter((c) => c.eligible).map((c) => c.categoryId);
    if (selectedCategoryKey) return [selectedCategoryKey];
    return null;
  }, [selectedCategoryKey, eligibilityCategoriesQuery.data]);

  /* When the backend returns an empty eligible list (no category matches
   * the applicant's age / qualification / cycle rules), redirect to the
   * ineligible page instead of showing all categories with no clear CTA. */
  useEffect(() => {
    if (!eligibilityCategoriesQuery.data) return;
    if (selectedCategoryKey) return;
    const eligible = eligibilityCategoriesQuery.data.categories.filter((c) => c.eligible);
    if (eligible.length === 0) {
      navigate(ROUTES.applicantIneligible, { replace: true });
    }
  }, [eligibilityCategoriesQuery.data, selectedCategoryKey, navigate]);

  useEffect(() => {
    if (!eligibilityCategoriesQuery.error) return;
    if (selectedCategoryKey) return;
    navigate(ROUTES.applicantIneligible, { replace: true });
  }, [eligibilityCategoriesQuery.error, selectedCategoryKey, navigate]);

  /* Lookup-derived option lists — declared HERE (above the conditional
   * returns below) so they sit in a stable hook position across renders.
   * Moving the useMemo calls below the `if (loading) return` violated
   * Rules of Hooks and crashed the page on first paint (blank screen).
   */
  const allowedSpecializedPickerOptions = useMemo(
    () =>
      specializedOfficersEligibility
        ? toSpecializedProgramPickerOptions(specializedOfficersEligibility.academicPrograms)
        : null,
    [specializedOfficersEligibility],
  );
  const allFaculties: readonly FacultyRow[] =
    allowedSpecializedPickerOptions?.faculties ?? facultiesQuery.data ?? [];
  const allSpecializations: readonly SpecializationRow[] =
    allowedSpecializedPickerOptions?.specializations ?? specializationsQuery.data ?? [];
  const facultyByCode = useMemo(
    () => new Map(allFaculties.map((f) => [f.code, f])),
    [allFaculties],
  );
  const specializationByCode = useMemo(
    () => new Map(allSpecializations.map((s) => [s.code, s])),
    [allSpecializations],
  );

  if (cyclesQuery.isLoading) return <LoadingState variant="page" />;
  if (cyclesQuery.error) {
    return (
      <ErrorState
        error={cyclesQuery.error as Error}
        onRetry={() => cyclesQuery.refetch()}
      />
    );
  }
  /* Demo direction (2026-05-18): always render the page even when no
   * cycle is currently within its open/close window — the user still
   * wants the categories visible. The "no active cycle" empty state is
   * intentionally removed. */

  const cycleYear = selectedCycle?.year ?? new Date().getFullYear();

  const saveCommitteeForCategory = (categoryKey: string): void => {
    const cat = eligibilityCategoriesQuery.data?.categories.find((c) => c.categoryId === categoryKey);
    const first = cat?.committees?.[0] ?? null;
    setAssignedCommittee(first?.committeeId ?? null, first?.committeeName ?? null);
  };

  const onPickCategory = (categoryKey: string, enabled: boolean): void => {
    if (!enabled) return;
    /* For الضباط المتخصصون the applicant must pick a sub-specialization
     * BEFORE entering the wizard (client direction 2026-05-19). Set the
     * category key now so the picker title contextually matches, then
     * open the picker — confirmation will navigate. */
    if (categoryKey === 'specialized_officers') {
      setSelectedCategoryKey(categoryKey);
      saveCommitteeForCategory(categoryKey);
      setPickedFacultyCode(null);
      setPickedSpecializationCode(null);
      setSpecializationPickerOpen(true);
      return;
    }
    /* For not_found-in-MOI users (or when there's no live cycle to run
     * an eligibility check against) skip the eligibility step and go
     * straight to the profile. */
    if (!identity || !effectiveCycleId) {
      setSelectedCategoryKey(categoryKey);
      saveCommitteeForCategory(categoryKey);
      setSelectedFaculty(null);
      setSelectedSpecialization(null);
      void applicantPortalService.saveDraft(MOI_APPLICANT_SESSION.applicantId, {
        categoryKey,
        ...(effectiveCycleId ? { cycleId: effectiveCycleId } : {}),
      } as Parameters<typeof applicantPortalService.saveDraft>[1]);
      navigate(ROUTES.applicantProfile);
      return;
    }
    setSelectedFaculty(null);
    setSelectedSpecialization(null);
    saveCommitteeForCategory(categoryKey);
    navigate(
      `${ROUTES.applicantEligibility}?category=${categoryKey}&cycle=${effectiveCycleId}`,
    );
  };

  const confirmSpecialization = (): void => {
    if (!pickedFacultyCode || !pickedSpecializationCode) return;
    const faculty = facultyByCode.get(pickedFacultyCode);
    const specialization = specializationByCode.get(pickedSpecializationCode);
    if (!faculty || !specialization) return;
    setSelectedFaculty(faculty.name);
    setSelectedSpecialization(specialization.name);
    setSpecializationPickerOpen(false);
    /* Same routing logic as the standard onPickCategory path: skip the
     * eligibility step for not_found-in-MOI users, otherwise navigate
     * to the eligibility-check page first. */
    if (!identity || !effectiveCycleId) {
      void applicantPortalService.saveDraft(MOI_APPLICANT_SESSION.applicantId, {
        categoryKey: 'specialized_officers',
        ...(effectiveCycleId ? { cycleId: effectiveCycleId } : {}),
      } as Parameters<typeof applicantPortalService.saveDraft>[1]);
      navigate(ROUTES.applicantProfile);
      return;
    }
    navigate(
      `${ROUTES.applicantEligibility}?category=specialized_officers&cycle=${effectiveCycleId}`,
    );
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        <PageHeader
          title={`التقدم للإلتحاق بكلية الشرطة للعام الدراسي ${cycleYear}`}
          subtitle="راجع البيانات المُسجَّلة على بوابة وزارة الداخلية ثم اختر القسم المناسب للتقدم."
          breadcrumbs={[
            { label: 'بوابة المتقدم', href: ROUTES.applicant },
            { label: 'اختيار الفئة' },
          ]}
        />

        {cycles.length > 1 && (
          <CyclePickerStrip
            cycles={cycles}
            selectedId={selectedCycle?.id ?? null}
            onPick={(id) => {
              setStoredCycleId(id);
              const next = new URLSearchParams(params);
              next.set('cycle', id);
              setParams(next, { replace: false });
            }}
          />
        )}

        {/* Client direction 2026-05-21: identity / eligibility /
            specializations / instructions all render inline by default.
            No popup buttons. The applicant sees the complete picture on
            a single scroll. */}

        <InlineSection icon={<User size={16} strokeWidth={1.75} />} title="بيانات المتقدم">
          {identity ? (
            <IdentityDrawerBody />
          ) : (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-ink-700">
              <span className="inline-flex items-center gap-2">
                <span className="text-xs font-medium text-ink-500">الرقم القومي</span>
                <span className="font-mono text-sm font-bold text-ink-900" dir="ltr">
                  {storeNid ?? '—'}
                </span>
              </span>
            </div>
          )}
        </InlineSection>

        <InlineSection icon={<ShieldCheck size={16} strokeWidth={1.75} />} title="شروط الإلتحاق">
          <EligibilityDrawerBody
            cycle={selectedCycle}
            categories={categoriesQuery.data ?? []}
          />
        </InlineSection>

        <InlineSection icon={<Layers size={16} strokeWidth={1.75} />} title="التخصصات المطلوبة">
          <SpecializationsDrawerBody categories={categoriesQuery.data ?? []} />
        </InlineSection>

        <InlineSection
          icon={<ClipboardList size={16} strokeWidth={1.75} />}
          title="إرشادات التقدم"
          headerExtra={<span className="text-2xs text-ink-500">{APPLICATION_FEE_LABEL}</span>}
        >
          <InstructionsDrawerBody />
        </InlineSection>

        <Card variant="elevated" className="overflow-hidden p-0">
          <header className="flex items-center gap-3 border-b border-border-subtle bg-ink-50/55 px-5 py-4">
            <span
              aria-hidden
              className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-700 ring-1 ring-teal-500/10"
            >
              <GraduationCap size={16} strokeWidth={1.75} />
            </span>
            <h3 className="font-ar-display text-lg font-bold text-ink-900">اختر فئة التقدم</h3>
          </header>
          <CategoryRows
            categoriesQuery={categoriesQuery}
            eligibility={eligibilityCategoriesQuery.data?.categories ?? []}
            eligibilityLoading={eligibilityCategoriesQuery.isLoading}
            /* When MOI/backend eligibility is available, show only those
             * categories. For not_found / no MOI session, show the full
             * catalogue so the applicant can pick. */
            eligibleKeys={derivedEligibleKeys}
            onPick={onPickCategory}
          />
        </Card>

        {/* Specialization picker — opened when an applicant chooses
            الضباط المتخصصون. They must select a specialization here
            before entering the wizard (client direction 2026-05-19).
            This is the only popup left on the page — info sections
            above all render inline. */}
        <Modal
          open={specializationPickerOpen}
          onClose={() => setSpecializationPickerOpen(false)}
          title="اختر الكلية والتخصص"
          size="lg"
        >
          <Modal.Body>
            <SpecializationPickerBody
              faculties={allFaculties}
              specializations={allSpecializations}
              pickedFacultyCode={pickedFacultyCode}
              pickedSpecializationCode={pickedSpecializationCode}
              onPickFaculty={(code) => {
                setPickedFacultyCode(code);
                /* Drop any previously-picked specialization when faculty
                 * changes — it likely belongs to the old faculty. */
                setPickedSpecializationCode(null);
              }}
              onPickSpecialization={setPickedSpecializationCode}
              loading={
                shouldLoadLookupPickerCatalog &&
                (facultiesQuery.isLoading || specializationsQuery.isLoading)
              }
            />
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() => setSpecializationPickerOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              onClick={confirmSpecialization}
              disabled={!pickedFacultyCode || !pickedSpecializationCode}
            >
              متابعة
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    </TooltipProvider>
  );
}

function SpecializationPickerBody({
  faculties,
  specializations,
  pickedFacultyCode,
  pickedSpecializationCode,
  onPickFaculty,
  onPickSpecialization,
  loading,
}: {
  faculties: readonly FacultyRow[];
  specializations: readonly SpecializationRow[];
  pickedFacultyCode: string | null;
  pickedSpecializationCode: string | null;
  onPickFaculty: (code: string) => void;
  onPickSpecialization: (code: string) => void;
  loading: boolean;
}): JSX.Element {
  const activeFaculties = faculties.filter((f) => f.isActive);
  const scopedSpecializations = pickedFacultyCode
    ? specializations.filter((s) => s.isActive && s.facultyCode === pickedFacultyCode)
    : [];

  if (loading) {
    return <LoadingState variant="list" rows={6} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-ink-700">
        اختر الكلية أولاً ثم التخصص الذي ستتقدم به لقسم الضباط المتخصصون.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h3 className="font-ar-display text-sm font-bold text-ink-900">الكلية</h3>
          {activeFaculties.length === 0 ? (
            <p className="rounded-md border border-dashed border-border-default bg-ink-50 px-3 py-3 text-2xs text-ink-500">
              لا توجد كليات أو تخصصات مطابقة لبيانات المتقدم حالياً.
            </p>
          ) : (
            <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto pe-1">
              {activeFaculties.map((f) => {
                const active = f.code === pickedFacultyCode;
                return (
                  <li key={f.code}>
                    <PickerButton
                      active={active}
                      onClick={() => onPickFaculty(f.code)}
                      label={f.name}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="font-ar-display text-sm font-bold text-ink-900">التخصص</h3>
          {!pickedFacultyCode ? (
            <p className="rounded-md border border-dashed border-border-default bg-ink-50 px-3 py-3 text-2xs text-ink-500">
              اختر الكلية أولاً لعرض التخصصات المتاحة.
            </p>
          ) : scopedSpecializations.length === 0 ? (
            <p className="rounded-md border border-dashed border-border-default bg-ink-50 px-3 py-3 text-2xs text-ink-500">
              لا توجد تخصصات نشطة لهذه الكلية حالياً.
            </p>
          ) : (
            <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto pe-1">
              {scopedSpecializations.map((s) => {
                const active = s.code === pickedSpecializationCode;
                return (
                  <li key={s.code}>
                    <PickerButton
                      active={active}
                      onClick={() => onPickSpecialization(s.code)}
                      label={s.name}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function PickerButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md border bg-surface-card px-3 py-2 text-start text-sm transition-colors duration-fast ease-standard',
        'focus-visible:shadow-focus-teal focus-visible:outline-none',
        active
          ? 'border-teal-500 bg-teal-50 text-ink-900 shadow-card ring-2 ring-teal-500/30'
          : 'border-border-default text-ink-800 hover:border-teal-500 hover:bg-teal-50',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-block h-2 w-2 rounded-full',
          active ? 'bg-teal-500' : 'bg-ink-300',
        )}
      />
      <span className="font-medium">{label}</span>
    </button>
  );
}

/* ─── section helpers ───────────────────────────────────────────────── */

/**
 * Inline section wrapper for the four info blocks on the page
 * (applicant identity / shroot el-iltihaq / takhassossat / instructions).
 *
 * Each section opens by default and can be collapsed independently via
 * the header chevron — replaces the previous popup-triggered HeaderRows
 * per client direction 2026-05-21.
 */
function InlineSection({
  icon,
  title,
  headerExtra,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
}): JSX.Element {
  const [open, setOpen] = useState(true);
  return (
    <Card className="overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          'group flex w-full items-center gap-3 border-b border-border-subtle bg-ink-50/55 px-5 py-4 text-start',
          'transition-colors duration-fast ease-standard hover:bg-ink-50',
          'focus-visible:shadow-focus-teal focus-visible:outline-none',
          !open && 'border-b-transparent',
        )}
      >
        <span
          aria-hidden
          className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-700 ring-1 ring-teal-500/10"
        >
          {icon}
        </span>
        <h3 className="font-ar-display text-lg font-bold text-ink-900">{title}</h3>
        {headerExtra && (
          <span className="ms-auto hidden rounded-pill bg-gold-50 px-3 py-1 text-2xs font-medium text-gold-700 md:inline-flex">
            {headerExtra}
          </span>
        )}
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          className={cn(
            'shrink-0 text-ink-500 transition-transform duration-fast ease-standard',
            !headerExtra && 'ms-auto',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {open && <div className="px-5 py-5">{children}</div>}
    </Card>
  );
}

function CategoryRows({
  categoriesQuery,
  eligibility,
  eligibilityLoading,
  eligibleKeys,
  onPick,
}: {
  categoriesQuery: ReturnType<typeof useCategories>;
  eligibility: readonly ApplicantCategoryEligibility[];
  eligibilityLoading: boolean;
  /** Restrict the rendered list to categories returned by MOI/backend
   *  eligibility. When null, the full catalogue renders. */
  eligibleKeys: readonly string[] | null;
  onPick: (key: string, enabled: boolean) => void;
}): JSX.Element {
  if (categoriesQuery.isLoading || eligibilityLoading) {
    return (
      <div className="px-5 py-4">
        <LoadingState variant="list" rows={4} />
      </div>
    );
  }
  if (categoriesQuery.error) {
    return (
      <div className="px-5 py-4">
        <ErrorState
          error={categoriesQuery.error as Error}
          onRetry={() => categoriesQuery.refetch()}
        />
      </div>
    );
  }
  /* Demo direction (2026-05-18), tightened for backend eligibility:
   *  - Show every category from the mock catalogue even when no live
   *    cycle is in window (force isOpen so the row is clickable).
   *  - When the backend has resolved eligible categories, let that
   *    response be the source of truth and use the catalogue only to
   *    enrich labels/descriptions. Staging can legitimately return
   *    eligible categories that the local catalogue does not know yet. */
  const allowedKeys = eligibleKeys === null ? null : new Set(eligibleKeys);
  const catalogue = categoriesQuery.data ?? [];
  const catalogueByKey = new Map<string, ApplicantCategory>(
    catalogue.map((category) => [category.key, category]),
  );
  const verdictByKey = new Map(eligibility.map((verdict) => [verdict.categoryId, verdict]));
  const backendOrderedKeys = eligibility
    .filter((verdict) => allowedKeys === null || allowedKeys.has(verdict.categoryId))
    .map((verdict) => verdict.categoryId);
  const catalogueOrderedKeys = catalogue
    .filter((category) => allowedKeys === null || allowedKeys.has(category.key))
    .map((category) => category.key);
  const orderedKeys = eligibility.length > 0
    ? [
        ...catalogueOrderedKeys.filter((key) => verdictByKey.has(key)),
        ...backendOrderedKeys.filter((key) => !catalogueByKey.has(key)),
      ]
    : catalogueOrderedKeys;
  const categories = orderedKeys.map((key) => {
    const verdict = verdictByKey.get(key);
    const catalogueCategory = catalogueByKey.get(key);
    return {
      category: catalogueCategory ?? categoryFromEligibility(verdict, key),
      isEnabled: verdict ? verdict.eligible : true,
      failedReasons: verdict?.failedReasons ?? [],
    };
  });
  if (categories.length === 0) {
    return (
      <div className="px-5 py-6">
        <EmptyState variant="generic" title="لا توجد فئات متاحة في هذه الدورة" />
      </div>
    );
  }

  return (
    <div className="border-t border-border-default">
      {categories.map(({ category, isEnabled, failedReasons }, i) => (
        <CategoryRow
          key={category.key}
          category={category}
          isEnabled={isEnabled}
          failedReasons={failedReasons}
          onPick={(enabled) => onPick(category.key, enabled)}
          isLast={i === categories.length - 1}
        />
      ))}
    </div>
  );
}

function categoryFromEligibility(
  verdict: ApplicantCategoryEligibility | undefined,
  categoryId: string,
): ApplicantCategory {
  return {
    key: categoryId as ApplicantCategory['key'],
    labelAr: verdict?.categoryName ?? categoryId,
    labelEn: verdict?.categoryName ?? categoryId,
    description: 'مطابق لإعدادات القبول لهذه الدورة',
    isOpen: verdict?.eligible ?? true,
    conditions: {
      ageMin: verdict?.checks.ageCheck.minAge ?? null,
      ageMax: verdict?.maxAge ?? null,
      minScorePercent: null,
      requiredQualification: 'any',
      gender: 'any',
      minHeightCm: null,
      medicalRequired: true,
      maritalStatus: 'any',
      conductCheck: true,
      egyptianNationalityRequired: true,
      employerApprovalRequired: false,
      nominationOnly: false,
      freeText: [],
    },
    requiredTests: [],
    procedures: [],
  };
}

function CategoryRow({
  category,
  isEnabled,
  failedReasons,
  onPick,
  isLast,
}: {
  category: ApplicantCategory;
  isEnabled: boolean;
  failedReasons: readonly string[];
  onPick: (enabled: boolean) => void;
  isLast: boolean;
}): JSX.Element {
  const enabled = isEnabled;
  const disabledReason = enabled
    ? null
    : failedReasons.length > 0
      ? failedReasons.join('، ')
      : category.conditions.nominationOnly
      ? 'هذا القسم يفتح عبر الترشيح الإداري فقط — لا تقديم مباشر.'
      : 'باب التقدم غير مفتوح لهذه الفئة في الدورة الحالية.';

  const button = (
    <Button
      variant="primary"
      size="md"
      disabled={!enabled}
      onClick={() => onPick(enabled)}
    >
      <ArrowLeft size={15} strokeWidth={1.75} className="rtl:rotate-180" aria-hidden />
      التقدم للإلتحاق
    </Button>
  );

  return (
    <div
      className={cn(
        'grid gap-4 px-5 py-4 transition-colors duration-fast ease-standard md:grid-cols-[minmax(0,1fr)_auto] md:items-center',
        enabled ? 'hover:bg-teal-50/45' : 'bg-ink-50/45',
        !isLast && 'border-b border-border-subtle',
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            aria-hidden
            className={cn(
              'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
              enabled ? 'bg-teal-50 text-teal-700' : 'bg-ink-100 text-ink-500',
            )}
          >
            {enabled ? (
              <GraduationCap size={15} strokeWidth={1.75} />
            ) : (
              <Lock size={15} strokeWidth={1.75} />
            )}
          </span>
          <h4 className="font-ar-display text-lg font-bold text-ink-900">
            {category.labelAr}
          </h4>
          <Badge tone={enabled ? 'success' : 'neutral'}>
            {enabled ? (
              <CheckCircle2 size={11} strokeWidth={1.75} className="me-1 inline-block" />
            ) : (
              <Lock size={11} strokeWidth={1.75} className="me-1 inline-block" />
            )}
            {enabled ? 'متاح للتقدم' : 'مغلق'}
          </Badge>
        </div>
        <p className="mt-2 max-w-[72ch] text-sm leading-relaxed text-ink-700">
          {category.description}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-pill bg-ink-100 px-3 py-1 text-2xs font-medium text-ink-700">
            {QUALIFICATION_LABEL[category.conditions.requiredQualification]}
          </span>
          {category.requiredTests.length > 0 && (
            <span className="rounded-pill bg-teal-50 px-3 py-1 text-2xs font-medium text-teal-700">
              {category.requiredTests.length} اختبارات
            </span>
          )}
          {category.conditions.ageMax !== null && (
            <span className="rounded-pill bg-gold-50 px-3 py-1 text-2xs font-medium text-gold-700">
              حتى {category.conditions.ageMax} سنة
            </span>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 md:justify-self-end">
        {disabledReason ? (
          <Tooltip content={disabledReason}>
            <span tabIndex={0} className="inline-block">
              {button}
            </span>
          </Tooltip>
        ) : (
          button
        )}
      </div>
    </div>
  );
}

/* ─── drawer bodies ─────────────────────────────────────────────────── */

function IdentityDrawerBody(): JSX.Element {
  const s = useApplicantPortalStore((st) => st.moiSession) ?? MOI_APPLICANT_SESSION;
  const rows: Array<{ label: string; value: string; ltr?: boolean; mono?: boolean }> = [
    { label: 'الإسم رباعي', value: s.fullName },
    { label: 'الرقم القومي', value: s.nationalId, ltr: true, mono: true },
    { label: 'تاريخ الميلاد', value: s.dateOfBirthAr },
    { label: 'النوع', value: s.gender === 'male' ? 'ذكر' : 'أنثى' },
    { label: 'محل الميلاد', value: `${s.birthGovernorate} — ${s.birthDistrict}` },
    { label: 'الديانة', value: s.religion },
    { label: 'رقم المحمول', value: s.mobile, ltr: true, mono: true },
    { label: 'البريد الإلكتروني', value: s.email, ltr: true, mono: true },
  ];
  return (
    <div className="flex flex-col gap-3">
      {/* <div className="rounded-md border border-dashed border-gold-300 bg-gold-50 px-3 py-2 text-2xs text-gold-700">
        هذه البيانات مستوردة من بوابة وزارة الداخلية ولا يمكن تعديلها من داخل البوابة.
      </div> */}
      <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => {
          const hasValue = Boolean(r.value && r.value.replace(/—/g, '').trim());
          return (
            <div
              key={r.label}
              className="flex flex-col gap-1.5 rounded-lg border border-border-default bg-ink-50/60 px-4 py-3"
            >
              <dt className="text-xs font-medium text-ink-500">{r.label}</dt>
              <dd
                className={cn(
                  'text-sm font-bold text-ink-900',
                  r.mono && 'font-mono tracking-tight',
                )}
              >
                {hasValue ? (
                  r.ltr ? (
                    <bdi dir="ltr">{r.value}</bdi>
                  ) : (
                    r.value
                  )
                ) : (
                  <span className="font-normal text-ink-400">—</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function EligibilityDrawerBody({
  cycle,
  categories,
}: {
  cycle: AdmissionCycle | null;
  categories: readonly ApplicantCategory[];
}): JSX.Element {
  return (
    <div className="flex flex-col gap-5">
      {cycle && (
        <div className="inline-flex w-fit max-w-full flex-wrap items-center gap-2 rounded-md border border-border-default bg-ink-50 px-4 py-3 text-sm text-ink-700">
          <CalendarRange size={16} strokeWidth={1.75} className="shrink-0 text-teal-700" aria-hidden />
          الدورة الحالية: <span className="font-medium">{cycle.nameAr}</span> · فترة التقدم تنتهي في{' '}
          {fmtDate(cycle.closeDate, 'short')}
        </div>
      )}
      {categories.length === 0 ? (
        <p className="text-sm text-ink-600">لا توجد شروط معروضة في الوقت الحالي.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {categories.map((c) => (
            <li
              key={c.key}
              className="flex flex-col rounded-lg border border-border-default bg-surface-card p-4"
            >
              <p className="mb-3 inline-flex items-center gap-2 border-b border-border-subtle pb-3 font-ar-display text-md font-bold text-ink-900">
                <ShieldCheck size={17} strokeWidth={1.75} className="shrink-0 text-teal-700" aria-hidden />
                {c.labelAr}
              </p>
              <ul className="flex flex-col gap-2.5 text-sm leading-relaxed text-ink-800">
                {summariseConditions(c.conditions).map((line, i) => (
                  <li key={`${c.key}-c-${i}`} className="flex items-start gap-2.5">
                    <CheckCircle2
                      size={16}
                      strokeWidth={2}
                      className="mt-px shrink-0 text-teal-600"
                      aria-hidden
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              {c.conditions.freeText.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1.5 border-t border-border-subtle pt-3 text-xs leading-relaxed text-ink-600">
                  {c.conditions.freeText.map((t, i) => (
                    <li key={`${c.key}-f-${i}`} className="flex items-start gap-2.5">
                      <span
                        aria-hidden
                        className="mt-[7px] inline-block h-1 w-1 shrink-0 rounded-full bg-ink-300"
                      />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function summariseConditions(c: CategoryCondition): string[] {
  const lines: string[] = [];
  if (c.egyptianNationalityRequired) lines.push('مصري الجنسية ومن أب وأم مصريين');
  if (c.conductCheck) lines.push('حسن السير والسلوك');
  if (c.maritalStatus === 'single') lines.push('غير متزوج');
  if (c.medicalRequired) lines.push('لائق طبياً');
  if (c.minHeightCm !== null) lines.push(`الطول لا يقل عن ${c.minHeightCm} سم`);
  if (c.ageMax !== null && c.ageMin !== null) lines.push(`السن من ${c.ageMin} إلى ${c.ageMax} سنة`);
  else if (c.ageMax !== null) lines.push(`السن حتى ${c.ageMax} سنة`);
  else if (c.ageMin !== null) lines.push(`السن لا يقل عن ${c.ageMin} سنة`);
  if (c.requiredQualification !== 'any') lines.push(QUALIFICATION_LABEL[c.requiredQualification]);
  if (c.minScorePercent !== null) lines.push(`الحد الأدنى لمجموع المؤهل: ${c.minScorePercent}%`);
  if (c.employerApprovalRequired) lines.push('موافقة جهة العمل');
  if (c.gender === 'female') lines.push('للإناث فقط');
  if (c.gender === 'male') lines.push('للذكور فقط');
  return lines;
}

function SpecializationsDrawerBody({
  categories,
}: {
  categories: readonly ApplicantCategory[];
}): JSX.Element {
  if (categories.length === 0) {
    return <p className="text-sm text-ink-600">لا توجد تخصصات معروضة في الوقت الحالي.</p>;
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {categories.map((c) => (
        <li
          key={c.key}
          className="flex flex-col rounded-lg border border-border-default bg-surface-card p-4"
        >
          <p className="mb-3 inline-flex items-center gap-2 border-b border-border-subtle pb-3 font-ar-display text-md font-bold text-ink-900">
            <GraduationCap size={17} strokeWidth={1.75} className="shrink-0 text-teal-700" aria-hidden />
            {c.labelAr}
          </p>
          {c.requiredTests.length === 0 ? (
            <p className="text-sm text-ink-500">لم تُحدَّد اختبارات بعد لهذه الفئة.</p>
          ) : (
            <ul className="flex flex-wrap gap-2 text-sm text-ink-800">
              {c.requiredTests.map((t) => {
                const Icon = TEST_KIND_ICON[t.kind];
                return (
                  <li
                    key={`${c.key}-t-${t.kind}`}
                    className="inline-flex items-center gap-2 rounded-md border border-border-subtle bg-ink-50 px-2.5 py-2"
                  >
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-surface-card text-ink-700">
                      <Icon size={15} strokeWidth={1.75} />
                    </span>
                    <span className="font-numeric tnum text-sm text-ink-500">{t.order}.</span>
                    <span>{TEST_KIND_LABEL_AR[t.kind]}</span>
                    {t.passingCriteria && (
                      <span className="ms-1 text-sm text-ink-500">— {t.passingCriteria}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

function InstructionsDrawerBody(): JSX.Element {
  return (
    <div className="flex flex-col gap-4 text-ink-800">
      <div className="grid gap-3 lg:grid-cols-3">
        <InstructionNote
          icon={<User size={16} strokeWidth={1.75} />}
          title="قبل التقدم"
        >
          راجع البيانات المُسجَّلة على بوابة وزارة الداخلية وتأكد من صحة الاسم والرقم القومي ورقم المحمول.
        </InstructionNote>
        <InstructionNote
          icon={<GraduationCap size={16} strokeWidth={1.75} />}
          title="أثناء التقدم"
        >
          أدخل بيانات الدراسة بدقة طبقاً لأوراقك الثبوتية، فأي مخالفة قد تؤدي إلى منعك من الإختبار.
        </InstructionNote>
        <InstructionNote
          icon={<FileText size={16} strokeWidth={1.75} />}
          title="مقابل الخدمة"
        >
          {APPLICATION_FEE_LABEL.replace('مقابل تقديم الخدمة إلكترونياً: ', '')}، يُسدَّد مرة واحدة خلال الدورة الحالية.
        </InstructionNote>
      </div>
      <p className="flex items-start gap-2 rounded-md border border-dashed border-gold-300 bg-gold-50 px-4 py-3 text-sm leading-relaxed text-gold-700">
        <FileText size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
        <span>
          احرص على طباعة بطاقة التردد والإقرار قبل موعد أول اختبار، وعلى توقيعها من المتقدم وولي
          الأمر.
        </span>
      </p>
    </div>
  );
}

function InstructionNote({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="rounded-md border border-border-subtle bg-ink-50/70 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 font-ar-display text-sm font-bold text-ink-900">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-surface-card text-teal-700">
          {icon}
        </span>
        {title}
      </div>
      <p className="text-sm leading-relaxed text-ink-700">{children}</p>
    </div>
  );
}

/* ─── cycle picker strip (multi-cycle case only) ────────────────────── */

function CyclePickerStrip({
  cycles,
  selectedId,
  onPick,
}: {
  cycles: readonly AdmissionCycle[];
  selectedId: string | null;
  onPick: (id: string) => void;
}): JSX.Element {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 font-ar-display text-md font-bold text-ink-900">
          <Info size={14} strokeWidth={1.75} aria-hidden />
          توجد أكثر من دورة قبول نشطة — اختر الدورة المناسبة
        </h2>
        <Badge tone="info">
          <Users size={12} strokeWidth={1.75} className="me-1 inline-block" />
          {cycles.length} دورات
        </Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cycles.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onPick(c.id)}
            aria-pressed={c.id === selectedId}
            className={cn(
              'flex items-center gap-3 rounded-md border bg-surface-card p-3 text-start transition-colors duration-fast ease-standard',
              'focus-visible:shadow-focus-teal focus-visible:outline-none',
              c.id === selectedId
                ? 'border-teal-500 bg-teal-50 shadow-card ring-2 ring-teal-500/30'
                : 'border-border-default hover:border-teal-500 hover:bg-teal-50',
            )}
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-teal-50 text-teal-700">
              <CalendarRange size={16} strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-ar-display text-sm font-bold text-ink-900">
                {c.nameAr}
              </p>
              <p className="mt-0.5 text-2xs text-ink-500">
                {COHORT_LABEL[c.cohort]} · حتى {fmtDate(c.closeDate, 'short')}
              </p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
