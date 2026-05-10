/**
 * Question Bank — overview, exams list, results dashboard.
 *
 * The ProctorViewPage and ExamsListPageNew live in Sprint7Pages.tsx; this
 * file backs `/question-bank` (categories overview), the legacy fallback
 * `/question-bank/exams` list, and `/question-bank/results`.
 *
 * Polish notes (post-Sprint 0):
 *  - Per-app accent: every brand color flows from `var(--accent-*)`.
 *  - Density: stat strips above the fold; cards consolidated for hierarchy.
 *  - DataTable replaces every raw `<table>` where sort/pagination matters.
 *  - Results page ships export (CSV + print) and a 4th panel with category
 *    averages — what an exams admin actually wants post-cycle.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Download,
  FileText,
  Layers,
  Pencil,
  Plus,
  Printer,
  TrendingUp,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Select,
  StatCard,
  toast,
} from '@/shared/components';
import type { DataTableColumn } from '@/shared/components';
import { BarChart, DonutChart } from '@/shared/components/charts';
import { examsService } from '../api/exams.service';
import { MOCK } from '@/shared/mock-data';
import { num } from '@/shared/lib/format';
import { downloadBlob } from '@/shared/lib/download';
import { ROUTES } from '@/config/routes';
import { cn } from '@/shared/lib/cn';

/* ─────────── Question Bank overview (`/question-bank`) ─────────── */

const DIFFICULTY_LABEL: Record<string, string> = {
  all: 'كل المستويات',
  سهل: 'سهل',
  متوسط: 'متوسط',
  صعب: 'صعب',
};

export function QuestionBankPage(): JSX.Element {
  const navigate = useNavigate();
  const [category, setCategory] = useState<string>('all');
  const [difficulty, setDifficulty] = useState<string>('all');

  const {
    data: categories,
    isLoading: catLoading,
    error: catError,
    refetch: refetchCats,
  } = useQuery({ queryKey: ['exams', 'categories'], queryFn: () => examsService.getCategories() });

  const {
    data: questions,
    isLoading: qLoading,
    error: qError,
    refetch: refetchQs,
  } = useQuery({
    queryKey: ['exams', 'legacy-questions'],
    queryFn: () => examsService.listLegacyQuestions(),
    select: (rows) =>
      rows
        .filter((q) => (category === 'all' ? true : q.category === category))
        .filter((q) => (difficulty === 'all' ? true : q.difficulty === difficulty)),
  });

  const totalCategoryQuestions = useMemo(
    () => (categories ?? []).reduce((s, c) => s + c.count, 0),
    [categories],
  );

  if (catError || qError) {
    return (
      <ErrorState
        error={(catError ?? qError) as Error}
        onRetry={() => {
          if (catError) void refetchCats();
          if (qError) void refetchQs();
        }}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="بنك الأسئلة"
        subtitle="إدارة وتصنيف أسئلة الاختبارات الإلكترونية"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(ROUTES.questionBank.crud)}
            >
              إدارة الأسئلة (دفق الاعتماد)
            </Button>
            <Button
              variant="primary"
              leadingIcon={<Plus size={14} strokeWidth={1.75} />}
              onClick={() => navigate(ROUTES.questionBank.crud)}
            >
              سؤال جديد
            </Button>
          </div>
        }
      />

      {/* Density: 4 KPIs above the fold so the page reads at a glance. */}
      <div className="mb-5 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <StatCard
          label="إجمالي الأسئلة"
          value={totalCategoryQuestions}
          icon={<FileText size={16} strokeWidth={1.75} />}
        />
        <StatCard
          label="الفئات"
          value={categories?.length ?? 0}
          icon={<Layers size={16} strokeWidth={1.75} />}
          iconBg="var(--accent-50)"
          iconColor="var(--accent-700)"
        />
        <StatCard
          label="مسودّات"
          value={(questions ?? []).filter((q) => q.difficulty === 'سهل').length}
          icon={<Pencil size={16} strokeWidth={1.75} />}
          iconBg="var(--gold-50)"
          iconColor="var(--gold-700)"
        />
        <StatCard
          label="جاهزة للاختبار"
          value={(questions ?? []).length}
          icon={<CheckCircle2 size={16} strokeWidth={1.75} />}
          iconBg="var(--success-bg)"
          iconColor="var(--success)"
        />
      </div>

      <Card className="mb-5">
        <CardHeader title="الفئات" subtitle="الأسئلة المتاحة حسب المادة" />
        <CardBody>
          {catLoading ? (
            <LoadingState variant="card-grid" count={5} />
          ) : (
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              {(categories ?? []).map((c) => {
                const active = category === c.name;
                return (
                  <button
                    key={c.name}
                    type="button"
                    className={cn(
                      'group relative flex flex-col items-end overflow-hidden rounded-md border border-border-default bg-surface-card px-4 py-3 text-end transition-all duration-fast ease-standard hover:-translate-y-px hover:shadow-sm focus-visible:outline-none focus-visible:shadow-focus-teal',
                      active && 'shadow-sm',
                    )}
                    style={
                      active
                        ? {
                            borderColor: 'var(--accent-500)',
                            background:
                              'linear-gradient(to bottom, var(--accent-50) 0%, var(--surface-card) 60%)',
                          }
                        : undefined
                    }
                    aria-pressed={active}
                    onClick={() => setCategory(active ? 'all' : c.name)}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'absolute inset-x-0 top-0 h-[3px] origin-inline-end transition-transform duration-base ease-standard',
                        active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100',
                      )}
                      style={{ background: 'var(--accent-500)' }}
                    />
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors duration-fast ease-standard"
                      style={{ background: 'var(--accent-50)', color: 'var(--accent-600)' }}
                    >
                      <BookOpen size={16} strokeWidth={1.75} aria-hidden />
                    </span>
                    <span className="mt-2 text-sm font-bold text-ink-900">{c.name}</span>
                    <span className="mt-1 font-numeric tnum text-2xs text-ink-500">{num(c.count)} سؤال</span>
                  </button>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="الأسئلة"
          actions={
            <div className="flex items-center gap-2">
              <Select
                aria-label="تصفية حسب الفئة"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                options={[
                  { value: 'all', label: 'كل المواد' },
                  ...(categories ?? []).map((c) => ({ value: c.name, label: c.name })),
                ]}
              />
              <Select
                aria-label="تصفية حسب الصعوبة"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                options={Object.entries(DIFFICULTY_LABEL).map(([v, l]) => ({ value: v, label: l }))}
              />
            </div>
          }
        />
        <CardBody>
          {qLoading ? (
            <LoadingState variant="card-grid" count={3} />
          ) : (questions ?? []).length === 0 ? (
            <EmptyState variant="no-questions" />
          ) : (
            <ul className="flex flex-col gap-4">
              {(questions ?? []).slice(0, 24).map((q) => (
                <li
                  key={q.id}
                  className="rounded-md border border-border-subtle bg-surface-card p-4"
                >
                  <header className="mb-3 flex items-center justify-between gap-2">
                    <Badge tone="accent">{q.category}</Badge>
                    <div className="inline-flex items-center gap-2">
                      <Badge tone={q.difficulty === 'سهل' ? 'success' : q.difficulty === 'صعب' ? 'danger' : 'warning'}>
                        {q.difficulty}
                      </Badge>
                      <span className="font-mono text-2xs text-ink-500" dir="ltr">{q.id}</span>
                    </div>
                  </header>
                  <p className="text-sm font-medium text-ink-900">{q.text}</p>
                  <ol className="mt-3 grid gap-2 sm:grid-cols-2">
                    {q.options.map((opt, i) => {
                      const correct = i === q.correctIndex;
                      return (
                        <li
                          key={i}
                          className="flex items-center gap-2 rounded-md border px-3 py-2 text-2xs"
                          style={
                            correct
                              ? { borderColor: 'var(--success)', background: 'var(--success-bg)', color: 'var(--success)' }
                              : { borderColor: 'var(--border-subtle)', color: 'var(--ink-700)' }
                          }
                        >
                          <span
                            aria-hidden
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full font-mono text-2xs font-bold"
                            style={
                              correct
                                ? { background: 'var(--success)', color: '#fff' }
                                : { background: 'var(--ink-100)', color: 'var(--ink-700)' }
                            }
                          >
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="flex-1">{opt}</span>
                          {correct && <CheckCircle2 size={13} strokeWidth={2} aria-hidden />}
                        </li>
                      );
                    })}
                  </ol>
                  <p className="mt-3 text-2xs text-ink-500">
                    استُخدِم في <span className="font-numeric tnum">{num(q.usedCount)}</span> اختبار
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}

/* ─────────── Exams list (legacy `/question-bank/exams` fallback) ─────────── */

interface LegacyExamRow {
  id: string;
  name: string;
  date: number;
  status: 'done' | 'scheduled';
  candidates: number;
}

export function ExamsListPage(): JSX.Element {
  const exams: LegacyExamRow[] = [
    { id: 'EX-2026-009', name: 'اختبار 2026 — الأول',  date: Date.now() - 86_400_000 * 2, status: 'done',      candidates: 240 },
    { id: 'EX-2026-010', name: 'اختبار 2026 — الثاني', date: Date.now() + 86_400_000 * 1, status: 'scheduled', candidates: 240 },
    { id: 'EX-2026-011', name: 'اختبار 2026 — الثالث', date: Date.now() + 86_400_000 * 8, status: 'scheduled', candidates: 240 },
  ];

  const columns: DataTableColumn<LegacyExamRow>[] = [
    {
      key: 'id',
      label: 'كود',
      width: 140,
      render: (e) => <span className="font-mono text-xs" dir="ltr">{e.id}</span>,
    },
    { key: 'name', label: 'الاختبار', render: (e) => e.name },
    {
      key: 'date',
      label: 'الموعد',
      render: (e) => (
        <span className="font-numeric tnum">{new Date(e.date).toLocaleDateString('ar-EG')}</span>
      ),
    },
    { key: 'candidates', label: 'عدد الممتحنين', numeric: true, render: (e) => num(e.candidates) },
    {
      key: 'status',
      label: 'الحالة',
      render: (e) =>
        e.status === 'done'
          ? <Badge tone="success">انتهى</Badge>
          : <Badge tone="warning">قادم</Badge>,
    },
  ];

  return (
    <>
      <PageHeader title="الاختبارات الإلكترونية" subtitle="قائمة الاختبارات السابقة والمجدولة" />
      <Card>
        <DataTable
          data={exams}
          columns={columns}
          rowKey={(e) => e.id}
          empty={<EmptyState variant="generic" title="لا توجد اختبارات" />}
          density="compact"
          zebraStripes
        />
      </Card>
    </>
  );
}

/* ─────────── Results dashboard (`/question-bank/results`) ─────────── */

interface ResultRow {
  rank: number;
  applicantId: string;
  name: string;
  score: number;
  category: string;
}

export function ExamsResultsPage(): JSX.Element {
  const rows: ResultRow[] = useMemo(() => {
    const cats = ['قدرات لفظية', 'قدرات عددية', 'منطق', 'سرعة بديهة', 'ثقافة عامة'];
    return MOCK.applicants.slice(0, 200).map((a, i) => ({
      rank: i + 1,
      applicantId: a.id,
      name: a.name,
      /* Deterministic mid-90s descending so the table sorts cleanly. */
      score: Math.max(50, 96 - i * 0.18 - ((i * 13) % 7)),
      category: cats[i % cats.length],
    }));
  }, []);

  const summary = useMemo(() => {
    const total = rows.length;
    const passed = rows.filter((r) => r.score >= 60).length;
    const avg = rows.reduce((s, r) => s + r.score, 0) / Math.max(1, total);
    const top = Math.max(...rows.map((r) => r.score));
    return { total, passed, failed: total - passed, avg, top };
  }, [rows]);

  const distribution = useMemo(() => {
    const buckets: { label: string; value: number }[] = [
      { label: '50–60', value: 0 },
      { label: '60–70', value: 0 },
      { label: '70–80', value: 0 },
      { label: '80–90', value: 0 },
      { label: '90–100', value: 0 },
    ];
    for (const r of rows) {
      const i = Math.min(4, Math.max(0, Math.floor((r.score - 50) / 10)));
      buckets[i].value += 1;
    }
    return buckets;
  }, [rows]);

  const categoryAverages = useMemo(() => {
    const map = new Map<string, { sum: number; n: number }>();
    for (const r of rows) {
      const cur = map.get(r.category) ?? { sum: 0, n: 0 };
      cur.sum += r.score;
      cur.n += 1;
      map.set(r.category, cur);
    }
    return Array.from(map.entries()).map(([label, { sum, n }]) => ({
      label,
      value: Math.round((sum / Math.max(1, n)) * 10) / 10,
    }));
  }, [rows]);

  const handleExportCsv = (): void => {
    const header = ['الترتيب', 'الكود', 'الاسم', 'الفئة', 'الدرجة'].map((h) => `"${h}"`).join(',');
    const lines = rows.map((r) =>
      [r.rank, r.applicantId, r.name, r.category, r.score.toFixed(1)]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(','),
    );
    const csv = '﻿' + [header, ...lines].join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'exam-results.csv');
    toast('تم تصدير ملف النتائج', 'success');
  };

  const handlePrint = (): void => {
    if (typeof window !== 'undefined') window.print();
  };

  const columns: DataTableColumn<ResultRow>[] = [
    {
      key: 'rank',
      label: 'الترتيب',
      align: 'center',
      width: 80,
      numeric: true,
      render: (r) => <span className="font-numeric tnum font-bold">#{num(r.rank)}</span>,
    },
    {
      key: 'name',
      label: 'المتقدم',
      render: (r) => <span className="text-sm text-ink-900">{r.name}</span>,
    },
    {
      key: 'applicantId',
      label: 'الكود',
      hideOn: 'sm',
      render: (r) => <span className="font-mono text-2xs text-ink-500" dir="ltr">{r.applicantId}</span>,
    },
    {
      key: 'category',
      label: 'الفئة',
      hideOn: 'md',
      render: (r) => <Badge tone="neutral">{r.category}</Badge>,
    },
    {
      key: 'score',
      label: 'الدرجة',
      numeric: true,
      align: 'end',
      render: (r) => (
        <span
          className="font-numeric tnum font-bold"
          style={{ color: r.score >= 60 ? 'var(--success)' : 'var(--terra-700)' }}
        >
          {r.score.toFixed(1)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="نتائج الاختبارات"
        subtitle="تحليل نتائج آخر اختبار إلكتروني"
        actions={
          <div className="flex items-center gap-2 print:hidden">
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<Download size={14} strokeWidth={1.75} />}
              onClick={handleExportCsv}
            >
              تصدير CSV
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<Printer size={14} strokeWidth={1.75} />}
              onClick={handlePrint}
            >
              طباعة (PDF)
            </Button>
          </div>
        }
      />

      {/* Density first: 5 KPIs in one strip. */}
      <div className="mb-5 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <StatCard label="إجمالي الممتحنين" value={summary.total} icon={<FileText size={16} strokeWidth={1.75} />} />
        <StatCard
          label="ناجحون"
          value={summary.passed}
          icon={<CheckCircle2 size={16} strokeWidth={1.75} />}
          iconBg="var(--success-bg)"
          iconColor="var(--success)"
        />
        <StatCard
          label="راسبون"
          value={summary.failed}
          icon={<TrendingUp size={16} strokeWidth={1.75} />}
          iconBg="var(--terra-50)"
          iconColor="var(--terra-700)"
        />
        <StatCard
          label="المتوسط العام"
          value={summary.avg.toFixed(1)}
          icon={<Award size={16} strokeWidth={1.75} />}
          iconBg="var(--gold-50)"
          iconColor="var(--gold-700)"
        />
        <StatCard
          label="أعلى درجة"
          value={summary.top.toFixed(1)}
          icon={<Award size={16} strokeWidth={1.75} />}
          iconBg="var(--accent-50)"
          iconColor="var(--accent-700)"
        />
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="توزيع الدرجات" subtitle="عدد الممتحنين في كل شريحة" />
          <CardBody>
            <BarChart data={distribution} color="var(--gold-500)" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="معدل الاجتياز" />
          <CardBody>
            <DonutChart
              data={[
                { label: 'ناجح', value: summary.passed, color: 'var(--success)' },
                { label: 'راسب', value: summary.failed, color: 'var(--terra-500)' },
              ]}
              centerLabel="ممتحن"
            />
          </CardBody>
        </Card>
      </div>

      {/* 4th panel: per-category averages — what an exams admin asks for after every cycle. */}
      <Card className="mb-5">
        <CardHeader
          title="متوسط الدرجات حسب الفئة"
          subtitle="يكشف الفئة الأصعب على المتقدمين هذه الدورة"
        />
        <CardBody>
          <CategoryAveragesChart data={categoryAverages} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="ترتيب المتقدمين" subtitle={`${num(summary.total)} مختبر — مرتّبون تنازلياً حسب الدرجة`} />
        <DataTable
          data={rows}
          columns={columns}
          rowKey={(r) => r.applicantId}
          empty={<EmptyState variant="generic" title="لا توجد نتائج" />}
          density="compact"
          zebraStripes
          pagination={{
            page: 1,
            pageSize: 20,
            total: rows.length,
            onPageChange: () => undefined,
          }}
        />
      </Card>
    </>
  );
}

function CategoryAveragesChart({ data }: { data: ReadonlyArray<{ label: string; value: number }> }): JSX.Element {
  if (data.length === 0) {
    return <p className="py-4 text-center text-2xs text-ink-500">لا توجد بيانات.</p>;
  }
  const max = Math.max(...data.map((d) => d.value), 100);
  return (
    <ul className="flex flex-col gap-3">
      {data.map((d) => {
        const pct = (d.value / max) * 100;
        return (
          <li key={d.label} className="grid grid-cols-[140px_1fr_60px] items-center gap-3">
            <span className="text-sm text-ink-700">{d.label}</span>
            <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--ink-100)' }}>
              <span
                aria-hidden
                className="block h-full rounded-full"
                style={{ width: `${pct}%`, background: 'var(--accent-500)' }}
              />
            </div>
            <span className="font-numeric tnum text-end text-sm font-bold text-ink-900">{d.value.toFixed(1)}</span>
          </li>
        );
      })}
    </ul>
  );
}
