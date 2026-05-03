/**
 * Sprint 7 — Question Bank & e-Exams new pages.
 * Source: RFP Scope Document §9 sections A-G.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Eye,
  FileText,
  Flag,
  Folder,
  Pencil,
  Plus,
  Send,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  Drawer,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
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
import { examsService } from '../api/exams.service';
import type { BankQuestion, ExamAttempt, ExamConfig, QuestionStatus } from '@/shared/types/domain';

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

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="سؤال جديد" size="lg">
        <Drawer.Body>
          <form
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
            <Select label="الفئة" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} options={['قدرات لفظية', 'قدرات عددية', 'منطق', 'سرعة بديهة', 'ثقافة عامة'].map((c) => ({ value: c, label: c }))} />
            <Select label="الصعوبة" value={String(draft.difficulty)} onChange={(e) => setDraft({ ...draft, difficulty: Number(e.target.value) })} options={[1, 2, 3, 4, 5].map((d) => ({ value: String(d), label: `${d} نجوم` }))} />
            <Textarea label="نص السؤال" required value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
            {draft.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="radio" name="correct" checked={draft.correctIndex === i} onChange={() => setDraft({ ...draft, correctIndex: i })} className="h-4 w-4 cursor-pointer accent-teal-500" />
                <Input label={`الخيار ${i + 1}`} value={opt} onChange={(e) => { const next = [...draft.options]; next[i] = e.target.value; setDraft({ ...draft, options: next }); }} containerClassName="flex-1" />
              </div>
            ))}
            <Input label="الزمن (ثوانٍ)" type="number" value={draft.timeLimitSeconds} onChange={(e) => setDraft({ ...draft, timeLimitSeconds: Number(e.target.value) })} />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setDrawerOpen(false)}>إلغاء</Button>
              <Button type="submit" variant="primary">حفظ كمسودّة</Button>
            </div>
          </form>
        </Drawer.Body>
      </Drawer>
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

/* ─────────── Proctor view (live attempts feed) ─────────── */

export function ProctorViewPage(): JSX.Element {
  const { examId = '' } = useParams<{ examId: string }>();
  const { data: attempts, isLoading } = useQuery({ queryKey: ['exams', 'attempts', examId], queryFn: () => examsService.getAttempts(examId), enabled: Boolean(examId) });

  const columns: DataTableColumn<ExamAttempt>[] = useMemo(() => [
    { key: 'id', label: 'المحاولة', render: (a) => <span className="font-mono" dir="ltr">{a.id}</span> },
    { key: 'applicant', label: 'المتقدم', render: (a) => <span className="font-mono" dir="ltr">{a.applicantId}</span> },
    { key: 'startedAt', label: 'بدء', render: (a) => <span className="text-2xs text-ink-500">{fmtDate(a.startedAt, 'rel')}</span> },
    { key: 'submittedAt', label: 'تسليم', render: (a) => a.submittedAt ? <Badge tone="info">{fmtDate(a.submittedAt, 'rel')}</Badge> : <Badge tone="warning" dot>قيد الإجراء</Badge> },
    { key: 'score', label: 'الدرجة', numeric: true, render: (a) => a.score !== undefined ? `${num(a.score)}%` : '—' },
    { key: 'passFail', label: 'النتيجة', render: (a) => a.passFail ? (a.passFail === 'pass' ? <Badge tone="success">ناجح</Badge> : <Badge tone="danger">راسب</Badge>) : '—' },
  ], []);

  return (
    <CenteredShell>
      <PageHeader title="عرض المراقب" subtitle={`متابعة محاولات الاختبار ${examId} في الوقت الحقيقي`} />
      <Card>
        <DataTable data={attempts ?? []} columns={columns} rowKey={(a) => a.id} loading={isLoading} empty={<EmptyState variant="generic" title="لا توجد محاولات بعد" />} density="compact" />
      </Card>
    </CenteredShell>
  );
}

/* ─────────── Exams list refresh ─────────── */

export function ExamsListPageNew(): JSX.Element {
  const { data, isLoading } = useQuery({ queryKey: ['exams', 'list'], queryFn: () => examsService.listExams() });

  const columns: DataTableColumn<ExamConfig>[] = [
    { key: 'name', label: 'الاسم', render: (e) => e.nameAr },
    { key: 'cycle', label: 'الدورة', render: (e) => e.cycleId },
    { key: 'scheduled', label: 'الموعد', render: (e) => fmtDate(e.scheduledFor, 'short') },
    { key: 'questions', label: 'الأسئلة', numeric: true, render: (e) => num(e.questionIds.length) },
    {
      key: 'status', label: 'الحالة', render: (e) => (
        <Badge tone={e.status === 'published' ? 'success' : e.status === 'completed' ? 'info' : 'neutral'}>
          {e.status === 'published' ? 'منشور' : e.status === 'completed' ? 'منتهي' : 'مسودّة'}
        </Badge>
      ),
    },
  ];

  return (
    <CenteredShell>
      <PageHeader title="الاختبارات الإلكترونية" subtitle="إدارة قوالب الاختبارات وجدولتها" actions={
        <a href={`${ROUTES.questionBank.exams}/create`}><Button variant="primary" leadingIcon={<Plus size={14} strokeWidth={1.75} />}>اختبار جديد</Button></a>
      } />
      <Card>
        <DataTable data={data ?? []} columns={columns} rowKey={(e) => e.id} loading={isLoading} empty={<EmptyState variant="generic" title="لا توجد اختبارات" />} zebraStripes />
      </Card>
    </CenteredShell>
  );
}
