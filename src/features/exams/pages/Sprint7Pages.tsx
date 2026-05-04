/**
 * Sprint 7 — Question Bank & e-Exams new pages.
 * Source: RFP Scope Document §9 sections A-G.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  Flag,
  Folder,
  Pause,
  Pencil,
  Plus,
  Send,
  ShieldCheck,
  Timer,
  UploadCloud,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  DonutChart,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Select,
  StatCard,
  Textarea,
  toast,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import { IconStamp } from '@/shared/components/icons';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROUTES } from '@/config/routes';
import { date as fmtDate, num } from '@/shared/lib/format';
import { downloadBlob } from '@/shared/lib/download';
import { examsService } from '../api/exams.service';
import { useLiveSessions } from '../api/exams.queries';
import { ImportWizard } from '../components/ImportWizard';
import { LiveSessionsTable } from '../components/LiveSessionsTable';
import { SESSION_STATUS_LABEL } from '../components/SessionStatusBadge';
import type { BankQuestion, ExamConfig, QuestionStatus, SessionStatus } from '@/shared/types/domain';

/* ─────────── Question Bank list with create/edit ─────────── */

const STATUS_LABEL: Record<QuestionStatus, string> = {
  draft: 'مسودّة', review: 'قيد المراجعة', approved: 'معتمد', live: 'منشور',
};
const STATUS_TONE: Record<QuestionStatus, 'neutral' | 'warning' | 'info' | 'success'> = {
  draft: 'neutral', review: 'warning', approved: 'success', live: 'info',
};

export function QuestionBankCRUDPage(): JSX.Element {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<QuestionStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string | 'all'>('all');
  const { data: allQuestions } = useQuery({
    queryKey: ['exams', 'questions', 'all'],
    queryFn: () => examsService.listQuestions({}),
  });
  const { data, isLoading } = useQuery({
    queryKey: ['exams', 'questions', { status: statusFilter, category: categoryFilter }],
    queryFn: () => examsService.listQuestions({ status: statusFilter }),
  });
  const filtered = (data ?? []).filter((q) => categoryFilter === 'all' || q.category === categoryFilter);

  const categoryCounts = (allQuestions ?? []).reduce<Record<string, number>>((acc, q) => {
    acc[q.category] = (acc[q.category] ?? 0) + 1;
    return acc;
  }, {});
  const statusCounts = (allQuestions ?? []).reduce<Record<QuestionStatus, number>>(
    (acc, q) => { acc[q.status] = (acc[q.status] ?? 0) + 1; return acc; },
    { draft: 0, review: 0, approved: 0, live: 0 },
  );
  const publishMut = useMutation({
    mutationFn: (id: string) => examsService.publishQuestion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exams', 'questions'] }),
  });
  const createMut = useMutation({
    mutationFn: (payload: Parameters<typeof examsService.createQuestion>[0]) => examsService.createQuestion(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['exams', 'questions'] }),
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [draft, setDraft] = useState({ category: 'قدرات لفظية', text: '', options: ['', '', '', ''], correctIndex: 0, difficulty: 3, timeLimitSeconds: 60 });

  const columns: DataTableColumn<BankQuestion>[] = [
    { key: 'id', label: 'الرقم', width: 100, render: (q) => <span className="font-mono" dir="ltr">{q.id}</span> },
    { key: 'category', label: 'الفئة', render: (q) => q.category },
    { key: 'difficulty', label: 'الصعوبة', numeric: true, render: (q) => '★'.repeat(q.difficulty) },
    { key: 'text', label: 'نص السؤال', render: (q) => <span className="block max-w-md truncate">{q.text}</span> },
    { key: 'status', label: 'الحالة', render: (q) => <Badge tone={STATUS_TONE[q.status]}>{q.status === 'approved' && <IconStamp width={12} height={12} className="me-1 inline-block" />}{STATUS_LABEL[q.status]}</Badge> },
    {
      key: '_actions',
      label: <span className="sr-only">إجراءات</span>,
      align: 'end',
      render: (q) => (
        <div className="inline-flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="عرض"><Eye size={14} strokeWidth={1.75} /></Button>
          {q.status !== 'live' && (
            <Button variant="ghost" size="sm" leadingIcon={<Send size={12} strokeWidth={1.75} />} onClick={() => publishMut.mutate(q.id, { onSuccess: () => toast('تم نشر السؤال', 'success') })}>
              نشر
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <CenteredShell>
      <PageHeader
        title="بنك الأسئلة"
        subtitle={`${data?.length ?? 0} سؤال — قابلة للتنقيح والإصدار والنشر`}
        actions={
          <div className="flex items-center gap-2">
            <Select aria-label="الحالة" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as QuestionStatus | 'all')} options={[{ value: 'all', label: 'كل الحالات' }, ...Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l }))]} />
            <Button variant="secondary" leadingIcon={<UploadCloud size={14} strokeWidth={1.75} />} onClick={() => setImportOpen(true)}>
              استيراد من Excel
            </Button>
            <Button variant="primary" leadingIcon={<Plus size={14} strokeWidth={1.75} />} onClick={() => setDrawerOpen(true)}>سؤال جديد</Button>
          </div>
        }
      />
      {/* Status stat strip */}
      <div className="mb-5 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <StatCard
          label="إجمالي الأسئلة"
          value={allQuestions?.length ?? 0}
          icon={<FileText size={16} strokeWidth={1.75} />}
        />
        <StatCard
          label="مسودّات"
          value={statusCounts.draft}
          icon={<Pencil size={16} strokeWidth={1.75} />}
          iconBg="var(--ink-100)"
          iconColor="var(--ink-700)"
        />
        <StatCard
          label="قيد المراجعة"
          value={statusCounts.review}
          icon={<Eye size={16} strokeWidth={1.75} />}
          iconBg="var(--gold-50)"
          iconColor="var(--gold-700)"
        />
        <StatCard
          label="معتمد"
          value={statusCounts.approved}
          icon={<ShieldCheck size={16} strokeWidth={1.75} />}
          iconBg="var(--success-bg)"
          iconColor="var(--success)"
        />
        <StatCard
          label="منشور"
          value={statusCounts.live}
          icon={<CheckCircle2 size={16} strokeWidth={1.75} />}
          iconBg="var(--teal-50)"
          iconColor="var(--teal-700)"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        {/* Category tree sidebar */}
        <Card>
          <CardHeader title="فئات الأسئلة" subtitle={`${Object.keys(categoryCounts).length} فئة`} />
          <ul className="flex flex-col gap-1 text-sm">
            <li>
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={
                  'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-start ' +
                  (categoryFilter === 'all' ? 'font-medium' : 'text-ink-700 hover:bg-ink-50')
                }
                style={categoryFilter === 'all' ? { background: 'var(--accent-50)', color: 'var(--accent-700)' } : undefined}
              >
                <span className="inline-flex items-center gap-2">
                  <BookOpen size={13} strokeWidth={1.75} />
                  جميع الفئات
                </span>
                <span className="font-numeric tnum text-2xs text-ink-500">{allQuestions?.length ?? 0}</span>
              </button>
            </li>
            {Object.entries(categoryCounts).map(([cat, count]) => (
              <li key={cat}>
                <button
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={
                    'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-start ' +
                    (categoryFilter === cat ? 'font-medium' : 'text-ink-700 hover:bg-ink-50')
                  }
                  style={categoryFilter === cat ? { background: 'var(--accent-50)', color: 'var(--accent-700)' } : undefined}
                >
                  <span className="inline-flex items-center gap-2">
                    <Folder size={13} strokeWidth={1.75} />
                    <span className="truncate">{cat}</span>
                  </span>
                  <span className="font-numeric tnum text-2xs text-ink-500">{count}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <DataTable data={filtered} columns={columns} rowKey={(q) => q.id} loading={isLoading} empty={<EmptyState variant="no-questions" />} zebraStripes density="compact" />
        </Card>
      </div>

      <Modal
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="سؤال جديد"
        subtitle="أدخل بيانات السؤال وسيتم حفظه كمسودّة"
        size="lg"
        transparentBackdrop={false}
      >
        <Modal.Body>
          <form
            id="new-question-form"
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              createMut.mutate({
                category: draft.category,
                difficulty: draft.difficulty as 1 | 2 | 3 | 4 | 5,
                type: 'mcq',
                text: draft.text,
                options: draft.options,
                correctIndex: draft.correctIndex,
                timeLimitSeconds: draft.timeLimitSeconds,
              }, { onSuccess: () => { toast('تم حفظ السؤال كمسودّة', 'success'); setDrawerOpen(false); } });
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Select label="الفئة" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} options={['قدرات لفظية', 'قدرات عددية', 'منطق', 'سرعة بديهة', 'ثقافة عامة'].map((c) => ({ value: c, label: c }))} />
              <Select label="الصعوبة" value={String(draft.difficulty)} onChange={(e) => setDraft({ ...draft, difficulty: Number(e.target.value) })} options={[1, 2, 3, 4, 5].map((d) => ({ value: String(d), label: `${d} نجوم` }))} />
            </div>
            <Textarea label="نص السؤال" required value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
            <div className="flex flex-col gap-3">
              <p className="text-2xs font-medium uppercase tracking-wide text-ink-500">
                الخيارات (اختر الإجابة الصحيحة)
              </p>
              {draft.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct"
                    checked={draft.correctIndex === i}
                    onChange={() => setDraft({ ...draft, correctIndex: i })}
                    className="h-4 w-4 cursor-pointer"
                    style={{ accentColor: 'var(--accent-500)' }}
                    aria-label={`الإجابة الصحيحة: الخيار ${i + 1}`}
                  />
                  <Input label={`الخيار ${i + 1}`} value={opt} onChange={(e) => { const next = [...draft.options]; next[i] = e.target.value; setDraft({ ...draft, options: next }); }} containerClassName="flex-1" />
                </div>
              ))}
            </div>
            <Input label="الزمن (ثوانٍ)" type="number" value={draft.timeLimitSeconds} onChange={(e) => setDraft({ ...draft, timeLimitSeconds: Number(e.target.value) })} containerClassName="md:max-w-[200px]" />
          </form>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" variant="ghost" onClick={() => setDrawerOpen(false)}>إلغاء</Button>
          <Button type="submit" form="new-question-form" variant="primary" isLoading={createMut.isPending}>
            حفظ كمسودّة
          </Button>
        </Modal.Footer>
      </Modal>

      <ImportWizard open={importOpen} onClose={() => setImportOpen(false)} />
    </CenteredShell>
  );
}

/* ─────────── Exam create wizard (single-page, condensed) ─────────── */

export function ExamCreatePage(): JSX.Element {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [scheduledFor, setScheduledFor] = useState(new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10));
  const [count, setCount] = useState(40);
  const createMut = useMutation({
    mutationFn: () => examsService.createExam({
      nameAr: name || 'اختبار جديد',
      cycleId: 'CYC-2026-M',
      scheduledFor: new Date(scheduledFor).toISOString(),
      rules: [{ category: 'قدرات لفظية', difficultyMin: 2, difficultyMax: 4, count, minutes: count }],
      questionIds: [],
    }),
    onSuccess: (next) => { toast(`تم إنشاء الاختبار ${next.id} كمسودّة`, 'success'); navigate(ROUTES.questionBank.exams); },
  });

  return (
    <CenteredShell>
      <PageHeader title="إنشاء اختبار" subtitle="حدّد الاسم، الموعد، وعدد الأسئلة المطلوبة" />
      <Card>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); createMut.mutate(); }}>
          <Input label="اسم الاختبار" required value={name} onChange={(e) => setName(e.target.value)} containerClassName="md:col-span-2" />
          <Input label="موعد الاختبار" type="date" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
          <Input label="عدد الأسئلة" type="number" min={10} max={100} value={count} onChange={(e) => setCount(Number(e.target.value))} />
          <div className="md:col-span-2 flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => navigate(ROUTES.questionBank.exams)}>إلغاء</Button>
            <Button type="submit" variant="primary" leadingIcon={<Pencil size={14} strokeWidth={1.75} />}>إنشاء كمسودّة</Button>
          </div>
        </form>
      </Card>
    </CenteredShell>
  );
}

/* ─────────── Live exam (applicant-facing) ─────────── */

export function LiveExamPage(): JSX.Element {
  const { examId = '' } = useParams<{ examId: string }>();
  const { data: exam, isLoading, error, refetch } = useQuery({ queryKey: ['exams', 'config', examId], queryFn: () => examsService.getExam(examId), enabled: Boolean(examId) });
  const [phase, setPhase] = useState<'pre' | 'exam' | 'submitted'>('pre');
  const [activeIdx, setActiveIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [seconds, setSeconds] = useState(45 * 60);
  const [questions, setQuestions] = useState<BankQuestion[]>([]);

  /* Fetch the exam's questions when entering exam phase. */
  useEffect(() => {
    if (phase !== 'exam' || !exam) return;
    Promise.all(exam.questionIds.slice(0, 12).map((id) => examsService.getQuestion(id))).then((qs) => {
      setQuestions(qs.filter(Boolean) as BankQuestion[]);
    });
  }, [phase, exam]);

  useEffect(() => {
    if (phase !== 'exam' || seconds <= 0) return;
    const t = window.setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [phase, seconds]);

  if (isLoading) return <CenteredShell><LoadingState variant="page" /></CenteredShell>;
  if (error) return <CenteredShell><ErrorState error={error} onRetry={() => refetch()} /></CenteredShell>;
  if (!exam) return <CenteredShell><EmptyState variant="generic" title="الاختبار غير موجود" /></CenteredShell>;

  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const activeQ = questions[activeIdx];

  if (phase === 'pre') {
    return (
      <CenteredShell>
        <Card className="text-center">
          <h2 className="font-ar-display text-2xl font-bold text-ink-900">{exam.nameAr}</h2>
          <p className="mt-2 text-sm text-ink-500">يرجى التحقق من هويتك بيومترياً قبل بدء الاختبار. الاختبار يقفل في وضع ملء الشاشة ولا يُسمح بمغادرة الصفحة.</p>
          <div className="my-6 flex flex-col items-center gap-3">
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-teal-700"><ShieldCheck size={32} strokeWidth={1.75} /></span>
            <Badge tone="success">تم التحقق البيومتري</Badge>
          </div>
          <Button variant="primary" size="lg" onClick={() => setPhase('exam')}>ابدأ الاختبار</Button>
        </Card>
      </CenteredShell>
    );
  }

  if (phase === 'submitted') {
    return (
      <CenteredShell>
        <Card className="text-center">
          <h2 className="font-ar-display text-2xl font-bold text-ink-900">تم تسليم الاختبار</h2>
          <p className="mt-2 text-sm text-ink-500">سيتم اعتماد النتائج بعد مراجعة لجنة الاختبارات.</p>
          <Badge tone="success" className="mt-4">في انتظار اعتماد النتائج</Badge>
        </Card>
      </CenteredShell>
    );
  }

  return (
    <CenteredShell>
      <PageHeader
        title={exam.nameAr}
        subtitle={`السؤال ${activeIdx + 1} من ${questions.length || 12}`}
        actions={
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 rounded-pill bg-terra-50 px-3 py-1 text-2xs font-bold text-terra-700">
              <Timer size={12} strokeWidth={1.75} />
              <span dir="ltr" className="font-numeric tnum">{String(minutes).padStart(2, '0')}:{String(secs).padStart(2, '0')}</span>
            </span>
            <Button variant="primary" onClick={async () => { const att = await examsService.startAttempt(exam.id, 'APP-2026000'); await examsService.submitAttempt(att.id, answers); setPhase('submitted'); }}>تسليم</Button>
          </div>
        }
      />
      {activeQ ? (
        <Card>
          <p className="mb-4 text-md font-medium text-ink-900">{activeQ.text}</p>
          <ol className="flex flex-col gap-2">
            {activeQ.options.map((opt, i) => {
              const checked = answers[activeQ.id] === i;
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setAnswers({ ...answers, [activeQ.id]: i })}
                    className={'flex w-full items-center gap-3 rounded-md border px-3 py-2 text-start text-sm ' + (checked ? '' : 'border-border-default hover:bg-ink-50')}
                    style={checked ? { borderColor: 'var(--accent-500)', background: 'var(--accent-50)' } : undefined}
                  >
                    <span
                      className={'inline-flex h-5 w-5 items-center justify-center rounded-full ' + (checked ? 'text-white' : 'border border-border-strong')}
                      style={checked ? { background: 'var(--accent-500)' } : undefined}
                    >
                      {i + 1}
                    </span>
                    {opt}
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 flex items-center justify-between">
            <Button variant="ghost" leadingIcon={<ArrowRight size={14} strokeWidth={1.75} />} disabled={activeIdx === 0} onClick={() => setActiveIdx((i) => i - 1)}>السابق</Button>
            <Button variant="secondary" leadingIcon={<Flag size={14} strokeWidth={1.75} />} onClick={() => { const next = new Set(flagged); next.has(activeQ.id) ? next.delete(activeQ.id) : next.add(activeQ.id); setFlagged(next); }}>
              {flagged.has(activeQ.id) ? 'إزالة العلامة' : 'علم للمراجعة'}
            </Button>
            <Button variant="primary" trailingIcon={<ArrowLeft size={14} strokeWidth={1.75} />} disabled={activeIdx >= questions.length - 1} onClick={() => setActiveIdx((i) => i + 1)}>التالي</Button>
          </div>
        </Card>
      ) : (
        <LoadingState variant="card-grid" count={1} />
      )}
    </CenteredShell>
  );
}

/* ─────────── Proctor view (live sessions surface — RFP §9.E) ─────────── */

const SESSION_DOT_COLOR: Record<SessionStatus, string> = {
  'not-started': 'var(--ink-400)',
  started: 'var(--accent-500)',
  'in-progress': 'var(--gold-500)',
  dropped: 'var(--terra-500)',
  finished: 'var(--success)',
};

export function ProctorViewPage(): JSX.Element {
  const { examId = '' } = useParams<{ examId: string }>();
  const { data, isLoading, isFetching, error, refetch } = useLiveSessions(examId);
  const [filter, setFilter] = useState<'all' | SessionStatus>('all');
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [endAllOpen, setEndAllOpen] = useState(false);

  /* Tick the page wall-clock every second so elapsed/remaining cells update
     without waiting for the 5s server poll. */
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  if (!examId) {
    return (
      <CenteredShell>
        <EmptyState variant="generic" title="لم يُحدَّد اختبار" description="افتح صفحة المراقب من قائمة الاختبارات." />
      </CenteredShell>
    );
  }

  if (error) {
    return (
      <CenteredShell>
        <ErrorState error={error} onRetry={() => refetch()} />
      </CenteredShell>
    );
  }

  const sessions = data?.sessions ?? [];
  const totals = data?.totalsByStatus ?? {
    'not-started': 0, started: 0, 'in-progress': 0, dropped: 0, finished: 0,
  };
  const total = sessions.length;
  const lastUpdatedRel = data ? fmtDate(data.lastUpdated, 'rel') : '—';

  const donutData = [
    { label: SESSION_STATUS_LABEL['in-progress'], value: totals['in-progress'], color: SESSION_DOT_COLOR['in-progress'] },
    { label: SESSION_STATUS_LABEL.started, value: totals.started, color: SESSION_DOT_COLOR.started },
    { label: SESSION_STATUS_LABEL['not-started'], value: totals['not-started'], color: SESSION_DOT_COLOR['not-started'] },
    { label: SESSION_STATUS_LABEL.dropped, value: totals.dropped, color: SESSION_DOT_COLOR.dropped },
    { label: SESSION_STATUS_LABEL.finished, value: totals.finished, color: SESSION_DOT_COLOR.finished },
  ];

  const handleEndAll = (): void => {
    setEndAllOpen(false);
    toast('تم إرسال طلب إنهاء الاختبار لجميع المختبرين', 'warning');
  };

  const handleExtend = (): void => {
    toast('تم تمديد الوقت 5 دقائق لجميع المختبرين', 'success');
  };

  const handleExportProgress = (): void => {
    const header = ['الكود', 'الاسم', 'الحالة', 'أُجيب', 'إجمالي', 'IP', 'MAC'].map((h) => `"${h}"`).join(',');
    const rows = sessions.map((s) =>
      [
        s.applicantId, s.applicantName, SESSION_STATUS_LABEL[s.status],
        s.questionsAnswered, s.totalQuestions, s.ip, s.mac,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','),
    );
    const csv = '﻿' + [header, ...rows].join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `proctor-${examId}-progress.csv`);
    toast('تم تصدير ملف التقدّم', 'success');
  };

  return (
    <CenteredShell>
      <PageHeader
        title="مراقبة الاختبار"
        subtitle={`متابعة لحظية لمختبري الاختبار ${examId}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" leadingIcon={<Download size={14} strokeWidth={1.75} />} onClick={handleExportProgress}>
              تصدير التقدّم
            </Button>
            <Button
              size="sm"
              leadingIcon={<Clock size={14} strokeWidth={1.75} />}
              onClick={handleExtend}
              className="border border-gold-300 bg-gold-50 text-gold-700 hover:bg-gold-100"
              variant="secondary"
            >
              تمديد الوقت 5 دقائق
            </Button>
            <Button variant="danger" size="sm" leadingIcon={<Pause size={14} strokeWidth={1.75} />} onClick={() => setEndAllOpen(true)}>
              إنهاء للجميع
            </Button>
          </div>
        }
      />

      {/* KPI strip */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <StatCard
          label="إجمالي المختبرين"
          value={total}
          icon={<Users size={16} strokeWidth={1.75} />}
        />
        <StatCard
          label={SESSION_STATUS_LABEL['not-started']}
          value={totals['not-started']}
          icon={<DotIcon color={SESSION_DOT_COLOR['not-started']} />}
          iconBg="var(--ink-100)"
          iconColor="var(--ink-700)"
        />
        <StatCard
          label={SESSION_STATUS_LABEL.started}
          value={totals.started}
          icon={<DotIcon color={SESSION_DOT_COLOR.started} />}
          iconBg="var(--accent-50)"
          iconColor="var(--accent-700)"
        />
        <StatCard
          label={SESSION_STATUS_LABEL['in-progress']}
          value={totals['in-progress']}
          icon={<DotIcon color={SESSION_DOT_COLOR['in-progress']} pulse />}
          iconBg="var(--gold-50)"
          iconColor="var(--gold-700)"
        />
        <StatCard
          label={SESSION_STATUS_LABEL.dropped}
          value={totals.dropped}
          icon={<DotIcon color={SESSION_DOT_COLOR.dropped} />}
          iconBg="var(--terra-50)"
          iconColor="var(--terra-700)"
        />
      </div>

      <div className="mt-2 flex items-center gap-2 text-2xs text-ink-500">
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{
            background: isFetching ? 'var(--accent-500)' : 'var(--ink-300)',
            animation: isFetching ? 'sessionPulse 1.6s cubic-bezier(0.4,0,0.6,1) infinite' : undefined,
          }}
        />
        <span>آخر تحديث: {lastUpdatedRel}</span>
        <span className="ms-2">·</span>
        <span>تحديث تلقائي كل 5 ثوانٍ</span>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <LiveSessionsTable
            sessions={sessions}
            loading={isLoading}
            now={now}
            totalsByStatus={totals}
            filter={filter}
            onFilterChange={setFilter}
            search={search}
            onSearchChange={setSearch}
          />
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader title="نظرة عامة" subtitle="توزيع حالات المختبرين" />
            <DonutChart data={donutData} centerLabel="مختبر" size={200} />
          </Card>

          <Card>
            <CardHeader title="إيقاع الإجابات" subtitle="آخر 60 دقيقة" />
            <AnswersHeatStrip data={data?.answersPerMinute ?? []} />
          </Card>
        </div>
      </div>

      <Modal
        open={endAllOpen}
        onClose={() => setEndAllOpen(false)}
        size="sm"
        title="إنهاء الاختبار للجميع"
        subtitle="سيُحفظ تقدّم كل مختبر فوراً ويُغلَق نموذج الإجابة."
        withFlourishes={false}
        transparentBackdrop={false}
      >
        <Modal.Body>
          <div
            className="flex items-start gap-2 rounded-md border border-dashed p-3 text-2xs"
            style={{ borderColor: 'var(--terra-300)', background: 'var(--terra-50)', color: 'var(--terra-700)' }}
          >
            <WifiOff size={13} strokeWidth={1.75} className="mt-0.5 flex-shrink-0" aria-hidden />
            <p>هذا الإجراء غير قابل للتراجع. تأكد من اعتماد التمديد قبل الإنهاء إن لزم.</p>
          </div>
          <p className="mt-3 text-sm text-ink-700">
            عدد المختبرين النشطين الآن:{' '}
            <span className="font-numeric tnum font-bold text-ink-900">
              {num(totals['in-progress'] + totals.started)}
            </span>
            .
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setEndAllOpen(false)}>إلغاء</Button>
          <Button variant="danger" onClick={handleEndAll}>تأكيد الإنهاء</Button>
        </Modal.Footer>
      </Modal>
    </CenteredShell>
  );
}

function DotIcon({ color, pulse }: { color: string; pulse?: boolean }): JSX.Element {
  return (
    <span
      aria-hidden
      className="inline-block h-2 w-2 rounded-full"
      style={{
        background: color,
        animation: pulse ? 'sessionPulse 1.6s cubic-bezier(0.4,0,0.6,1) infinite' : undefined,
      }}
    />
  );
}

function AnswersHeatStrip({ data }: { data: readonly number[] }): JSX.Element {
  if (data.length === 0) {
    return <p className="py-4 text-center text-2xs text-ink-500">لا توجد بيانات.</p>;
  }
  const max = Math.max(...data, 1);
  return (
    <div>
      <div className="grid grid-cols-12 gap-0.5">
        {data.map((v, i) => {
          const intensity = v / max;
          return (
            <span
              key={i}
              title={`الدقيقة −${data.length - i}: ${v} إجابة`}
              className="h-5 w-full rounded-sm"
              style={{
                background: `color-mix(in srgb, var(--accent-500) ${Math.round(intensity * 100)}%, var(--ink-100))`,
              }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-2xs text-ink-500">
        <span>−60 دقيقة</span>
        <span>الآن</span>
      </div>
    </div>
  );
}

/* ─────────── Exams list refresh ─────────── */

export function ExamsListPageNew(): JSX.Element {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['exams', 'list'],
    queryFn: () => examsService.listExams(),
  });

  const exams = data ?? [];
  const counts = {
    total: exams.length,
    published: exams.filter((e) => e.status === 'published').length,
    drafts: exams.filter((e) => e.status === 'draft').length,
    completed: exams.filter((e) => e.status === 'completed').length,
  };

  const columns: DataTableColumn<ExamConfig>[] = [
    {
      key: 'name',
      label: 'الاسم',
      render: (e) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-ink-900">{e.nameAr}</span>
          <span className="font-mono text-2xs text-ink-500" dir="ltr">{e.id}</span>
        </div>
      ),
    },
    { key: 'cycle', label: 'الدورة', hideOn: 'sm', render: (e) => e.cycleId },
    {
      key: 'scheduled',
      label: 'الموعد',
      render: (e) => (
        <span className="font-numeric tnum">{fmtDate(e.scheduledFor, 'short')}</span>
      ),
    },
    { key: 'questions', label: 'الأسئلة', numeric: true, render: (e) => num(e.questionIds.length) },
    {
      key: 'status',
      label: 'الحالة',
      render: (e) => (
        <Badge tone={e.status === 'published' ? 'success' : e.status === 'completed' ? 'info' : 'warning'}>
          {e.status === 'published' && <IconStamp width={12} height={12} className="me-1 inline-block" />}
          {e.status === 'published' ? 'منشور' : e.status === 'completed' ? 'منتهي' : 'مسودّة'}
        </Badge>
      ),
    },
    {
      key: '_actions',
      label: <span className="sr-only">إجراءات</span>,
      align: 'end',
      render: (e) => (
        <div className="inline-flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Wifi size={12} strokeWidth={1.75} />}
            onClick={() => navigate(ROUTES.questionBank.examProctor(e.id))}
          >
            مراقبة
          </Button>
        </div>
      ),
    },
  ];

  if (error) {
    return (
      <CenteredShell>
        <ErrorState error={error} onRetry={() => refetch()} />
      </CenteredShell>
    );
  }

  return (
    <CenteredShell>
      <PageHeader
        title="الاختبارات الإلكترونية"
        subtitle="إدارة قوالب الاختبارات وجدولتها"
        actions={
          <Button
            variant="primary"
            leadingIcon={<Plus size={14} strokeWidth={1.75} />}
            onClick={() => navigate(ROUTES.questionBank.examCreate)}
          >
            اختبار جديد
          </Button>
        }
      />
      <div className="mb-5 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <StatCard label="إجمالي الاختبارات" value={counts.total} icon={<FileText size={16} strokeWidth={1.75} />} />
        <StatCard label="منشور" value={counts.published} icon={<CheckCircle2 size={16} strokeWidth={1.75} />} iconBg="var(--success-bg)" iconColor="var(--success)" />
        <StatCard label="مسوّدات" value={counts.drafts} icon={<Pencil size={16} strokeWidth={1.75} />} iconBg="var(--gold-50)" iconColor="var(--gold-700)" />
        <StatCard label="منتهية" value={counts.completed} icon={<ShieldCheck size={16} strokeWidth={1.75} />} iconBg="var(--ink-100)" iconColor="var(--ink-700)" />
      </div>
      <Card>
        <DataTable
          data={exams}
          columns={columns}
          rowKey={(e) => e.id}
          loading={isLoading}
          empty={
            <EmptyState
              variant="generic"
              title="لا توجد اختبارات"
              description="ابدأ بإنشاء أول قالب اختبار للدورة الحالية."
              action={
                <Button
                  variant="primary"
                  leadingIcon={<Plus size={14} strokeWidth={1.75} />}
                  onClick={() => navigate(ROUTES.questionBank.examCreate)}
                >
                  اختبار جديد
                </Button>
              }
            />
          }
          zebraStripes
          density="compact"
        />
      </Card>
    </CenteredShell>
  );
}
