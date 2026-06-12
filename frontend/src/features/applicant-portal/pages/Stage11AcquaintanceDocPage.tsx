/**
 * Stage 11 — وثيقة تعارف (Introduction Document) — Case 1 (قسم عام).
 *
 * Page-level orchestrator for the 35-page Ministry-of-Interior intake
 * document. Drives a 7-group accordion (data entry) and a preview
 * Drawer carrying the page-faithful printable mirror.
 *
 * Lifecycle:
 *   1. On mount, load the document from sessionStorage (per-NID key);
 *      fall back to a fresh document derived from MOI session + Stage 7
 *      family snapshot.
 *   2. Every group change re-saves to sessionStorage.
 *   3. After group 7 is valid, «إنهاء وعرض المعاينة» opens the Drawer.
 *      The user can then «طباعة» (browser print dialog) or close to edit.
 *   4. «تأكيد الإرسال» stamps `vothiqaTaarufSubmittedAt` on the wizard
 *      store; a 24-hour edit window starts. After expiry the page
 *      becomes view-and-print only.
 *
 * Demo users (this iteration):
 *   - 30501010103456 — fillable قسم-عام (un-skipped via ENABLED_NIDS).
 *   - 30501010203456 — expired-window seed (loaded at login, locked here).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye, FileCheck, Lock, Printer, Save } from 'lucide-react';
import { Button, Drawer, ErrorState, LoadingState, toast } from '@/shared/components';
import { validateNationalIdGenderField } from '@/shared/lib/national-id';
import { useApplicantPortalStore } from '../store/applicantPortal.store';
import {
  useAcquaintanceDoc,
  usePrintableAcquaintanceDoc,
  useSaveAcquaintanceDoc,
} from '../api/applicantPortal.queries';
import {
  formatMemberName,
  loadFamilySnapshot,
  RELATIVE_LABEL,
  type FamilyDataSnapshot,
  type FamilyMemberForm,
  type GrandparentsForm,
  type RelativeKind,
} from '../lib/familyData';
import { deriveInitialDocument } from '../lib/vothiqaTaaruf.derive';
import {
  GROUP_KEYS,
  GROUP_LABELS,
  emptyDocument,
  emptyAdultRelative,
  type ApplicantSpouseRecord,
  type GroupKey,
  type VothiqaTaarufDocument,
} from '../lib/vothiqaTaaruf.types';
import {
  AccordionGroup,
  Cell,
  CriminalCasesTable,
  ForeignEmployedTable,
  NaturalizedTable,
  PrintableDocument,
  RecordGrid,
  RelativesListPanel,
} from '../components/vothiqaTaaruf';
import { validateParentDob } from '../lib/validateParentDob';
import {
  GOVERNORATE_OPTIONS,
  HOUSING_TYPE_OPTIONS,
  MARITAL_STATUS_ADULT_OPTIONS,
  NATIONALITY_OPTIONS,
  PROFESSION_OPTIONS,
  QUALIFICATION_OPTIONS,
  RELIGION_OPTIONS,
  RELIGION_OPTIONS_FEMALE,
} from '../lib/vothiqaTaaruf.options';

/* Mirrors `MEMBERSHIP_PROFESSIONS` in Stage7FamilyPage — when the
 * profession is police/army officer, the form must collect the
 * officer's seniority number (رقم الأقدمية). */
const OFFICER_PROFESSIONS = new Set(['police_officer', 'army_officer']);
function isOfficer(profession: string | undefined): boolean {
  return profession ? OFFICER_PROFESSIONS.has(profession) : false;
}

const MALE_RELATIVE_LIST_KEYS = new Set([
  'fullBrothers',
  'halfBrothers',
  'brothersSons',
  'sistersSons',
  'paternalUncles',
  'paternalUnclesSons',
  'paternalAuntsSons',
  'maternalUncles',
  'maternalUnclesSons',
  'maternalAuntsSons',
]);
const FEMALE_RELATIVE_LIST_KEYS = new Set([
  'brothersDaughters',
  'fullSisters',
  'halfSisters',
  'sistersDaughters',
  'paternalUnclesDaughters',
  'paternalAunts',
  'paternalAuntsDaughters',
  'maternalUnclesDaughters',
  'maternalAunts',
  'maternalAuntsDaughters',
]);

/* ────────────────────────────────────────────────────────────────────
 * Guardian picker (نموذج 3) — copies an existing family member into
 * the Guardian record so the applicant doesn't re-type their uncle's
 * data when they've already filled it in Stage 7.
 *
 * The picker is a transient UI state (not stored in the document) —
 * the resulting GuardianRecord data is what persists. Picking «آخر»
 * re-opens the manual entry form.
 * ──────────────────────────────────────────────────────────────────── */

type GuardianSource =
  | 'manual'
  | 'mother'
  | `fatherWife-${number}`
  | `motherHusband-${number}`
  | `grandparent-${keyof GrandparentsForm}`
  | `relative-${RelativeKind}-${number}`;

interface GuardianMemberOption {
  value: GuardianSource;
  label: string;
}

function buildGuardianMemberOptions(family: FamilyDataSnapshot | null): GuardianMemberOption[] {
  if (!family) return [];
  const opts: GuardianMemberOption[] = [];
  const motherName = formatMemberName(family.mother);
  if (motherName !== '—' && motherName.trim().length > 0) {
    opts.push({ value: 'mother', label: `الأم — ${motherName}` });
  }
  family.fatherWives.forEach((w, i) => {
    const n = formatMemberName(w);
    if (n !== '—' && n.trim().length > 0) {
      opts.push({ value: `fatherWife-${i}`, label: `زوجة الأب ${i + 1} — ${n}` });
    }
  });
  family.motherHusbands.forEach((h, i) => {
    const n = formatMemberName(h);
    if (n !== '—' && n.trim().length > 0) {
      opts.push({ value: `motherHusband-${i}`, label: `زوج الأم ${i + 1} — ${n}` });
    }
  });
  const grandparentSlots: Array<[keyof GrandparentsForm, string]> = [
    ['paternalGrandfather', 'الجد لأب'],
    ['paternalGrandmother', 'الجدة لأب'],
    ['maternalGrandfather', 'الجد لأم'],
    ['maternalGrandmother', 'الجدة لأم'],
  ];
  for (const [key, label] of grandparentSlots) {
    const member = family.grandparents[key];
    const n = formatMemberName(member);
    if (n !== '—' && n.trim().length > 0) {
      opts.push({ value: `grandparent-${key}`, label: `${label} — ${n}` });
    }
  }
  (Object.keys(family.relatives) as RelativeKind[]).forEach((kind) => {
    family.relatives[kind].forEach((m, i) => {
      const n = formatMemberName(m);
      if (n !== '—' && n.trim().length > 0) {
        opts.push({
          value: `relative-${kind}-${i}`,
          label: `${RELATIVE_LABEL[kind].singular} ${i + 1} — ${n}`,
        });
      }
    });
  });
  return opts;
}

function pickGuardianMember(family: FamilyDataSnapshot, source: GuardianSource): FamilyMemberForm | null {
  if (source === 'mother') return family.mother;
  if (source.startsWith('fatherWife-')) {
    const i = Number(source.slice('fatherWife-'.length));
    return family.fatherWives[i] ?? null;
  }
  if (source.startsWith('motherHusband-')) {
    const i = Number(source.slice('motherHusband-'.length));
    return family.motherHusbands[i] ?? null;
  }
  if (source.startsWith('grandparent-')) {
    const which = source.slice('grandparent-'.length) as keyof GrandparentsForm;
    return family.grandparents[which];
  }
  if (source.startsWith('relative-')) {
    const rest = source.slice('relative-'.length);
    /* `relative-<kind>-<index>` — kind itself contains hyphens
     * (e.g. `paternal_uncles`), so split from the right. */
    const lastDash = rest.lastIndexOf('-');
    const kind = rest.slice(0, lastDash) as RelativeKind;
    const idx = Number(rest.slice(lastDash + 1));
    return family.relatives[kind]?.[idx] ?? null;
  }
  return null;
}

/** Copy a family-member record into Guardian fields. */
function applyMemberToGuardian(
  member: FamilyMemberForm,
  current: VothiqaTaarufDocument['parents']['guardian'],
): VothiqaTaarufDocument['parents']['guardian'] {
  const name = formatMemberName(member);
  return {
    ...current,
    fullName: name === '—' ? '' : name,
    shuhraName: member.shuhra ?? '',
    dateOfBirth: member.dateOfBirth,
    birthPlace: [member.birthDistrict, member.birthGovernorate].filter(Boolean).join(' — '),
    qualification: member.qualification,
    profession: member.profession,
    seniorityNumber: member.seniorityNumber ?? '',
    workplace: member.professionDetail,
    workNature: member.qualificationDetail,
    address: [member.residenceDetail, member.residenceDistrict, member.residenceGovernorate]
      .filter(Boolean)
      .join(' — '),
    nationality: 'مصرية',
    governorate: member.residenceGovernorate,
    religion: member.religion,
    nationalId: member.nationalId,
    /* familyData doesn't carry a mobile field — keep whatever the
     * user typed earlier, otherwise leave blank for them to fill. */
    mobile: current.mobile,
  };
}

export function Stage11AcquaintanceDocPage(): JSX.Element {
  const nationalId = useApplicantPortalStore((s) => s.nationalId);
  const moiSession = useApplicantPortalStore((s) => s.moiSession);
  const applicantId = nationalId || 'current';
  const docQuery = useAcquaintanceDoc(applicantId);
  const saveDoc = useSaveAcquaintanceDoc(applicantId);
  const printableDoc = usePrintableAcquaintanceDoc(applicantId);
  const backendStatus = docQuery.data?.status;
  const isLocked = !backendStatus?.canEdit;

  /* Derive a local fallback once, then hydrate it from the backend document. */
  const [doc, setDoc] = useState<VothiqaTaarufDocument>(() => {
    const family = loadFamilySnapshot();
    return deriveInitialDocument({
      moiSession,
      familySnapshot: family,
      admissionYear: '2026',
    });
  });
  const [docVersion, setDocVersion] = useState<number | null>(null);
  const [hasHydratedBackendDoc, setHasHydratedBackendDoc] = useState(false);
  const lastSyncedDocJsonRef = useRef<string | null>(null);
  const localEditSeqRef = useRef(0);
  const lastSyncedEditSeqRef = useRef(0);
  const blockedConflictDocJsonRef = useRef<string | null>(null);
  const forceHydrateFromServerRef = useRef(false);
  const hasShownConflictToastRef = useRef(false);

  useEffect(() => {
    if (!docQuery.data?.document) return;
    const next = normalizeBackendDocument(docQuery.data.document);
    const incomingVersion = docQuery.data.version ?? docQuery.data.status.version ?? null;
    const hasUnsyncedLocalEdits = localEditSeqRef.current > lastSyncedEditSeqRef.current;
    if (hasHydratedBackendDoc && hasUnsyncedLocalEdits && !forceHydrateFromServerRef.current) {
      setDocVersion(incomingVersion);
      return;
    }
    forceHydrateFromServerRef.current = false;
    setDoc(next);
    setDocVersion(incomingVersion);
    lastSyncedDocJsonRef.current = stringifyDocument(next);
    lastSyncedEditSeqRef.current = localEditSeqRef.current;
    blockedConflictDocJsonRef.current = null;
    setHasHydratedBackendDoc(true);
  }, [
    docQuery.data?.document,
    docQuery.data?.status.version,
    docQuery.data?.version,
    hasHydratedBackendDoc,
  ]);

  useEffect(() => {
    if (!hasHydratedBackendDoc || !backendStatus?.canEdit || saveDoc.isPending) return;
    const serialized = stringifyDocument(doc);
    if (
      serialized === lastSyncedDocJsonRef.current ||
      serialized === blockedConflictDocJsonRef.current
    ) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      const savedEditSeq = localEditSeqRef.current;
      saveDoc.mutate(withDocumentVersion(doc, docVersion), {
        onSuccess: (result) => {
          if (localEditSeqRef.current === savedEditSeq && result.document) {
            const next = normalizeBackendDocument(result.document);
            lastSyncedDocJsonRef.current = stringifyDocument(next);
            lastSyncedEditSeqRef.current = savedEditSeq;
          } else if (localEditSeqRef.current === savedEditSeq) {
            lastSyncedDocJsonRef.current = serialized;
            lastSyncedEditSeqRef.current = savedEditSeq;
          }
          setDocVersion(result.version ?? result.status.version ?? docVersion);
          blockedConflictDocJsonRef.current = null;
          hasShownConflictToastRef.current = false;
        },
        onError: (error) => {
          if (isPreconditionError(error)) {
            blockedConflictDocJsonRef.current = serialized;
            if (!hasShownConflictToastRef.current) {
              toast('تم تحديث نسخة وثيقة التعارف من الخادم. راجع آخر تعديل ثم أكمل.', 'warning');
              hasShownConflictToastRef.current = true;
            }
            forceHydrateFromServerRef.current = true;
            void docQuery.refetch();
          }
        },
      });
    }, 900);
    return () => window.clearTimeout(timeoutId);
  }, [backendStatus?.canEdit, doc, docQuery.refetch, docVersion, hasHydratedBackendDoc, saveDoc]);

  const [expanded, setExpanded] = useState<GroupKey>('personal');
  const [completed, setCompleted] = useState<Record<GroupKey, boolean>>(() =>
    Object.fromEntries(GROUP_KEYS.map((k) => [k, false])) as Record<GroupKey, boolean>,
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  /* Print-only mirror — mounted as a sibling of <body> via createPortal
   * so it escapes the Drawer's overflow:auto scroll container that
   * would otherwise clip the 35-page document to one viewport-worth.
   * Hidden on screen; revealed by the `body:has(#vothiqa-print-portal)`
   * @media print rules in PrintableDocument. */
  const [printing, setPrinting] = useState(false);
  const [printDoc, setPrintDoc] = useState<VothiqaTaarufDocument | null>(null);

  useEffect(() => {
    if (!printing) return;
    /* Two RAFs: first lets React commit the portal, second lets the
     * browser layout the printable tree before we invoke window.print. */
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        window.print();
        setPrinting(false);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [printing]);

  const handlePrint = useCallback((): void => {
    if (!backendStatus?.canPrint) {
      toast('لا يمكن طباعة وثيقة التعارف قبل غلقها من النظام.', 'warning');
      return;
    }
    printableDoc.mutate(undefined, {
      onSuccess: (result) => {
        if (result.document) {
          const next = normalizeBackendDocument(result.document);
          setPrintDoc(next);
          setPrinting(true);
        }
      },
      onError: (error) => {
        toast(error instanceof Error ? error.message : 'تعذر تجهيز النسخة النهائية للطباعة.', 'danger');
      },
    });
  }, [backendStatus?.canPrint, printableDoc]);

  /* Patch a top-level section of the doc by key. */
  const patchSection = useCallback(
    <K extends GroupKey>(key: K, next: VothiqaTaarufDocument[K]): void => {
      localEditSeqRef.current += 1;
      setDoc((d) => ({ ...d, [key]: next }));
    },
    [],
  );

  const onGroupComplete = (key: GroupKey): void => {
    setCompleted((c) => ({ ...c, [key]: true }));
    const idx = GROUP_KEYS.indexOf(key);
    const next = GROUP_KEYS[idx + 1];
    if (next) {
      setExpanded(next);
    } else {
      setPreviewOpen(true);
    }
  };

  const handleSubmit = (): void => {
    const serialized = stringifyDocument(doc);
    const savedEditSeq = localEditSeqRef.current;
    saveDoc.mutate(withDocumentVersion(doc, docVersion), {
      onSuccess: (result) => {
        setDocVersion(result.version ?? result.status.version ?? docVersion);
        if (localEditSeqRef.current === savedEditSeq && result.document) {
          lastSyncedDocJsonRef.current = stringifyDocument(normalizeBackendDocument(result.document));
          lastSyncedEditSeqRef.current = savedEditSeq;
        } else if (localEditSeqRef.current === savedEditSeq) {
          lastSyncedDocJsonRef.current = serialized;
          lastSyncedEditSeqRef.current = savedEditSeq;
        }
        blockedConflictDocJsonRef.current = null;
        hasShownConflictToastRef.current = false;
        toast('تم حفظ وثيقة التعارف تلقائياً.', 'success');
        setPreviewOpen(false);
      },
      onError: (error) => {
        if (isPreconditionError(error)) {
          blockedConflictDocJsonRef.current = serialized;
          toast('تم تحديث نسخة وثيقة التعارف من الخادم. راجع آخر تعديل ثم حاول الحفظ مرة أخرى.', 'warning');
          forceHydrateFromServerRef.current = true;
          void docQuery.refetch();
          return;
        }
        toast(error instanceof Error ? error.message : 'تعذر حفظ وثيقة التعارف.', 'danger');
      },
    });
  };

  if (docQuery.isLoading) {
    return <LoadingState variant="page" label="جاري تحميل وثيقة التعارف" />;
  }

  if (docQuery.error) {
    return (
      <ErrorState
        title="تعذر تحميل وثيقة التعارف"
        description={docQuery.error instanceof Error ? docQuery.error.message : undefined}
        onRetry={() => void docQuery.refetch()}
      />
    );
  }

  if (backendStatus && !backendStatus.isOpen && !backendStatus.isClosed) {
    return <AcquaintanceDocLockedState openingTestKey={backendStatus.openingTestKey} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="rounded-lg border border-border-default bg-surface-card p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-ar-display text-xl font-bold text-ink-900">
              وثيقة تعارف 
            </h2>
            <p className="mt-1 text-sm text-ink-500 leading-relaxed">
              املأ المجموعات بالترتيب. يتم حفظ التعديلات تلقائياً، وتظهر الطباعة النهائية بعد غلق الوثيقة من النظام.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              leadingIcon={<Eye size={14} strokeWidth={1.75} />}
              onClick={() => setPreviewOpen(true)}
            >
              معاينة الطباعة
            </Button>
            {backendStatus?.canPrint && (
              <Button
                type="button"
                variant="ghost"
                leadingIcon={<Printer size={14} strokeWidth={1.75} />}
                onClick={handlePrint}
                disabled={printableDoc.isPending}
              >
                طباعة وثيقة التعارف
              </Button>
            )}
          </div>
        </div>

        {backendStatus?.isClosed && (
          <div
            role="status"
            className="mt-3 flex items-start gap-3 rounded-md border border-gold-300 bg-gold-50 px-4 py-3 text-sm text-gold-700"
          >
            <Lock size={18} strokeWidth={1.75} className="mt-0.5 flex-shrink-0" />
            <p className="leading-relaxed">
              <span className="font-bold">انتهت فترة التعديل.</span>{' '}
              يمكنك الآن العرض أو الطباعة فقط، ولا يمكن تغيير أيٍّ من البيانات.
            </p>
          </div>
        )}

        {backendStatus?.canEdit && (
          <div
            role="status"
            className="mt-3 flex items-start gap-3 rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-700"
          >
            <FileCheck size={18} strokeWidth={1.75} className="mt-0.5 flex-shrink-0" />
            <p className="leading-relaxed">
              {saveDoc.isPending
                ? 'جاري حفظ التعديلات...'
                : saveDoc.isError
                  ? 'تعذر حفظ آخر تعديل. راجع الاتصال ثم حاول مرة أخرى.'
                  : backendStatus.lastAutosavedAt
                    ? `آخر حفظ تلقائي: ${formatSavedAt(backendStatus.lastAutosavedAt)}`
                    : 'الوثيقة مفتوحة للتعديل وسيتم حفظ التغييرات تلقائياً.'}
            </p>
          </div>
        )}
      </header>

      <ProgressStrip completed={completed} expanded={expanded} />

      {/* Group 1 — Personal */}
      <AccordionGroup
        index={0}
        total={GROUP_KEYS.length}
        label={GROUP_LABELS.personal}
        expanded={expanded === 'personal'}
        complete={completed.personal}
        readOnly={isLocked}
        onToggle={() => setExpanded(expanded === 'personal' ? 'applicantFamily' : 'personal')}
        onComplete={() => onGroupComplete('personal')}
        validate={() => validatePersonal(doc)}
      >
        <PersonalGroup
          value={doc.personal}
          onChange={(next) => patchSection('personal', next)}
          readOnly={isLocked}
        />
      </AccordionGroup>

      {/* Group 2 — Applicant's spouse + children (married only) */}
      <AccordionGroup
        index={1}
        total={GROUP_KEYS.length}
        label={GROUP_LABELS.applicantFamily}
        expanded={expanded === 'applicantFamily'}
        complete={completed.applicantFamily}
        readOnly={isLocked}
        onToggle={() => setExpanded(expanded === 'applicantFamily' ? 'parents' : 'applicantFamily')}
        onComplete={() => onGroupComplete('applicantFamily')}
        validate={() => validateApplicantFamily(doc)}
      >
        <ApplicantFamilyGroup
          value={doc.applicantFamily}
          onChange={(next) => patchSection('applicantFamily', next)}
          maritalStatus={doc.personal.personal.maritalStatus}
          gender={moiSession?.gender ?? 'male'}
          readOnly={isLocked}
        />
      </AccordionGroup>

      {/* Group 3 — Parents + guardian */}
      <AccordionGroup
        index={2}
        total={GROUP_KEYS.length}
        label={GROUP_LABELS.parents}
        expanded={expanded === 'parents'}
        complete={completed.parents}
        readOnly={isLocked}
        onToggle={() => setExpanded(expanded === 'parents' ? 'grandparents' : 'parents')}
        onComplete={() => onGroupComplete('parents')}
        validate={() => validateParents(doc)}
      >
        <ParentsGroup
          value={doc.parents}
          onChange={(next) => patchSection('parents', next)}
          studentDob={doc.personal.personal.dateOfBirth}
          readOnly={isLocked}
        />
      </AccordionGroup>

      {/* Group 4 — Grandparents */}
      <AccordionGroup
        index={3}
        total={GROUP_KEYS.length}
        label={GROUP_LABELS.grandparents}
        expanded={expanded === 'grandparents'}
        complete={completed.grandparents}
        readOnly={isLocked}
        onToggle={() => setExpanded(expanded === 'grandparents' ? 'siblings' : 'grandparents')}
        onComplete={() => onGroupComplete('grandparents')}
        validate={() => validateGrandparents(doc)}
      >
        <GrandparentsGroup
          value={doc.grandparents}
          onChange={(next) => patchSection('grandparents', next)}
          fatherDob={doc.parents.father.dateOfBirth}
          motherDob={doc.parents.mother.dateOfBirth}
          readOnly={isLocked}
        />
      </AccordionGroup>

      {/* Group 5 — Siblings + their children */}
      <AccordionGroup
        index={4}
        total={GROUP_KEYS.length}
        label={GROUP_LABELS.siblings}
        expanded={expanded === 'siblings'}
        complete={completed.siblings}
        readOnly={isLocked}
        onToggle={() => setExpanded(expanded === 'siblings' ? 'paternalRelatives' : 'siblings')}
        onComplete={() => onGroupComplete('siblings')}
        validate={() => validateList(doc.siblings)}
      >
        <SiblingsGroup
          value={doc.siblings}
          onChange={(next) => patchSection('siblings', next)}
          readOnly={isLocked}
        />
      </AccordionGroup>

      {/* Group 6 — Paternal relatives */}
      <AccordionGroup
        index={5}
        total={GROUP_KEYS.length}
        label={GROUP_LABELS.paternalRelatives}
        expanded={expanded === 'paternalRelatives'}
        complete={completed.paternalRelatives}
        readOnly={isLocked}
        onToggle={() => setExpanded(expanded === 'paternalRelatives' ? 'maternalRelatives' : 'paternalRelatives')}
        onComplete={() => onGroupComplete('paternalRelatives')}
        validate={() => validateList(doc.paternalRelatives)}
      >
        <PaternalRelativesGroup
          value={doc.paternalRelatives}
          onChange={(next) => patchSection('paternalRelatives', next)}
          readOnly={isLocked}
        />
      </AccordionGroup>

      {/* Group 7 — Maternal relatives */}
      <AccordionGroup
        index={6}
        total={GROUP_KEYS.length}
        label={GROUP_LABELS.maternalRelatives}
        expanded={expanded === 'maternalRelatives'}
        complete={completed.maternalRelatives}
        readOnly={isLocked}
        onToggle={() => setExpanded(expanded === 'maternalRelatives' ? 'foreignAndCases' : 'maternalRelatives')}
        onComplete={() => onGroupComplete('maternalRelatives')}
        validate={() => validateList(doc.maternalRelatives)}
      >
        <MaternalRelativesGroup
          value={doc.maternalRelatives}
          onChange={(next) => patchSection('maternalRelatives', next)}
          readOnly={isLocked}
        />
      </AccordionGroup>

      {/* Group 8 — Foreign + criminal cases */}
      <AccordionGroup
        index={7}
        total={GROUP_KEYS.length}
        label={GROUP_LABELS.foreignAndCases}
        expanded={expanded === 'foreignAndCases'}
        complete={completed.foreignAndCases}
        readOnly={isLocked}
        nextLabel="إنهاء وعرض المعاينة"
        onToggle={() => setExpanded('foreignAndCases')}
        onComplete={() => onGroupComplete('foreignAndCases')}
        validate={() => validateForeignAndCases(doc)}
      >
        <ForeignAndCasesGroup
          value={doc.foreignAndCases}
          onChange={(next) => patchSection('foreignAndCases', next)}
          readOnly={isLocked}
        />
      </AccordionGroup>

      <Drawer
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="معاينة وثيقة التعارف"
        subtitle="هذه هي النسخة التي ستُطبع. تأكَّد من البيانات قبل الاعتماد."
        size="lg"
        transparentBackdrop={false}
      >
        <div className="flex h-full flex-col">
          <div className="flex flex-wrap items-center justify-end gap-2 border-b border-border-subtle bg-surface-card px-4 py-3 no-print">
            {backendStatus?.canPrint && (
              <Button
                type="button"
                variant="secondary"
                leadingIcon={<Printer size={14} strokeWidth={1.75} />}
                onClick={handlePrint}
                disabled={printableDoc.isPending}
              >
                طباعة
              </Button>
            )}
            {!isLocked && (
              <Button
                type="button"
                variant="primary"
                leadingIcon={<Save size={14} strokeWidth={1.75} />}
                onClick={handleSubmit}
                disabled={saveDoc.isPending}
              >
                حفظ الآن
              </Button>
            )}
          </div>
          <div className="flex-1 overflow-auto bg-ink-50 p-4">
            <PrintableDocument doc={doc} />
          </div>
        </div>
      </Drawer>

      {printing &&
        createPortal(
          <div id="vothiqa-print-portal">
            <PrintableDocument doc={printDoc ?? doc} />
          </div>,
          document.body,
        )}
    </div>
  );
}

function AcquaintanceDocLockedState({ openingTestKey }: { openingTestKey?: string }): JSX.Element {
  return (
    <div className="rounded-lg border border-border-default bg-surface-card p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-50 text-gold-700">
          <Lock size={20} strokeWidth={1.75} aria-hidden />
        </span>
        <div>
          <h2 className="font-ar-display text-xl font-bold text-ink-900">
            وثيقة التعارف غير متاحة حالياً
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
            يتم فتح وثيقة التعارف بعد اجتياز الاختبار المحدد من إدارة النظام
            {openingTestKey ? ` (${openingTestKey})` : ''}. ستظهر البيانات المحفوظة تلقائياً عند فتح الوثيقة.
          </p>
        </div>
      </div>
    </div>
  );
}

function normalizeBackendDocument(partial: Partial<VothiqaTaarufDocument>): VothiqaTaarufDocument {
  const empty = emptyDocument();
  return {
    ...empty,
    ...partial,
    personal: { ...empty.personal, ...partial.personal },
    applicantFamily: { ...empty.applicantFamily, ...partial.applicantFamily },
    parents: { ...empty.parents, ...partial.parents },
    grandparents: { ...empty.grandparents, ...partial.grandparents },
    siblings: { ...empty.siblings, ...partial.siblings },
    paternalRelatives: { ...empty.paternalRelatives, ...partial.paternalRelatives },
    maternalRelatives: { ...empty.maternalRelatives, ...partial.maternalRelatives },
    foreignAndCases: { ...empty.foreignAndCases, ...partial.foreignAndCases },
  };
}

function stringifyDocument(doc: VothiqaTaarufDocument): string {
  return JSON.stringify(doc);
}

function withDocumentVersion(
  doc: VothiqaTaarufDocument,
  version: number | null,
): VothiqaTaarufDocument & { version?: number } {
  return version == null ? doc : { ...doc, version };
}

function isPreconditionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes('412') ||
    error.message.includes('Precondition') ||
    error.name === 'PRECONDITION_FAILED' ||
    error.name === 'PreconditionFailed'
  );
}

function formatSavedAt(value: number): string {
  return new Intl.DateTimeFormat('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(value));
}

/* ────────────────────────────────────────────────────────────────────
 * Progress strip
 * ──────────────────────────────────────────────────────────────────── */

function ProgressStrip({
  completed,
  expanded,
}: {
  completed: Record<GroupKey, boolean>;
  expanded: GroupKey;
}): JSX.Element {
  const completedCount = GROUP_KEYS.filter((k) => completed[k]).length;
  return (
    <div className="sticky top-16 z-10 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-default bg-surface-card px-4 py-2 shadow-sm">
      <p className="text-xs text-ink-700">
        التقدّم: <span className="font-bold text-teal-700">{completedCount}</span> من{' '}
        <span className="font-bold">{GROUP_KEYS.length}</span> مجموعات
      </p>
      <div className="flex gap-1">
        {GROUP_KEYS.map((k, i) => (
          <span
            key={k}
            title={GROUP_LABELS[k]}
            className={`h-2 w-6 rounded-pill transition-colors ${
              completed[k]
                ? 'bg-teal-500'
                : expanded === k
                  ? 'bg-teal-200'
                  : 'bg-ink-200'
            }`}
            aria-label={`المجموعة ${i + 1}: ${GROUP_LABELS[k]} — ${completed[k] ? 'مكتملة' : expanded === k ? 'مفتوحة' : 'لم تبدأ'}`}
          />
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * Group 1 — Personal + housing + income (نموذج 1, 5, 6)
 * ──────────────────────────────────────────────────────────────────── */

interface PersonalGroupProps {
  value: VothiqaTaarufDocument['personal'];
  onChange: (next: VothiqaTaarufDocument['personal']) => void;
  readOnly?: boolean;
}

function PersonalGroup({ value, onChange, readOnly }: PersonalGroupProps): JSX.Element {
  const setPersonal = (patch: Partial<VothiqaTaarufDocument['personal']['personal']>): void =>
    onChange({ ...value, personal: { ...value.personal, ...patch } });
  const setCover = (patch: Partial<VothiqaTaarufDocument['personal']['cover']>): void =>
    onChange({ ...value, cover: { ...value.cover, ...patch } });
  const setHousing = (patch: Partial<VothiqaTaarufDocument['personal']['housing']>): void =>
    onChange({ ...value, housing: { ...value.housing, ...patch } });
  const setIncome = (patch: Partial<VothiqaTaarufDocument['personal']['income']>): void =>
    onChange({ ...value, income: { ...value.income, ...patch } });

  return (
    <>
      <RecordGrid formNumber="غلاف" title="الغلاف — بيانات التعريف" hint="تظهر هذه البيانات على صفحة الغلاف للنسخة المطبوعة." cols={2}>
        <Cell label="اسم الطالب" required value={value.cover.fullName} onChange={(v) => setCover({ fullName: v })} disabled={readOnly} colSpan={2} />
        <Cell label="رقم الملف" required value={value.cover.fileNumber} onChange={(v) => setCover({ fileNumber: v })} disabled={readOnly} dir="ltr" />
        <Cell label="سنة التقدم للالتحاق" required value={value.cover.admissionYear} onChange={(v) => setCover({ admissionYear: v })} disabled={readOnly} dir="ltr" />
        <Cell label="اللجنة" required value={value.cover.committee} onChange={(v) => setCover({ committee: v })} disabled={readOnly} />
        <Cell label="المحافظة" required value={value.cover.governorate} onChange={(v) => setCover({ governorate: v })} disabled={readOnly} />
      </RecordGrid>

      <RecordGrid formNumber="نموذج 1" title="بيانات الطالب الشخصية" cols={2}>
        <Cell label="اسم الطالب" required value={value.personal.fullName} onChange={(v) => setPersonal({ fullName: v })} disabled={readOnly} colSpan={2} />
        <Cell label="اسم الشهرة" value={value.personal.shuhraName} onChange={(v) => setPersonal({ shuhraName: v })} disabled={readOnly} />
        <Cell label="اللجنة" required value={value.personal.committee} onChange={(v) => setPersonal({ committee: v })} disabled={readOnly} />
        <Cell label="تاريخ الميلاد" required type="date" value={value.personal.dateOfBirth} onChange={(v) => setPersonal({ dateOfBirth: v })} disabled={readOnly} />
        <Cell label="محل الميلاد" required value={value.personal.birthPlace} onChange={(v) => setPersonal({ birthPlace: v })} disabled={readOnly} />
        <Cell label="الجنسية" required type="select" options={NATIONALITY_OPTIONS} value={value.personal.nationality} onChange={(v) => setPersonal({ nationality: v })} disabled={readOnly} />
        <Cell label="الديانة" required type="select" options={RELIGION_OPTIONS} value={value.personal.religion} onChange={(v) => setPersonal({ religion: v })} disabled={readOnly} />
        <Cell label="المحافظة" required type="select" options={GOVERNORATE_OPTIONS} value={value.personal.governorate} onChange={(v) => setPersonal({ governorate: v })} disabled={readOnly} />
        <Cell label="الرقم القومي" required dir="ltr" value={value.personal.nationalId} onChange={(v) => setPersonal({ nationalId: v })} disabled={readOnly} />
        <Cell label="المؤهل / الشعبة" required value={value.personal.qualificationOrTrack} onChange={(v) => setPersonal({ qualificationOrTrack: v })} disabled={readOnly} />
        <Cell label="سنة الحصول على المؤهل" required dir="ltr" value={value.personal.qualificationYear} onChange={(v) => setPersonal({ qualificationYear: v })} disabled={readOnly} />
        <Cell label="مجموع الدرجات" required dir="ltr" value={value.personal.totalGrades} onChange={(v) => setPersonal({ totalGrades: v })} disabled={readOnly} />
        <Cell label="النسبة المئوية %" required dir="ltr" value={value.personal.gradesPercent} onChange={(v) => setPersonal({ gradesPercent: v })} disabled={readOnly} />
        <Cell label="تليفون المنزل" dir="ltr" value={value.personal.homePhone} onChange={(v) => setPersonal({ homePhone: v })} disabled={readOnly} />
        <Cell label="المحمول" required dir="ltr" value={value.personal.mobile} onChange={(v) => setPersonal({ mobile: v })} disabled={readOnly} />
        <Cell
          label="الحالة الاجتماعية"
          required
          type="select"
          value={value.personal.maritalStatus}
          onChange={(v) => setPersonal({ maritalStatus: v as 'single' | 'married' | '' })}
          options={[
            { value: 'single', label: 'أعزب' },
            { value: 'married', label: 'متزوج' },
          ]}
          disabled={readOnly}
        />
        <Cell label="العنوان" required type="textarea" value={value.personal.address} onChange={(v) => setPersonal({ address: v })} disabled={readOnly} colSpan={2} />
      </RecordGrid>

      <RecordGrid formNumber="نموذج 5" title="بيانات مسكن الأسرة" cols={3}>
        <Cell label="نوع المسكن" required type="select" options={HOUSING_TYPE_OPTIONS} value={value.housing.housingType} onChange={(v) => setHousing({ housingType: v })} disabled={readOnly} />
        <Cell label="عدد الغرف" required type="number" value={value.housing.roomsCount} onChange={(v) => setHousing({ roomsCount: v })} disabled={readOnly} />
        <Cell label="عدد المقيمين بالمسكن" required type="number" value={value.housing.residentsCount} onChange={(v) => setHousing({ residentsCount: v })} disabled={readOnly} />
      </RecordGrid>

      <RecordGrid formNumber="نموذج 6" title="بيانات دخل الأسرة" cols={1}>
        <Cell label="تفصيلات الدخل" required type="textarea" rows={4} value={value.income.incomeDetails} onChange={(v) => setIncome({ incomeDetails: v })} disabled={readOnly} />
        <Cell label="إجمالي الدخل" required value={value.income.totalIncome} onChange={(v) => setIncome({ totalIncome: v })} disabled={readOnly} />
      </RecordGrid>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * Group 2 — Applicant's spouse + children (married applicants only)
 *
 * Used by Case 2 (الضباط المتخصصون) and Case 3 (ليسانس حقوق) demo
 * users where the applicant can be a married professional. Single
 * applicants see a brief notice instead of the form fields.
 * ──────────────────────────────────────────────────────────────────── */

interface ApplicantFamilyGroupProps {
  value: VothiqaTaarufDocument['applicantFamily'];
  onChange: (next: VothiqaTaarufDocument['applicantFamily']) => void;
  maritalStatus: 'single' | 'married' | '';
  gender: 'male' | 'female';
  readOnly?: boolean;
}

function ApplicantFamilyGroup({
  value,
  onChange,
  maritalStatus,
  gender,
  readOnly,
}: ApplicantFamilyGroupProps): JSX.Element {
  /* Single applicants don't fill this — show the notice + nothing else.
   * The «التالي» button on the parent AccordionGroup still works
   * because validateApplicantFamily() returns null when single. */
  if (maritalStatus !== 'married') {
    return (
      <div className="rounded-md border border-dashed border-border-default bg-ink-50 px-4 py-6 text-center text-sm text-ink-600">
        <p className="font-medium">هذه المجموعة للمتقدمين المتزوجين فقط.</p>
        <p className="mt-1 text-2xs text-ink-500">
          حالتك الحالية «أعزب» — اضغط «التالي» للانتقال إلى المجموعة التالية.
          إذا كنت متزوجاً، عد إلى المجموعة الأولى وحدّث الحالة الاجتماعية.
        </p>
      </div>
    );
  }

  const spouseLabel = gender === 'female' ? 'الزوج' : 'الزوجة';
  const spouseTitle =
    gender === 'female'
      ? 'بيانات زوج الطالبة'
      : 'بيانات زوجة الطالب';
  const secondSpouseTitle =
    gender === 'female'
      ? 'بيانات الزوج السابق إن وجد'
      : 'بيانات الزوجة الثانية إن وجدت';

  const setSpouse = (patch: Partial<ApplicantSpouseRecord>): void =>
    onChange({ ...value, spouse: { ...value.spouse, ...patch } });
  const setSecondSpouse = (patch: Partial<ApplicantSpouseRecord>): void =>
    onChange({ ...value, secondSpouse: { ...value.secondSpouse, ...patch } });

  return (
    <>
      <RecordGrid formNumber="نموذج 2" title={spouseTitle} cols={2}>
        <Cell label={`اسم ${spouseLabel}`} required value={value.spouse.fullName} onChange={(v) => setSpouse({ fullName: v })} disabled={readOnly} colSpan={2} />
        <Cell label="الجنسية" required type="select" options={NATIONALITY_OPTIONS} value={value.spouse.nationality} onChange={(v) => setSpouse({ nationality: v })} disabled={readOnly} />
        <Cell label="تاريخ الميلاد" required type="date" value={value.spouse.dateOfBirth} onChange={(v) => setSpouse({ dateOfBirth: v })} disabled={readOnly} />
        <Cell label="محل الميلاد" required value={value.spouse.birthPlace} onChange={(v) => setSpouse({ birthPlace: v })} disabled={readOnly} />
        <Cell label="الديانة" required type="select" options={gender === 'female' ? RELIGION_OPTIONS : RELIGION_OPTIONS_FEMALE} value={value.spouse.religion} onChange={(v) => setSpouse({ religion: v })} disabled={readOnly} />
        <Cell label="المؤهل" required type="select" options={QUALIFICATION_OPTIONS} value={value.spouse.qualification} onChange={(v) => setSpouse({ qualification: v })} disabled={readOnly} />
        <Cell label="الوظيفة" required type="select" options={PROFESSION_OPTIONS} value={value.spouse.profession} onChange={(v) => setSpouse({ profession: v })} disabled={readOnly} />
        {isOfficer(value.spouse.profession) && (
          <Cell label="رقم الأقدمية" required dir="ltr" value={value.spouse.seniorityNumber} onChange={(v) => setSpouse({ seniorityNumber: v })} disabled={readOnly} />
        )}
        <Cell label="جهة العمل" value={value.spouse.workplace} onChange={(v) => setSpouse({ workplace: v })} disabled={readOnly} />
        <Cell label="العمل القائم به" value={value.spouse.workNature} onChange={(v) => setSpouse({ workNature: v })} disabled={readOnly} />
        <Cell label="العنوان" required type="textarea" value={value.spouse.address} onChange={(v) => setSpouse({ address: v })} disabled={readOnly} colSpan={2} />
        <Cell label="التليفون" dir="ltr" value={value.spouse.homePhone} onChange={(v) => setSpouse({ homePhone: v })} disabled={readOnly} />
        <Cell label="المحمول" dir="ltr" value={value.spouse.mobile} onChange={(v) => setSpouse({ mobile: v })} disabled={readOnly} />
        <Cell label="الرقم القومي" dir="ltr" value={value.spouse.nationalId} onChange={(v) => setSpouse({ nationalId: v })} disabled={readOnly} colSpan={2} />
        <Cell
          label={
            gender === 'female'
              ? 'هل سبق لكِ الزواج من شخص آخر؟'
              : 'هل لديك زوجة ثانية؟'
          }
          type="checkbox"
          checkboxLabel="نعم"
          value={value.hasSecondSpouse}
          onChange={(v) => onChange({ ...value, hasSecondSpouse: v })}
          disabled={readOnly}
          colSpan={2}
        />
      </RecordGrid>

      {value.hasSecondSpouse && (
        <RecordGrid formNumber="نموذج 3" title={secondSpouseTitle} cols={2}>
          <Cell label={`اسم ${spouseLabel}`} required value={value.secondSpouse.fullName} onChange={(v) => setSecondSpouse({ fullName: v })} disabled={readOnly} colSpan={2} />
          <Cell label="تاريخ الميلاد" type="date" value={value.secondSpouse.dateOfBirth} onChange={(v) => setSecondSpouse({ dateOfBirth: v })} disabled={readOnly} />
          <Cell label="محل الميلاد" value={value.secondSpouse.birthPlace} onChange={(v) => setSecondSpouse({ birthPlace: v })} disabled={readOnly} />
          <Cell label="المؤهل" type="select" options={QUALIFICATION_OPTIONS} value={value.secondSpouse.qualification} onChange={(v) => setSecondSpouse({ qualification: v })} disabled={readOnly} />
          <Cell label="الوظيفة" type="select" options={PROFESSION_OPTIONS} value={value.secondSpouse.profession} onChange={(v) => setSecondSpouse({ profession: v })} disabled={readOnly} />
          {isOfficer(value.secondSpouse.profession) && (
            <Cell label="رقم الأقدمية" required dir="ltr" value={value.secondSpouse.seniorityNumber} onChange={(v) => setSecondSpouse({ seniorityNumber: v })} disabled={readOnly} />
          )}
          <Cell label="جهة العمل" value={value.secondSpouse.workplace} onChange={(v) => setSecondSpouse({ workplace: v })} disabled={readOnly} />
          <Cell label="الرقم القومي" dir="ltr" value={value.secondSpouse.nationalId} onChange={(v) => setSecondSpouse({ nationalId: v })} disabled={readOnly} colSpan={2} />
        </RecordGrid>
      )}

      <AdultListPanel
        formNumber="نموذج 12"
        title="بيانات أبناء الطالب الذكور وزوجاتهم"
        itemSingular="ابن"
        value={value.sons}
        onChange={(n) => onChange({ ...value, sons: n })}
        readOnly={readOnly}
      />
      <AdultListPanel
        formNumber="نموذج 12/1"
        title="بيانات بنات الطالب وأزواجهن"
        itemSingular="ابنة"
        value={value.daughters}
        onChange={(n) => onChange({ ...value, daughters: n })}
        readOnly={readOnly}
      />
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * Group 3 — Parents + guardian (نموذج 2, 3, 4)
 * ──────────────────────────────────────────────────────────────────── */

interface ParentsGroupProps {
  value: VothiqaTaarufDocument['parents'];
  onChange: (next: VothiqaTaarufDocument['parents']) => void;
  studentDob: string;
  readOnly?: boolean;
}

function ParentsGroup({ value, onChange, studentDob, readOnly }: ParentsGroupProps): JSX.Element {
  const setFather = (patch: Partial<VothiqaTaarufDocument['parents']['father']>): void =>
    onChange({ ...value, father: { ...value.father, ...patch } });
  const setMother = (patch: Partial<VothiqaTaarufDocument['parents']['mother']>): void =>
    onChange({ ...value, mother: { ...value.mother, ...patch } });
  const setGuardian = (patch: Partial<VothiqaTaarufDocument['parents']['guardian']>): void =>
    onChange({ ...value, guardian: { ...value.guardian, ...patch } });

  /* Guardian picker — loaded once per mount. The list reflects whatever
   * Stage 7 captured at the time this page was opened; refreshing the
   * tab after editing Stage 7 picks up changes. */
  const family = useMemo(() => loadFamilySnapshot(), []);
  const guardianOptions = useMemo(() => buildGuardianMemberOptions(family), [family]);
  const [guardianSource, setGuardianSource] = useState<GuardianSource | ''>('');

  const handleGuardianSourceChange = (next: GuardianSource | ''): void => {
    setGuardianSource(next);
    if (!next || next === 'manual') return;
    if (!family) return;
    const member = pickGuardianMember(family, next);
    if (member) {
      onChange({ ...value, guardian: applyMemberToGuardian(member, value.guardian) });
    }
  };
  /* When a family member is the chosen source, lock the guardian
   * fields so they read as derived data (not freely editable). The
   * applicant clears the lock by picking «آخر — إدخال البيانات يدوياً». */
  const guardianFromFamily =
    guardianSource !== '' && guardianSource !== 'manual';
  const guardianLocked = readOnly || guardianFromFamily;

  const fatherDobError = !readOnly && typeof validateParentDob(value.father.dateOfBirth, studentDob) === 'string'
    ? (validateParentDob(value.father.dateOfBirth, studentDob) as string)
    : undefined;
  const motherDobError = !readOnly && typeof validateParentDob(value.mother.dateOfBirth, studentDob) === 'string'
    ? (validateParentDob(value.mother.dateOfBirth, studentDob) as string)
    : undefined;

  return (
    <>
      <RecordGrid
        formNumber="نموذج 2"
        title="بيانات والد الطالب وزوجته (غير الأم) إن وجدت"
        cols={2}
        actionSlot={
          <Cell
            label="حالة الوالد"
            type="checkbox"
            checkboxLabel="متوفى"
            value={value.father.deceased}
            onChange={(v) => setFather({ deceased: v })}
            disabled={readOnly}
          />
        }
      >
        <Cell label="اسم الوالد" required value={value.father.fullName} onChange={(v) => setFather({ fullName: v })} disabled={readOnly} colSpan={2} />
        <Cell label="اسم الشهرة" value={value.father.shuhraName} onChange={(v) => setFather({ shuhraName: v })} disabled={readOnly} />
        <Cell label="تاريخ الميلاد" required type="date" value={value.father.dateOfBirth} onChange={(v) => setFather({ dateOfBirth: v })} disabled={readOnly} error={fatherDobError} />
        <Cell label="محل الميلاد" required value={value.father.birthPlace} onChange={(v) => setFather({ birthPlace: v })} disabled={readOnly} />
        <Cell label="المؤهل" required type="select" options={QUALIFICATION_OPTIONS} value={value.father.qualification} onChange={(v) => setFather({ qualification: v })} disabled={readOnly} />
        <Cell label="الوظيفة" required type="select" options={PROFESSION_OPTIONS} value={value.father.profession} onChange={(v) => setFather({ profession: v })} disabled={readOnly} />
        {isOfficer(value.father.profession) && (
          <Cell label="رقم الأقدمية" required dir="ltr" value={value.father.seniorityNumber} onChange={(v) => setFather({ seniorityNumber: v })} disabled={readOnly} />
        )}
        <Cell label="جهة العمل" value={value.father.workplace} onChange={(v) => setFather({ workplace: v })} disabled={readOnly} />
        <Cell label="العمل القائم به" value={value.father.workNature} onChange={(v) => setFather({ workNature: v })} disabled={readOnly} />
        <Cell label="العنوان" required type="textarea" value={value.father.address} onChange={(v) => setFather({ address: v })} disabled={readOnly} colSpan={2} />
        <Cell label="التليفون" dir="ltr" value={value.father.homePhone} onChange={(v) => setFather({ homePhone: v })} disabled={readOnly} />
        <Cell label="المحمول" dir="ltr" value={value.father.mobile} onChange={(v) => setFather({ mobile: v })} disabled={readOnly} />
        <Cell label="الرقم القومي" dir="ltr" value={value.father.nationalId} onChange={(v) => setFather({ nationalId: v })} disabled={readOnly} colSpan={2} />
        <Cell
          label="هل هناك زوجة حالية للوالد غير الأم؟"
          type="checkbox"
          checkboxLabel="نعم، هناك زوجة"
          value={value.father.hasCurrentWife}
          onChange={(v) =>
            setFather({ hasCurrentWife: v, currentWifeCount: v ? value.father.currentWifeCount || '1' : '0' })
          }
          disabled={readOnly}
          colSpan={2}
        />
        {value.father.hasCurrentWife && (
          <Cell label="عدد الزوجات" type="number" value={value.father.currentWifeCount} onChange={(v) => setFather({ currentWifeCount: v })} disabled={readOnly} colSpan={2} />
        )}
        {value.father.hasCurrentWife && (
          <>
            <Cell label="اسم الزوجة" required value={value.father.currentWife.fullName} onChange={(v) => setFather({ currentWife: { ...value.father.currentWife, fullName: v } })} disabled={readOnly} colSpan={2} />
            <Cell label="تاريخ الميلاد" type="date" value={value.father.currentWife.dateOfBirth} onChange={(v) => setFather({ currentWife: { ...value.father.currentWife, dateOfBirth: v } })} disabled={readOnly} />
            <Cell label="محل الميلاد" value={value.father.currentWife.birthPlace} onChange={(v) => setFather({ currentWife: { ...value.father.currentWife, birthPlace: v } })} disabled={readOnly} />
            <Cell label="الرقم القومي" dir="ltr" value={value.father.currentWife.nationalId} onChange={(v) => setFather({ currentWife: { ...value.father.currentWife, nationalId: v } })} disabled={readOnly} />
            <Cell label="المؤهل" type="select" options={QUALIFICATION_OPTIONS} value={value.father.currentWife.qualification} onChange={(v) => setFather({ currentWife: { ...value.father.currentWife, qualification: v } })} disabled={readOnly} />
            <Cell label="الوظيفة" type="select" options={PROFESSION_OPTIONS} value={value.father.currentWife.profession} onChange={(v) => setFather({ currentWife: { ...value.father.currentWife, profession: v } })} disabled={readOnly} />
            {isOfficer(value.father.currentWife.profession) && (
              <Cell label="رقم الأقدمية" required dir="ltr" value={value.father.currentWife.seniorityNumber} onChange={(v) => setFather({ currentWife: { ...value.father.currentWife, seniorityNumber: v } })} disabled={readOnly} />
            )}
            <Cell label="جهة العمل" value={value.father.currentWife.workplace} onChange={(v) => setFather({ currentWife: { ...value.father.currentWife, workplace: v } })} disabled={readOnly} />
            <Cell label="العمل القائم به" value={value.father.currentWife.workNature} onChange={(v) => setFather({ currentWife: { ...value.father.currentWife, workNature: v } })} disabled={readOnly} colSpan={2} />
          </>
        )}
      </RecordGrid>

      {value.father.deceased && (
        <RecordGrid
          formNumber="نموذج 3"
          title="بيانات ولي أمر الطالب (في حالة وفاة الوالد)"
          hint="يمكنك اختيار ولي الأمر من أفراد الأسرة المُسجَّلين سابقاً في «بيانات العائلة»، أو اختيار «آخر» لإدخال البيانات يدوياً."
          cols={2}
        >
          <Cell
            label="اختيار ولي الأمر"
            required
            type="select"
            options={[
              ...guardianOptions,
              { value: 'manual', label: 'آخر — إدخال البيانات يدوياً' },
            ]}
            value={guardianSource}
            onChange={(v) => handleGuardianSourceChange(v as GuardianSource | '')}
            disabled={readOnly}
            colSpan={2}
          />
          <Cell label="اسم ولي الأمر" required value={value.guardian.fullName} onChange={(v) => setGuardian({ fullName: v })} disabled={guardianLocked} colSpan={2} />
          <Cell label="اسم الشهرة" value={value.guardian.shuhraName} onChange={(v) => setGuardian({ shuhraName: v })} disabled={guardianLocked} />
          <Cell label="تاريخ الميلاد" required type="date" value={value.guardian.dateOfBirth} onChange={(v) => setGuardian({ dateOfBirth: v })} disabled={guardianLocked} />
          <Cell label="محل الميلاد" required value={value.guardian.birthPlace} onChange={(v) => setGuardian({ birthPlace: v })} disabled={guardianLocked} />
          <Cell label="المؤهل" required type="select" options={QUALIFICATION_OPTIONS} value={value.guardian.qualification} onChange={(v) => setGuardian({ qualification: v })} disabled={guardianLocked} />
          <Cell label="الوظيفة" required type="select" options={PROFESSION_OPTIONS} value={value.guardian.profession} onChange={(v) => setGuardian({ profession: v })} disabled={guardianLocked} />
          {isOfficer(value.guardian.profession) && (
            <Cell label="رقم الأقدمية" required dir="ltr" value={value.guardian.seniorityNumber} onChange={(v) => setGuardian({ seniorityNumber: v })} disabled={guardianLocked} />
          )}
          <Cell label="جهة العمل" value={value.guardian.workplace} onChange={(v) => setGuardian({ workplace: v })} disabled={guardianLocked} />
          <Cell label="العمل القائم به" value={value.guardian.workNature} onChange={(v) => setGuardian({ workNature: v })} disabled={guardianLocked} />
          <Cell label="العنوان" required type="textarea" value={value.guardian.address} onChange={(v) => setGuardian({ address: v })} disabled={guardianLocked} colSpan={2} />
          <Cell label="الجنسية" required type="select" options={NATIONALITY_OPTIONS} value={value.guardian.nationality} onChange={(v) => setGuardian({ nationality: v })} disabled={guardianLocked} />
          <Cell label="المحافظة" required type="select" options={GOVERNORATE_OPTIONS} value={value.guardian.governorate} onChange={(v) => setGuardian({ governorate: v })} disabled={guardianLocked} />
          <Cell label="الديانة" required type="select" options={RELIGION_OPTIONS} value={value.guardian.religion} onChange={(v) => setGuardian({ religion: v })} disabled={guardianLocked} />
          <Cell label="الرقم القومي" required dir="ltr" value={value.guardian.nationalId} onChange={(v) => setGuardian({ nationalId: v })} disabled={guardianLocked} />
          <Cell label="رقم التليفون / المحمول" required dir="ltr" value={value.guardian.mobile} onChange={(v) => setGuardian({ mobile: v })} disabled={guardianLocked} colSpan={2} />
        </RecordGrid>
      )}

      <RecordGrid
        formNumber="نموذج 4"
        title="بيانات والدة الطالب وزوجها (غير الأب) إن وجد"
        cols={2}
        actionSlot={
          <Cell
            label="حالة الوالدة"
            type="checkbox"
            checkboxLabel="متوفية"
            value={value.mother.deceased}
            onChange={(v) => setMother({ deceased: v })}
            disabled={readOnly}
          />
        }
      >
        <Cell label="اسم الوالدة" required value={value.mother.fullName} onChange={(v) => setMother({ fullName: v })} disabled={readOnly} colSpan={2} />
        <Cell label="الجنسية" required type="select" options={NATIONALITY_OPTIONS} value={value.mother.nationality} onChange={(v) => setMother({ nationality: v })} disabled={readOnly} />
        <Cell label="تاريخ الميلاد" required type="date" value={value.mother.dateOfBirth} onChange={(v) => setMother({ dateOfBirth: v })} disabled={readOnly} error={motherDobError} />
        <Cell label="محل الميلاد" required value={value.mother.birthPlace} onChange={(v) => setMother({ birthPlace: v })} disabled={readOnly} />
        <Cell label="الديانة" required type="select" options={RELIGION_OPTIONS_FEMALE} value={value.mother.religion} onChange={(v) => setMother({ religion: v })} disabled={readOnly} />
        <Cell label="المؤهل" required type="select" options={QUALIFICATION_OPTIONS} value={value.mother.qualification} onChange={(v) => setMother({ qualification: v })} disabled={readOnly} />
        <Cell label="الوظيفة" required type="select" options={PROFESSION_OPTIONS} value={value.mother.profession} onChange={(v) => setMother({ profession: v })} disabled={readOnly} />
        {isOfficer(value.mother.profession) && (
          <Cell label="رقم الأقدمية" required dir="ltr" value={value.mother.seniorityNumber} onChange={(v) => setMother({ seniorityNumber: v })} disabled={readOnly} />
        )}
        <Cell label="جهة العمل" value={value.mother.workplace} onChange={(v) => setMother({ workplace: v })} disabled={readOnly} />
        <Cell label="العمل القائم به" value={value.mother.workNature} onChange={(v) => setMother({ workNature: v })} disabled={readOnly} />
        <Cell label="العنوان" required type="textarea" value={value.mother.address} onChange={(v) => setMother({ address: v })} disabled={readOnly} colSpan={2} />
        <Cell label="التليفون" dir="ltr" value={value.mother.homePhone} onChange={(v) => setMother({ homePhone: v })} disabled={readOnly} />
        <Cell label="المحمول" dir="ltr" value={value.mother.mobile} onChange={(v) => setMother({ mobile: v })} disabled={readOnly} />
        <Cell label="الرقم القومي" dir="ltr" value={value.mother.nationalId} onChange={(v) => setMother({ nationalId: v })} disabled={readOnly} colSpan={2} />
        <Cell
          label="هل هناك زوج حالي للوالدة غير الأب؟"
          type="checkbox"
          checkboxLabel="نعم، هناك زوج"
          value={value.mother.hasCurrentHusband}
          onChange={(v) =>
            setMother({ hasCurrentHusband: v, currentHusbandCount: v ? value.mother.currentHusbandCount || '1' : '0' })
          }
          disabled={readOnly}
          colSpan={2}
        />
        {value.mother.hasCurrentHusband && (
          <Cell label="عدد الزيجات" type="number" value={value.mother.currentHusbandCount} onChange={(v) => setMother({ currentHusbandCount: v })} disabled={readOnly} colSpan={2} />
        )}
        {value.mother.hasCurrentHusband && (
          <>
            <Cell label="اسم الزوج" required value={value.mother.currentHusband.fullName} onChange={(v) => setMother({ currentHusband: { ...value.mother.currentHusband, fullName: v } })} disabled={readOnly} colSpan={2} />
            <Cell label="تاريخ الميلاد" type="date" value={value.mother.currentHusband.dateOfBirth} onChange={(v) => setMother({ currentHusband: { ...value.mother.currentHusband, dateOfBirth: v } })} disabled={readOnly} />
            <Cell label="محل الميلاد" value={value.mother.currentHusband.birthPlace} onChange={(v) => setMother({ currentHusband: { ...value.mother.currentHusband, birthPlace: v } })} disabled={readOnly} />
            <Cell label="الرقم القومي" dir="ltr" value={value.mother.currentHusband.nationalId} onChange={(v) => setMother({ currentHusband: { ...value.mother.currentHusband, nationalId: v } })} disabled={readOnly} />
            <Cell label="المؤهل" type="select" options={QUALIFICATION_OPTIONS} value={value.mother.currentHusband.qualification} onChange={(v) => setMother({ currentHusband: { ...value.mother.currentHusband, qualification: v } })} disabled={readOnly} />
            <Cell label="الوظيفة" type="select" options={PROFESSION_OPTIONS} value={value.mother.currentHusband.profession} onChange={(v) => setMother({ currentHusband: { ...value.mother.currentHusband, profession: v } })} disabled={readOnly} />
            {isOfficer(value.mother.currentHusband.profession) && (
              <Cell label="رقم الأقدمية" required dir="ltr" value={value.mother.currentHusband.seniorityNumber} onChange={(v) => setMother({ currentHusband: { ...value.mother.currentHusband, seniorityNumber: v } })} disabled={readOnly} />
            )}
            <Cell label="جهة العمل" value={value.mother.currentHusband.workplace} onChange={(v) => setMother({ currentHusband: { ...value.mother.currentHusband, workplace: v } })} disabled={readOnly} />
            <Cell label="العمل القائم به" value={value.mother.currentHusband.workNature} onChange={(v) => setMother({ currentHusband: { ...value.mother.currentHusband, workNature: v } })} disabled={readOnly} colSpan={2} />
          </>
        )}
      </RecordGrid>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * Group 3 — Grandparents (نموذج 7-10)
 * ──────────────────────────────────────────────────────────────────── */

interface GrandparentsGroupProps {
  value: VothiqaTaarufDocument['grandparents'];
  onChange: (next: VothiqaTaarufDocument['grandparents']) => void;
  fatherDob: string;
  motherDob: string;
  readOnly?: boolean;
}

function GrandparentsGroup({
  value,
  onChange,
  fatherDob,
  motherDob,
  readOnly,
}: GrandparentsGroupProps): JSX.Element {
  type GpKey = keyof VothiqaTaarufDocument['grandparents'];
  const setGp = (key: GpKey, patch: Partial<VothiqaTaarufDocument['grandparents'][GpKey]>): void =>
    onChange({ ...value, [key]: { ...value[key], ...patch } });

  return (
    <>
      <GrandparentCard
        formNumber="نموذج 7"
        title="بيانات جد الطالب للوالد (والد الأب)"
        person={value.paternalGrandfather}
        onPatch={(p) => setGp('paternalGrandfather', p)}
        childDob={fatherDob}
        readOnly={readOnly}
      />
      <GrandparentCard
        formNumber="نموذج 8"
        title="بيانات جدة الطالب للوالد (والدة الأب)"
        person={value.paternalGrandmother}
        onPatch={(p) => setGp('paternalGrandmother', p)}
        childDob={fatherDob}
        useFemaleLabels
        readOnly={readOnly}
      />
      <GrandparentCard
        formNumber="نموذج 9"
        title="بيانات جد الطالب للوالدة (والد الأم)"
        person={value.maternalGrandfather}
        onPatch={(p) => setGp('maternalGrandfather', p)}
        childDob={motherDob}
        readOnly={readOnly}
      />
      <GrandparentCard
        formNumber="نموذج 10"
        title="بيانات جدة الطالب للوالدة (والدة الأم)"
        person={value.maternalGrandmother}
        onPatch={(p) => setGp('maternalGrandmother', p)}
        childDob={motherDob}
        useFemaleLabels
        readOnly={readOnly}
      />
    </>
  );
}

interface GrandparentCardProps {
  formNumber: string;
  title: string;
  person: VothiqaTaarufDocument['grandparents']['paternalGrandfather'];
  onPatch: (patch: Partial<VothiqaTaarufDocument['grandparents']['paternalGrandfather']>) => void;
  childDob: string;
  useFemaleLabels?: boolean;
  readOnly?: boolean;
}

function GrandparentCard({
  formNumber,
  title,
  person,
  onPatch,
  childDob,
  useFemaleLabels,
  readOnly,
}: GrandparentCardProps): JSX.Element {
  const nameLabel = useFemaleLabels ? 'الاسم' : 'اسم الوالد';
  const dobErr = !readOnly && typeof validateParentDob(person.dateOfBirth, childDob) === 'string'
    ? (validateParentDob(person.dateOfBirth, childDob) as string)
    : undefined;
  return (
    <RecordGrid formNumber={formNumber} title={title} cols={2}>
      <Cell label={nameLabel} required value={person.fullName} onChange={(v) => onPatch({ fullName: v })} disabled={readOnly} colSpan={2} />
      <Cell label="اسم الشهرة" value={person.shuhraName} onChange={(v) => onPatch({ shuhraName: v })} disabled={readOnly} />
      <Cell label="تاريخ الميلاد" required type="date" value={person.dateOfBirth} onChange={(v) => onPatch({ dateOfBirth: v })} disabled={readOnly} error={dobErr} />
      <Cell label="محل الميلاد" required value={person.birthPlace} onChange={(v) => onPatch({ birthPlace: v })} disabled={readOnly} />
      <Cell label="المحافظة" required type="select" options={GOVERNORATE_OPTIONS} value={person.governorate} onChange={(v) => onPatch({ governorate: v })} disabled={readOnly} />
      <Cell label="الجنسية" required type="select" options={NATIONALITY_OPTIONS} value={person.nationality} onChange={(v) => onPatch({ nationality: v })} disabled={readOnly} />
      <Cell label="الديانة" required type="select" options={useFemaleLabels ? RELIGION_OPTIONS_FEMALE : RELIGION_OPTIONS} value={person.religion} onChange={(v) => onPatch({ religion: v })} disabled={readOnly} />
      <Cell
        label="على قيد الحياة"
        required
        type="select"
        value={person.alive}
        onChange={(v) => onPatch({ alive: v as 'alive' | 'deceased' | '' })}
        options={[
          { value: 'alive', label: 'على قيد الحياة' },
          { value: 'deceased', label: useFemaleLabels ? 'متوفية' : 'متوفى' },
        ]}
        disabled={readOnly}
      />
      <Cell label="الرقم القومي" dir="ltr" value={person.nationalId} onChange={(v) => onPatch({ nationalId: v })} disabled={readOnly} />
      <Cell label="المؤهل" type="select" options={QUALIFICATION_OPTIONS} value={person.qualification} onChange={(v) => onPatch({ qualification: v })} disabled={readOnly} />
      <Cell label="الوظيفة" type="select" options={PROFESSION_OPTIONS} value={person.profession} onChange={(v) => onPatch({ profession: v })} disabled={readOnly} />
      {isOfficer(person.profession) && (
        <Cell label="رقم الأقدمية" required dir="ltr" value={person.seniorityNumber} onChange={(v) => onPatch({ seniorityNumber: v })} disabled={readOnly} />
      )}
      <Cell label="جهة العمل" value={person.workplace} onChange={(v) => onPatch({ workplace: v })} disabled={readOnly} />
      <Cell label="العمل القائم به" value={person.workNature} onChange={(v) => onPatch({ workNature: v })} disabled={readOnly} />
      <Cell label="العنوان" type="textarea" value={person.address} onChange={(v) => onPatch({ address: v })} disabled={readOnly} colSpan={2} />
    </RecordGrid>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * Groups 4-6 — relatives lists (نموذج 11-28)
 *
 * Each نموذج is a `RelativesListPanel<AdultRelativeRecord>` with the
 * same inline row editor (rendered via `AdultRelativeRowEditor`).
 * Sub-section grouping into "siblings" / "paternal" / "maternal" keeps
 * the accordion bodies focused.
 * ──────────────────────────────────────────────────────────────────── */

function SiblingsGroup({
  value,
  onChange,
  readOnly,
}: {
  value: VothiqaTaarufDocument['siblings'];
  onChange: (next: VothiqaTaarufDocument['siblings']) => void;
  readOnly?: boolean;
}): JSX.Element {
  type K = keyof VothiqaTaarufDocument['siblings'];
  const set = <X extends K>(key: X, next: VothiqaTaarufDocument['siblings'][X]): void =>
    onChange({ ...value, [key]: next });
  return (
    <>
      <AdultListPanel formNumber="نموذج 11" title="الإخوة الذكور الأشقاء وزوجاتهم" itemSingular="الأخ" value={value.fullBrothers} onChange={(n) => set('fullBrothers', n)} readOnly={readOnly} />
      <AdultListPanel formNumber="نموذج 11/1" title="الإخوة الذكور غير الأشقاء وزوجاتهم" itemSingular="الأخ" footnote="يراعى ذكر إن كان أخاً لأب أو لأم فقط." value={value.halfBrothers} onChange={(n) => set('halfBrothers', n)} readOnly={readOnly} />
      <AdultListPanel formNumber="نموذج 12" title="أبناء الإخوة وزوجاتهم" itemSingular="ابن الأخ" value={value.brothersSons} onChange={(n) => set('brothersSons', n)} readOnly={readOnly} />
      <AdultListPanel formNumber="نموذج 13" title="بنات الإخوة وأزواجهن" itemSingular="بنت الأخ" value={value.brothersDaughters} onChange={(n) => set('brothersDaughters', n)} readOnly={readOnly} />
      <AdultListPanel formNumber="نموذج 14" title="الأخوات الشقيقات وأزواجهن" itemSingular="الأخت" value={value.fullSisters} onChange={(n) => set('fullSisters', n)} readOnly={readOnly} />
      <AdultListPanel formNumber="نموذج 14/1" title="الأخوات غير الشقيقات وأزواجهن" itemSingular="الأخت" footnote="يراعى ذكر إذا كانت أختاً لأب أو لأم." value={value.halfSisters} onChange={(n) => set('halfSisters', n)} readOnly={readOnly} />
      <AdultListPanel formNumber="نموذج 15" title="أبناء الأخوات وزوجاتهم" itemSingular="ابن الأخت" value={value.sistersSons} onChange={(n) => set('sistersSons', n)} readOnly={readOnly} />
      <AdultListPanel formNumber="نموذج 16" title="بنات الأخوات وأزواجهن" itemSingular="بنت الأخت" value={value.sistersDaughters} onChange={(n) => set('sistersDaughters', n)} readOnly={readOnly} />
    </>
  );
}

function PaternalRelativesGroup({
  value,
  onChange,
  readOnly,
}: {
  value: VothiqaTaarufDocument['paternalRelatives'];
  onChange: (next: VothiqaTaarufDocument['paternalRelatives']) => void;
  readOnly?: boolean;
}): JSX.Element {
  type K = keyof VothiqaTaarufDocument['paternalRelatives'];
  const set = <X extends K>(key: X, next: VothiqaTaarufDocument['paternalRelatives'][X]): void =>
    onChange({ ...value, [key]: next });
  return (
    <>
      <AdultListPanel formNumber="نموذج 17" title="الأعمام وزوجاتهم" itemSingular="العم" footnote="يراعى ذكر الأعمام غير الأشقاء (إخوة الوالد من الأب، أو الأم) فقط وأبناؤهم إن وجدوا." value={value.paternalUncles} onChange={(n) => set('paternalUncles', n)} readOnly={readOnly} />
      <AdultListPanel formNumber="نموذج 18" title="أبناء الأعمام" itemSingular="ابن العم" value={value.paternalUnclesSons} onChange={(n) => set('paternalUnclesSons', n)} readOnly={readOnly} />
      <AdultListPanel formNumber="نموذج 19" title="بنات الأعمام" itemSingular="بنت العم" value={value.paternalUnclesDaughters} onChange={(n) => set('paternalUnclesDaughters', n)} readOnly={readOnly} />
      <AdultListPanel formNumber="نموذج 23" title="العمات وأزواجهن" itemSingular="العمة" footnote="يراعى ذكر العمات غير الأشقاء (أخوات الوالد من الأب، أو الأم) وأبناؤهم إن وجدوا." value={value.paternalAunts} onChange={(n) => set('paternalAunts', n)} readOnly={readOnly} />
      <AdultListPanel formNumber="نموذج 24" title="أبناء العمات" itemSingular="ابن العمة" value={value.paternalAuntsSons} onChange={(n) => set('paternalAuntsSons', n)} readOnly={readOnly} />
      <AdultListPanel formNumber="نموذج 25" title="بنات العمات" itemSingular="بنت العمة" value={value.paternalAuntsDaughters} onChange={(n) => set('paternalAuntsDaughters', n)} readOnly={readOnly} />
    </>
  );
}

function MaternalRelativesGroup({
  value,
  onChange,
  readOnly,
}: {
  value: VothiqaTaarufDocument['maternalRelatives'];
  onChange: (next: VothiqaTaarufDocument['maternalRelatives']) => void;
  readOnly?: boolean;
}): JSX.Element {
  type K = keyof VothiqaTaarufDocument['maternalRelatives'];
  const set = <X extends K>(key: X, next: VothiqaTaarufDocument['maternalRelatives'][X]): void =>
    onChange({ ...value, [key]: next });
  return (
    <>
      <AdultListPanel formNumber="نموذج 20" title="الأخوال وزوجاتهم" itemSingular="الخال" footnote="يراعى ذكر الأخوال غير الأشقاء (إخوة الوالدة من الأب أو الأم فقط) وأبناؤهم إن وجدوا." value={value.maternalUncles} onChange={(n) => set('maternalUncles', n)} readOnly={readOnly} />
      <AdultListPanel formNumber="نموذج 21" title="أبناء الأخوال" itemSingular="ابن الخال" value={value.maternalUnclesSons} onChange={(n) => set('maternalUnclesSons', n)} readOnly={readOnly} />
      <AdultListPanel formNumber="نموذج 22" title="بنات الأخوال" itemSingular="بنت الخال" value={value.maternalUnclesDaughters} onChange={(n) => set('maternalUnclesDaughters', n)} readOnly={readOnly} />
      <AdultListPanel formNumber="نموذج 26" title="الخالات وأزواجهن" itemSingular="الخالة" footnote="يراعى ذكر الخالات غير الأشقاء (أخوات الوالدة من الأب، أو الأم) وأبناؤهن إن وجدوا." value={value.maternalAunts} onChange={(n) => set('maternalAunts', n)} readOnly={readOnly} />
      <AdultListPanel formNumber="نموذج 27" title="أبناء الخالات" itemSingular="ابن الخالة" value={value.maternalAuntsSons} onChange={(n) => set('maternalAuntsSons', n)} readOnly={readOnly} />
      <AdultListPanel formNumber="نموذج 28" title="بنات الخالات" itemSingular="بنت الخالة" value={value.maternalAuntsDaughters} onChange={(n) => set('maternalAuntsDaughters', n)} readOnly={readOnly} />
    </>
  );
}

interface AdultListPanelProps {
  formNumber: string;
  title: string;
  itemSingular: string;
  footnote?: string;
  value: { none: boolean; items: ReturnType<typeof emptyAdultRelative>[] };
  onChange: (next: { none: boolean; items: ReturnType<typeof emptyAdultRelative>[] }) => void;
  readOnly?: boolean;
}

function AdultListPanel({
  formNumber,
  title,
  itemSingular,
  footnote,
  value,
  onChange,
  readOnly,
}: AdultListPanelProps): JSX.Element {
  return (
    <RelativesListPanel
      formNumber={formNumber}
      title={title}
      footnote={footnote}
      itemSingular={itemSingular}
      value={value}
      onChange={onChange}
      emptyFactory={emptyAdultRelative}
      readOnly={readOnly}
      renderRow={(row, update) => (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Cell label="الاسم" required value={row.name} onChange={(v) => update({ name: v })} disabled={readOnly} colSpan={2} />
          <Cell label="تاريخ الميلاد" type="date" value={row.dateOfBirth} onChange={(v) => update({ dateOfBirth: v })} disabled={readOnly} />
          <Cell label="محل الميلاد" value={row.birthPlace} onChange={(v) => update({ birthPlace: v })} disabled={readOnly} />
          <Cell label="المؤهل" type="select" options={QUALIFICATION_OPTIONS} value={row.qualification} onChange={(v) => update({ qualification: v })} disabled={readOnly} />
          <Cell label="الوظيفة" type="select" options={PROFESSION_OPTIONS} value={row.profession} onChange={(v) => update({ profession: v })} disabled={readOnly} />
          {isOfficer(row.profession) && (
            <Cell label="رقم الأقدمية" required dir="ltr" value={row.seniorityNumber} onChange={(v) => update({ seniorityNumber: v })} disabled={readOnly} />
          )}
          <Cell label="جهة العمل" value={row.workplace} onChange={(v) => update({ workplace: v })} disabled={readOnly} />
          <Cell label="الرقم القومي" dir="ltr" value={row.nationalId} onChange={(v) => update({ nationalId: v })} disabled={readOnly} />
          <Cell label="الحالة الاجتماعية" type="select" options={MARITAL_STATUS_ADULT_OPTIONS} value={row.maritalStatus} onChange={(v) => update({ maritalStatus: v })} disabled={readOnly} />
          <Cell label="اسم الزوج / الزوجة" value={row.spouseName} onChange={(v) => update({ spouseName: v })} disabled={readOnly} />
          <Cell label="العنوان" type="textarea" value={row.address} onChange={(v) => update({ address: v })} disabled={readOnly} colSpan={2} />
          <Cell label="الحالة" type="checkbox" checkboxLabel="متوفى" value={row.deceased} onChange={(v) => update({ deceased: v })} disabled={readOnly} />
        </div>
      )}
    />
  );
}

/* ────────────────────────────────────────────────────────────────────
 * Group 7 — Foreign + naturalized + criminal cases (نموذج 29-31)
 * ──────────────────────────────────────────────────────────────────── */

function ForeignAndCasesGroup({
  value,
  onChange,
  readOnly,
}: {
  value: VothiqaTaarufDocument['foreignAndCases'];
  onChange: (next: VothiqaTaarufDocument['foreignAndCases']) => void;
  readOnly?: boolean;
}): JSX.Element {
  type K = keyof VothiqaTaarufDocument['foreignAndCases'];
  const set = <X extends K>(key: X, next: VothiqaTaarufDocument['foreignAndCases'][X]): void =>
    onChange({ ...value, [key]: next });
  return (
    <>
      <ForeignEmployedTable value={value.foreignEmployed} onChange={(n) => set('foreignEmployed', n)} readOnly={readOnly} />
      <NaturalizedTable value={value.naturalized} onChange={(n) => set('naturalized', n)} readOnly={readOnly} />
      <CriminalCasesTable value={value.criminalCases} onChange={(n) => set('criminalCases', n)} readOnly={readOnly} />
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * Validators
 * ──────────────────────────────────────────────────────────────────── */

function isFilled(v: string | undefined): boolean {
  return Boolean(v && v.trim().length > 0);
}

function validatePersonal(doc: VothiqaTaarufDocument): string | null {
  const p = doc.personal.personal;
  const required: Array<[string, string]> = [
    [p.fullName, 'اسم الطالب'],
    [p.committee, 'اللجنة'],
    [p.dateOfBirth, 'تاريخ الميلاد'],
    [p.birthPlace, 'محل الميلاد'],
    [p.nationality, 'الجنسية'],
    [p.religion, 'الديانة'],
    [p.governorate, 'المحافظة'],
    [p.nationalId, 'الرقم القومي'],
    [p.qualificationOrTrack, 'المؤهل / الشعبة'],
    [p.qualificationYear, 'سنة الحصول على المؤهل'],
    [p.totalGrades, 'مجموع الدرجات'],
    [p.gradesPercent, 'النسبة المئوية'],
    [p.mobile, 'المحمول'],
    [p.address, 'العنوان'],
  ];
  for (const [v, label] of required) {
    if (!isFilled(v)) return `يرجى استكمال حقل «${label}» في نموذج 1.`;
  }
  const h = doc.personal.housing;
  if (!isFilled(h.housingType)) return 'يرجى استكمال «نوع المسكن» في نموذج 5.';
  if (!isFilled(h.roomsCount)) return 'يرجى استكمال «عدد الغرف» في نموذج 5.';
  if (!isFilled(h.residentsCount)) return 'يرجى استكمال «عدد المقيمين» في نموذج 5.';
  const inc = doc.personal.income;
  if (!isFilled(inc.incomeDetails)) return 'يرجى استكمال «تفصيلات الدخل» في نموذج 6.';
  if (!isFilled(inc.totalIncome)) return 'يرجى استكمال «إجمالي الدخل» في نموذج 6.';
  return null;
}

function validateApplicantFamily(doc: VothiqaTaarufDocument): string | null {
  /* Single applicants skip this group — nothing to validate. */
  if (doc.personal.personal.maritalStatus !== 'married') return null;
  const s = doc.applicantFamily.spouse;
  if (!isFilled(s.fullName)) return 'يرجى استكمال اسم الزوج/الزوجة في نموذج 2.';
  if (!isFilled(s.dateOfBirth)) return 'يرجى استكمال تاريخ ميلاد الزوج/الزوجة في نموذج 2.';
  if (isOfficer(s.profession) && !isFilled(s.seniorityNumber)) {
    return 'يرجى إدخال رقم الأقدمية للزوج/الزوجة (ضابط).';
  }
  /* Second spouse + children rows only validated when added. */
  if (doc.applicantFamily.hasSecondSpouse) {
    const ss = doc.applicantFamily.secondSpouse;
    if (!isFilled(ss.fullName)) return 'يرجى استكمال اسم الزوج/الزوجة الثانية في نموذج 3.';
  }
  for (const list of [doc.applicantFamily.sons, doc.applicantFamily.daughters]) {
    if (!list.none && list.items.length === 0) {
      return 'يرجى إما إضافة بيانات الأبناء/البنات أو تأكيد «لا يوجد».';
    }
    for (const child of list.items) {
      if (!isFilled(child.name)) {
        return 'يرجى استكمال اسم كل ابن/ابنة مُضاف، أو حذفه إن لم تكن لديك بياناته.';
      }
    }
  }
  const sonsNationalIdError = validateRelativeListNationalIds(doc.applicantFamily.sons, 'male');
  if (sonsNationalIdError) return sonsNationalIdError;
  const daughtersNationalIdError = validateRelativeListNationalIds(doc.applicantFamily.daughters, 'female');
  if (daughtersNationalIdError) return daughtersNationalIdError;
  return null;
}

function validateParents(doc: VothiqaTaarufDocument): string | null {
  const f = doc.parents.father;
  if (!isFilled(f.fullName)) return 'يرجى استكمال «اسم الوالد» في نموذج 2.';
  if (!isFilled(f.dateOfBirth)) return 'يرجى استكمال «تاريخ ميلاد الوالد» في نموذج 2.';
  const fatherDobCheck = validateParentDob(f.dateOfBirth, doc.personal.personal.dateOfBirth);
  if (fatherDobCheck !== true) return fatherDobCheck;
  const fatherNationalIdError = nationalIdGenderError(f.nationalId, 'male');
  if (fatherNationalIdError) return fatherNationalIdError;
  if (isOfficer(f.profession) && !isFilled(f.seniorityNumber)) {
    return 'يرجى إدخال رقم الأقدمية للوالد (ضابط).';
  }
  if (f.hasCurrentWife) {
    const fatherWifeNationalIdError = nationalIdGenderError(f.currentWife.nationalId, 'female');
    if (fatherWifeNationalIdError) return fatherWifeNationalIdError;
    if (isOfficer(f.currentWife.profession) && !isFilled(f.currentWife.seniorityNumber)) {
      return 'يرجى إدخال رقم الأقدمية لزوجة الوالد (ضابطة).';
    }
  }
  const m = doc.parents.mother;
  if (!isFilled(m.fullName)) return 'يرجى استكمال «اسم الوالدة» في نموذج 4.';
  if (!isFilled(m.dateOfBirth)) return 'يرجى استكمال «تاريخ ميلاد الوالدة» في نموذج 4.';
  const motherDobCheck = validateParentDob(m.dateOfBirth, doc.personal.personal.dateOfBirth);
  if (motherDobCheck !== true) return motherDobCheck;
  const motherNationalIdError = nationalIdGenderError(m.nationalId, 'female');
  if (motherNationalIdError) return motherNationalIdError;
  if (isOfficer(m.profession) && !isFilled(m.seniorityNumber)) {
    return 'يرجى إدخال رقم الأقدمية للوالدة (ضابطة).';
  }
  if (m.hasCurrentHusband) {
    const motherHusbandNationalIdError = nationalIdGenderError(m.currentHusband.nationalId, 'male');
    if (motherHusbandNationalIdError) return motherHusbandNationalIdError;
    if (isOfficer(m.currentHusband.profession) && !isFilled(m.currentHusband.seniorityNumber)) {
      return 'يرجى إدخال رقم الأقدمية لزوج الوالدة (ضابط).';
    }
  }
  if (f.deceased) {
    const g = doc.parents.guardian;
    if (!isFilled(g.fullName)) return 'يرجى استكمال «اسم ولي الأمر» في نموذج 3 (يُطلب لأن الوالد متوفى).';
    if (!isFilled(g.mobile)) return 'يرجى استكمال رقم تليفون ولي الأمر في نموذج 3.';
    if (isOfficer(g.profession) && !isFilled(g.seniorityNumber)) {
      return 'يرجى إدخال رقم الأقدمية لولي الأمر (ضابط).';
    }
  }
  return null;
}

function validateGrandparents(doc: VothiqaTaarufDocument): string | null {
  const slots = [
    ['paternalGrandfather', 'جد الطالب للوالد', doc.parents.father.dateOfBirth, 'male'],
    ['paternalGrandmother', 'جدة الطالب للوالد', doc.parents.father.dateOfBirth, 'female'],
    ['maternalGrandfather', 'جد الطالب للوالدة', doc.parents.mother.dateOfBirth, 'male'],
    ['maternalGrandmother', 'جدة الطالب للوالدة', doc.parents.mother.dateOfBirth, 'female'],
  ] as const;
  for (const [key, label, childDob, expectedGender] of slots) {
    const g = doc.grandparents[key];
    if (!isFilled(g.fullName)) return `يرجى استكمال اسم ${label}.`;
    if (!isFilled(g.alive)) return `يرجى تحديد حالة ${label} (على قيد الحياة / متوفى).`;
    if (isFilled(g.dateOfBirth)) {
      const dobCheck = validateParentDob(g.dateOfBirth, childDob);
      if (dobCheck !== true) return dobCheck;
    }
    const nationalIdError = nationalIdGenderError(g.nationalId, expectedGender);
    if (nationalIdError) return nationalIdError;
    if (isOfficer(g.profession) && !isFilled(g.seniorityNumber)) {
      return `يرجى إدخال رقم الأقدمية لـ${label} (ضابط).`;
    }
  }
  return null;
}

function validateList(
  section: VothiqaTaarufDocument['siblings'] | VothiqaTaarufDocument['paternalRelatives'] | VothiqaTaarufDocument['maternalRelatives'],
): string | null {
  for (const [key, list] of Object.entries(section)) {
    const typed = list as { none: boolean; items: { name?: string }[] };
    if (!typed.none && typed.items.length === 0) {
      return `يرجى إما إضافة فرد في «${key}» أو تأكيد «لا يوجد».`;
    }
    if (!typed.none) {
      for (const item of typed.items) {
        if (!isFilled(item.name)) {
          return 'يرجى استكمال اسم كل فرد مُضاف، أو حذفه إن لم تكن لديك بياناته.';
        }
        const r = item as { profession?: string; seniorityNumber?: string; name?: string };
        if (isOfficer(r.profession) && !isFilled(r.seniorityNumber)) {
          return `يرجى إدخال رقم الأقدمية لـ«${r.name ?? 'الفرد'}» (ضابط).`;
        }
        const expectedGender = relativeListExpectedGender(key);
        if (expectedGender) {
          const nationalIdError = nationalIdGenderError(
            (item as { nationalId?: string }).nationalId,
            expectedGender,
          );
          if (nationalIdError) return nationalIdError;
        }
      }
    }
  }
  return null;
}

function validateRelativeListNationalIds(
  list: { items: { nationalId?: string }[] },
  expectedGender: 'male' | 'female',
): string | null {
  for (const relative of list.items) {
    const nationalIdError = nationalIdGenderError(relative.nationalId, expectedGender);
    if (nationalIdError) return nationalIdError;
  }
  return null;
}

function relativeListExpectedGender(key: string): 'male' | 'female' | null {
  if (MALE_RELATIVE_LIST_KEYS.has(key)) return 'male';
  if (FEMALE_RELATIVE_LIST_KEYS.has(key)) return 'female';
  return null;
}

function nationalIdGenderError(
  nationalId: string | undefined,
  expectedGender: 'male' | 'female',
): string | null {
  if (!isFilled(nationalId)) return null;
  const validationResult = validateNationalIdGenderField(nationalId, expectedGender);
  return validationResult === true ? null : validationResult;
}

function validateForeignAndCases(doc: VothiqaTaarufDocument): string | null {
  const f = doc.foreignAndCases;
  for (const [key, list] of Object.entries(f)) {
    const typed = list as { none: boolean; items: { fullNameQuad?: string }[] };
    if (!typed.none && typed.items.length === 0) {
      return `يرجى إما إضافة سجل في «${key}» أو تأكيد «لا يوجد».`;
    }
    if (!typed.none) {
      for (const item of typed.items) {
        if (!isFilled(item.fullNameQuad)) {
          return 'يرجى استكمال الاسم رباعياً في كل سجل مُضاف، أو حذفه.';
        }
      }
    }
  }
  return null;
}
