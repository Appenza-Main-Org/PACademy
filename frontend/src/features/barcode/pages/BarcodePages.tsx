import { useMemo, useState, type ChangeEvent } from 'react';
import { CalendarRange, Hash, IdCard, Printer, RefreshCw, ScanBarcode, Search, Sparkles, User } from 'lucide-react';
import { PageHeader, Card, CardHeader, CardBody, Button, Badge, EmptyState, ErrorState, LoadingState, KhayameyaStripe, Code128Barcode, LogoMark, Select, toast } from '@/shared/components';
import { MOCK } from '@/shared/mock-data';
import { cn } from '@/shared/lib/cn';
import { date as fmtDate, num, shortName, maskNationalId } from '@/shared/lib/format';
import { nationalIdErrorMessage } from '@/shared/lib/national-id';
import { hasPermission, useAuthStore } from '@/features/auth';
import { useBarcodeGroupPrint, useBarcodeSearch, useGenerateBarcodeMutation, useReprintBarcodeMutation } from '../api/barcode.queries';
import type { BarcodeSearchHit, BarcodeSearchMode } from '../api/barcode.service';
import {
  BARCODE_CATEGORY_OPTIONS,
  BARCODE_COMMITTEE_OPTIONS,
  BARCODE_EXAM_TYPE_OPTIONS,
  BARCODE_QUALIFICATION_OPTIONS,
  EMPTY_GROUP_SELECTION,
  type GroupSelection,
} from '../lib/barcodeGroups';
import { isApplicantInScope, scopeForRole, type OperatorScope } from '../lib/barcodeScope';
import { BarcodeScopeBar } from '../components/BarcodeScopeBar';
import type { Applicant, BarcodeRecord } from '@/shared/types/domain';

/**
 * Build the pipe-delimited Code 128B payload for an applicant card.
 * Format: PA|{applicantId}|{nationalId}|{cardCode}|C{committeeIdx}
 *
 * Committee is stored as an Arabic ordinal name ("الأولى"/"الثانية"/…) but
 * Code 128B can only encode ASCII, so we map to a 1-based index. Falls back
 * to "0" if the name is not in the canonical list.
 */
const COMMITTEE_NAME_TO_INDEX: Record<string, number> = {
  'الأولى': 1, 'الثانية': 2, 'الثالثة': 3, 'الرابعة': 4, 'الخامسة': 5,
};

function buildPayload(applicant: Applicant, cardCode: string): string {
  const committeeIdx = COMMITTEE_NAME_TO_INDEX[applicant.committee] ?? 0;
  return ['PA', applicant.id, applicant.nationalId, cardCode, `C${committeeIdx}`].join('|');
}

/** Copy-count options for individual print (US-BC-002). */
const COPY_COUNTS = [1, 2, 3, 4, 5, 6] as const;

/** Derive the operator scope (default + lock + override entitlement) from
 *  the authenticated user's role (US-BC-011 → US-BC-016). */
function useOperatorScope(): {
  scope: OperatorScope;
  setScope: (next: OperatorScope) => void;
  locked: boolean;
  canOverride: boolean;
} {
  const role = useAuthStore((s) => s.user?.role) ?? 'super_admin';
  const permissions = useAuthStore((s) => s.user?.permissions ?? []);
  const seed = scopeForRole(role);
  const [scope, setScope] = useState<OperatorScope>(() => ({
    kind: seed.kind,
    override: false,
    ...(seed.kind === 'student-committee' ? { committee: BARCODE_COMMITTEE_OPTIONS[0]!.value } : {}),
    ...(seed.kind === 'exam-committee' ? { examType: BARCODE_EXAM_TYPE_OPTIONS[0]!.value } : {}),
  }));
  return { scope, setScope, locked: seed.locked, canOverride: hasPermission(permissions, 'barcode:config') };
}

export function BarcodeGeneratePage(): JSX.Element {
  const { scope, setScope, locked, canOverride } = useOperatorScope();
  const inScope = useMemo(() => MOCK.applicants.filter((a) => isApplicantInScope(a, scope)), [scope]);

  const [applicantId, setApplicantId] = useState(MOCK.applicants[0]!.id);
  const [record, setRecord] = useState<BarcodeRecord | null>(null);
  /** How the current `record` was produced — drives the preview caption. */
  const [origin, setOrigin] = useState<'generated' | 'reprinted' | null>(null);
  const [copies, setCopies] = useState(1);

  /* Keep the selection inside the active scope. */
  const effectiveId = inScope.some((a) => a.id === applicantId) ? applicantId : inScope[0]?.id ?? '';
  const applicant = inScope.find((a) => a.id === effectiveId);
  const generateMut = useGenerateBarcodeMutation();
  const reprintMut = useReprintBarcodeMutation();

  const handleScopeChange = (next: OperatorScope): void => {
    setScope(next);
    setRecord(null);
    setOrigin(null);
  };

  const handleGenerate = (): void => {
    if (!effectiveId) return;
    generateMut.mutate(effectiveId, {
      onSuccess: (r) => { setRecord(r); setOrigin('generated'); toast('تم توليد كارت تردد جديد', 'success'); },
    });
  };

  const handleReprint = (): void => {
    if (!effectiveId) return;
    reprintMut.mutate(effectiveId, {
      onSuccess: (r) => { setRecord(r); setOrigin('reprinted'); toast('تم استرجاع الكارت القائم لإعادة الطباعة', 'success'); },
      onError: (e) => toast(e instanceof Error ? e.message : 'تعذّر استرجاع الكارت', 'danger'),
    });
  };

  const previewSubtitle = record
    ? `${origin === 'reprinted' ? 'إعادة طباعة' : 'صادر'} بتاريخ ${fmtDate(record.issuedAt, 'short')} · ${num(copies)} نسخة`
    : 'لم يتم التوليد بعد';

  return (
    <>
      <PageHeader
        title="إنشاء كارت تردد"
        subtitle="توليد باركود فريد لكل متقدم لاستخدامه في كل المراحل · يربط بين العيادات واللجان والامتحانات"
      />

      <BarcodeScopeBar scope={scope} onChange={handleScopeChange} locked={locked} canOverride={canOverride} />

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader
            title="اختيار المتقدم"
            subtitle="حدّد المتقدم لتوليد كارت التردد الخاص به"
            actions={<Badge tone="info" icon={<Sparkles size={11} strokeWidth={1.75} />}>توليد آلي</Badge>}
          />
          <CardBody>
            {inScope.length === 0 ? (
              <EmptyState variant="no-applicants-yet" title="لا يوجد متقدمون ضمن النطاق" description="لا يوجد متقدمون مؤهَّلون للطباعة ضمن نطاق التشغيل الحالي." />
            ) : (
            <>
            <div className="filters">
              <Select
                aria-label="اختيار المتقدم"
                value={effectiveId}
                onChange={(e) => { setApplicantId(e.target.value); setRecord(null); setOrigin(null); }}
                options={inScope.slice(0, 30).map((a) => ({
                  value: a.id,
                  label: `${a.id} — ${shortName(a.name, 3)}`,
                }))}
                containerClassName="flex-1"
              />
            </div>
            {applicant && (
              <div className="mt-3 mb-4 rounded-md border border-border-subtle bg-ink-50 p-3">
                <div className="grid grid-cols-2 gap-2 text-2xs">
                  <FieldRow label="الاسم بالكامل" value={applicant.name} />
                  <FieldRow label="الرقم القومي" value={maskNationalId(applicant.nationalId)} mono />
                  <FieldRow label="المحافظة" value={applicant.governorate} />
                  <FieldRow label="اللجنة" value={`اللجنة ${applicant.committee}`} />
                </div>
              </div>
            )}

            <Select
              label="عدد النسخ للطباعة"
              value={String(copies)}
              onChange={(e) => setCopies(Number(e.target.value))}
              options={COPY_COUNTS.map((n) => ({ value: String(n), label: num(n) }))}
              containerClassName="mb-3"
            />

            <div className="flex flex-col gap-2">
              <Button variant="primary" onClick={handleGenerate} isLoading={generateMut.isPending} fullWidth>
                توليد كارت التردد
              </Button>
              <Button
                variant="secondary"
                leadingIcon={<RefreshCw size={14} strokeWidth={1.75} />}
                onClick={handleReprint}
                isLoading={reprintMut.isPending}
                fullWidth
              >
                إعادة طباعة كارت قائم
              </Button>
            </div>

            <div className="mt-4 rounded-md border border-gold-300 bg-gold-50 p-3 text-2xs text-gold-700">
              <p className="font-bold mb-1">عن كارت التردد</p>
              <p className="leading-normal">
                كارت التردد هو الهوية الموحّدة للمتقدم داخل أكاديمية الشرطة طوال فترة الفحوصات.
                يُستخدم في جميع العيادات الـ8 واللجان الـ5 وفي تسجيل الحضور الإلكتروني.
              </p>
              <p className="mt-2 leading-normal">
                <span className="font-bold">إعادة الطباعة</span> تُصدر نفس الكود الحالي مرة أخرى دون تغييره.
                لإلغاء الكود وإصدار كود جديد (فقد البطاقة) استخدم صفحة «بدل فاقد».
              </p>
            </div>
            </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="معاينة الكارت"
            subtitle={previewSubtitle}
            actions={record && <Button variant="secondary" size="sm" leadingIcon={<Printer size={14} strokeWidth={1.75} />} onClick={() => window.print()}>طباعة {num(copies)} نسخة</Button>}
          />
          <CardBody>
            {!record || !applicant ? (
              <EmptyState title="لا يوجد كارت" description="اختر متقدماً واضغط على «توليد كارت التردد» أو «إعادة طباعة كارت قائم»" />
            ) : (
              <div className="flex flex-col items-center gap-4">
                {Array.from({ length: copies }, (_, i) => (
                  <FrequencyCard key={i} applicant={applicant} record={record} />
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

/** The printable attendance card. Rendered once per copy. */
function FrequencyCard({ applicant, record }: { applicant: Applicant; record: BarcodeRecord }): JSX.Element {
  return (
    <div className="w-full max-w-md overflow-hidden rounded-lg border bg-white shadow-md print:break-inside-avoid" style={{ borderColor: 'var(--accent-500)', borderWidth: 2 }}>
      {/* Header strip */}
      <div className="px-4 py-3 text-white" style={{ background: 'var(--accent-700)' }}>
        <p className="font-ar-display text-sm font-bold">أكاديمية الشرطة · منظومة القبول</p>
        <p className="text-2xs text-white/75">كارت تردد رسمي · دورة 2026</p>
      </div>

      {/* Card body */}
      <div className="grid grid-cols-[auto_1fr] gap-3 p-4">
        <div className="flex h-24 w-20 flex-col items-center justify-center rounded-md border border-dashed border-ink-300 bg-ink-50 text-2xs text-ink-500">
          <User size={28} strokeWidth={1.5} aria-hidden />
          <span className="mt-1">صورة</span>
        </div>
        <div className="flex flex-col justify-between text-2xs">
          <div>
            <p className="text-ink-500">الاسم</p>
            <p className="text-sm font-bold text-ink-900">{applicant.name}</p>
          </div>
          <div>
            <p className="text-ink-500">رقم الطلب</p>
            <p className="font-mono text-sm font-bold text-ink-900" dir="ltr">{applicant.id}</p>
          </div>
          <div>
            <p className="text-ink-500">المحافظة · اللجنة</p>
            <p className="text-ink-700">{applicant.governorate} · لجنة {applicant.committee}</p>
          </div>
        </div>
      </div>

      {/* Barcode strip — real Code 128B carrying the card payload */}
      <div className="flex flex-col items-center gap-1 bg-ink-50 px-4 py-3 text-center">
        <Code128Barcode value={buildPayload(applicant, record.code)} height={56} moduleWidth={1.4} showText={false} />
        <p className="mt-1 font-mono text-xs text-ink-700" dir="ltr">{record.code.replace(/(.{4})/g, '$1 ').trim()}</p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border-subtle px-4 py-2 text-2xs text-ink-500">
        <span className="inline-flex items-center gap-1">
          <Hash size={11} strokeWidth={1.75} />
          <span className="font-mono" dir="ltr">{record.code}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <LogoMark size={16} />
          <span className="inline-flex items-center gap-1">
            <CalendarRange size={11} strokeWidth={1.75} />
            صالح حتى {fmtDate(record.issuedAt + 90 * 86_400_000, 'short')}
          </span>
        </span>
      </div>

      {/* Khayameya stripe */}
      <KhayameyaStripe height="md" />
    </div>
  );
}

function FieldRow({ label, value, mono }: { label: string; value: string; mono?: boolean }): JSX.Element {
  return (
    <div>
      <p className="text-ink-500">{label}</p>
      <p className={mono ? 'mt-0.5 font-mono text-sm font-medium text-ink-900' : 'mt-0.5 text-sm font-medium text-ink-900'} {...(mono ? { dir: 'ltr' } : {})}>{value}</p>
    </div>
  );
}

interface SearchModeMeta {
  mode: BarcodeSearchMode;
  label: string;
  Icon: typeof Search;
  placeholder: string;
  /** Input writing direction — codes/NID are LTR, names RTL. */
  dir: 'ltr' | 'rtl';
}

const SEARCH_MODES: readonly SearchModeMeta[] = [
  { mode: 'barcode', label: 'كود الباركود', Icon: ScanBarcode, placeholder: '26-CAI-00001234', dir: 'ltr' },
  { mode: 'national-id', label: 'الرقم القومي', Icon: IdCard, placeholder: '14 رقماً', dir: 'ltr' },
  { mode: 'name', label: 'الاسم', Icon: User, placeholder: 'اكتب اسم المتقدم…', dir: 'rtl' },
];

export function BarcodeLookupPage(): JSX.Element {
  const [mode, setMode] = useState<BarcodeSearchMode>('barcode');
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState<{ mode: BarcodeSearchMode; query: string } | null>(null);

  const meta = SEARCH_MODES.find((m) => m.mode === mode)!;
  const { data: hits, isFetching, isError, error, refetch } = useBarcodeSearch(submitted);

  /* National-ID mode blocks submit on an invalid Egyptian NID. */
  const nidError = mode === 'national-id' && query.trim().length > 0 ? nationalIdErrorMessage(query.trim()) : undefined;
  const canSubmit = query.trim().length > 0 && !nidError;

  const handleSubmit = (): void => {
    if (!canSubmit) return;
    setSubmitted({ mode, query: query.trim() });
  };

  const switchMode = (next: BarcodeSearchMode): void => {
    setMode(next);
    setQuery('');
    setSubmitted(null);
  };

  return (
    <>
      <PageHeader title="استعلام واسترجاع" subtitle="ابحث عن كارت التردد بالكود أو الرقم القومي أو اسم المتقدم" />
      <Card>
        <CardBody>
          {/* Mode toggle */}
          <div role="radiogroup" aria-label="طريقة البحث" className="mb-4 grid grid-cols-3 gap-2">
            {SEARCH_MODES.map(({ mode: m, label, Icon }) => {
              const selected = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => switchMode(m)}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors duration-fast ease-standard',
                    'focus-visible:shadow-focus-teal focus-visible:outline-none',
                    selected
                      ? 'text-white'
                      : 'border-border-default text-ink-700 hover:border-border-strong hover:bg-ink-50',
                  )}
                  style={selected ? { background: 'var(--accent-600)', borderColor: 'var(--accent-600)' } : undefined}
                >
                  <Icon size={16} strokeWidth={1.75} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {/* Query input + submit */}
          <form
            className="flex flex-col gap-1 sm:flex-row sm:items-start"
            onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
          >
            <div className="flex-1">
              <div className="search">
                <input
                  className="input"
                  dir={meta.dir}
                  inputMode={mode === 'name' ? 'text' : 'numeric'}
                  placeholder={meta.placeholder}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label={`بحث بـ ${meta.label}`}
                  aria-invalid={Boolean(nidError)}
                />
                <Search size={18} />
              </div>
              {nidError && <p className="mt-1 text-2xs text-terra-600">{nidError}</p>}
            </div>
            <Button type="submit" variant="primary" disabled={!canSubmit} isLoading={isFetching}>
              استعلام
            </Button>
          </form>

          {/* Results */}
          <div className="mt-5">
            {!submitted ? (
              <EmptyState variant="no-results-search" title="ابدأ البحث" description="اختر طريقة البحث وأدخل القيمة ثم اضغط «استعلام»." />
            ) : isFetching ? (
              <LoadingState variant="list" />
            ) : isError ? (
              <ErrorState error={error} onRetry={() => refetch()} />
            ) : !hits || hits.length === 0 ? (
              <EmptyState variant="no-results-search" title="لا توجد نتائج" description="تأكد من القيمة المُدخلة وحاول مرة أخرى." />
            ) : hits.length === 1 ? (
              <BarcodeHitCard hit={hits[0]!} />
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-2xs text-ink-500">{num(hits.length)} نتيجة — اختر متقدماً لعرض كارته.</p>
                {hits.map((h) => <BarcodeHitRow key={h.applicant.id} hit={h} />)}
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </>
  );
}

/** Status badge for a card record (issued / replaced-void / not-yet-issued). */
function CardStatusBadge({ record }: { record: BarcodeRecord | null }): JSX.Element {
  if (!record) return <Badge tone="neutral">لم يُصدر كارت بعد</Badge>;
  if (record.void) return <Badge tone="danger">ملغى{record.voidReason ? ` · ${record.voidReason}` : ''}</Badge>;
  return <Badge tone="success">سارٍ</Badge>;
}

/** Full single-result panel: applicant details + card preview. */
function BarcodeHitCard({ hit }: { hit: BarcodeSearchHit }): JSX.Element {
  const { applicant, record } = hit;
  return (
    <div className="grid gap-4 rounded-lg border border-border-subtle bg-ink-50 p-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="grid grid-cols-2 gap-3 text-2xs">
        <FieldRow label="الاسم بالكامل" value={applicant.name} />
        <FieldRow label="رقم الطلب" value={applicant.id} mono />
        <FieldRow label="الرقم القومي" value={maskNationalId(applicant.nationalId)} mono />
        <FieldRow label="المحافظة" value={applicant.governorate} />
        <FieldRow label="اللجنة" value={`اللجنة ${applicant.committee}`} />
        <FieldRow label="المرحلة" value={applicant.stageLabel} />
        <div className="col-span-2 flex items-center gap-2 pt-1">
          <span className="text-ink-500">حالة الكارت</span>
          <CardStatusBadge record={record} />
        </div>
      </div>
      <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-border-subtle bg-white p-3 text-center">
        {record ? (
          <>
            <Code128Barcode value={buildPayload(applicant, record.code)} height={52} moduleWidth={1.3} showText={false} />
            <p className="font-mono text-xs text-ink-700" dir="ltr">{record.code.replace(/(.{4})/g, '$1 ').trim()}</p>
            <p className="inline-flex items-center gap-1 text-2xs text-ink-500">
              <CalendarRange size={11} strokeWidth={1.75} />
              صادر {fmtDate(record.issuedAt, 'short')}
            </p>
          </>
        ) : (
          <EmptyState variant="generic" title="لا يوجد كارت لهذا المتقدم" />
        )}
      </div>
    </div>
  );
}

/** Compact one-line hit used when a name search returns many matches. */
function BarcodeHitRow({ hit }: { hit: BarcodeSearchHit }): JSX.Element {
  const { applicant, record } = hit;
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-surface-card px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink-900">{shortName(applicant.name, 4)}</p>
        <p className="text-2xs text-ink-500">
          <span className="font-mono" dir="ltr">{applicant.id}</span> · {applicant.governorate} · لجنة {applicant.committee}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {record && <span className="hidden font-mono text-2xs text-ink-500 sm:inline" dir="ltr">{record.code}</span>}
        <CardStatusBadge record={record} />
      </div>
    </div>
  );
}

/** "All" sentinel for a group filter (empty value). */
const ALL_OPTION = { value: '', label: 'الكل' } as const;

export function BarcodeBatchPage(): JSX.Element {
  const { scope, setScope, locked, canOverride } = useOperatorScope();
  const [selection, setSelection] = useState<GroupSelection>(EMPTY_GROUP_SELECTION);
  const { data, isFetching, isError, error, refetch } = useBarcodeGroupPrint(selection);

  /* Bulk print is restricted to applicants inside the operator's scope. */
  const candidates = useMemo(
    () => (data ?? []).filter((c) => isApplicantInScope(c.applicant, scope)),
    [data, scope],
  );

  const setDim = (key: keyof GroupSelection) => (e: ChangeEvent<HTMLSelectElement>): void => {
    setSelection((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const count = candidates.length;
  const hasFilter = Object.values(selection).some(Boolean);

  return (
    <>
      <PageHeader title="دفعة كروت" subtitle="توليد كروت لمجموعة متقدمين دفعة واحدة بتصفية حسب الفئة أو نوع الاختبار أو اللجنة أو المؤهل" />
      <BarcodeScopeBar scope={scope} onChange={setScope} locked={locked} canOverride={canOverride} />
      <Card>
        <CardBody>
          <div className="alert alert-info mb-4">
            <span className="alert-icon">ℹ️</span>
            <div className="alert-body">يمكن طباعة دفعة كاملة (40 كارت في الصفحة الواحدة) لتوزيعها على لجان الفحص.</div>
          </div>

          {/* Lookup-driven group filters */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select
              label="الفئة"
              value={selection.category}
              onChange={setDim('category')}
              options={[ALL_OPTION, ...BARCODE_CATEGORY_OPTIONS]}
            />
            <Select
              label="نوع الاختبار"
              value={selection.examType}
              onChange={setDim('examType')}
              options={[ALL_OPTION, ...BARCODE_EXAM_TYPE_OPTIONS]}
            />
            <Select
              label="اللجنة"
              value={selection.committee}
              onChange={setDim('committee')}
              options={[ALL_OPTION, ...BARCODE_COMMITTEE_OPTIONS]}
            />
            <Select
              label="المؤهل"
              value={selection.qualification}
              onChange={setDim('qualification')}
              options={[ALL_OPTION, ...BARCODE_QUALIFICATION_OPTIONS]}
            />
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-2xs text-ink-500">
              {isFetching ? 'جارٍ الحساب…' : `${num(count)} متقدم ضمن التصفية الحالية`}
            </p>
            {hasFilter && (
              <Button variant="ghost" size="sm" onClick={() => setSelection(EMPTY_GROUP_SELECTION)}>
                مسح التصفية
              </Button>
            )}
          </div>

          {/* Candidate grid */}
          <div className="mt-4">
            {isFetching ? (
              <LoadingState variant="card-grid" />
            ) : isError ? (
              <ErrorState error={error} onRetry={() => refetch()} />
            ) : count === 0 ? (
              <EmptyState variant="no-applicants-yet" title="لا يوجد متقدمون" description="عدّل التصفية لعرض كروت قابلة للطباعة." />
            ) : (
              <div className="grid grid-cols-auto" style={{ gap: 12 }}>
                {candidates.map(({ applicant, cardCode }) => (
                  <div key={applicant.id} className="barcode-display flex flex-col items-center gap-1">
                    <div className="text-xs text-tertiary mb-2">{shortName(applicant.name, 2)}</div>
                    <Code128Barcode value={buildPayload(applicant, cardCode)} height={44} moduleWidth={1} showText={false} />
                    <div className="barcode-num">{cardCode.replace(/(.{4})/g, '$1 ').trim()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-center">
            <Button variant="primary" leadingIcon={<Printer size={16} />} disabled={count === 0} onClick={() => window.print()}>
              طباعة {num(count)} كارت
            </Button>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
