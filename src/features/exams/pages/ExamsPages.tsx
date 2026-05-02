import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Plus } from 'lucide-react';
import { PageHeader, Card, CardHeader, CardBody, Button, Badge } from '@/shared/components';
import { BarChart, DonutChart } from '@/shared/components/charts';
import { examsService } from '../api/exams.service';
import { MOCK } from '@/shared/mock-data';
import { num } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';

export function QuestionBankPage(): JSX.Element {
  const [category, setCategory] = useState<string>('all');
  const [difficulty, setDifficulty] = useState<string>('all');

  const { data: categories } = useQuery({ queryKey: ['exams', 'categories'], queryFn: () => examsService.getCategories() });
  const { data: questions } = useQuery({
    queryKey: ['exams', 'legacy-questions'],
    queryFn: () => examsService.listLegacyQuestions(),
    select: (rows) =>
      rows
        .filter((q) => (category === 'all' ? true : q.category === category))
        .filter((q) => (difficulty === 'all' ? true : q.difficulty === difficulty)),
  });

  return (
    <>
      <PageHeader
        title="بنك الأسئلة"
        subtitle="إدارة وتصنيف أسئلة الاختبارات الإلكترونية"
        actions={<Button variant="primary" leadingIcon={<Plus size={16} />}>سؤال جديد</Button>}
      />

      <Card className="mb-6">
        <CardHeader title="التصنيفات" subtitle="الأسئلة المُتاحة حسب المادة" />
        <CardBody>
          <div className="grid grid-cols-auto" style={{ gap: 12 }}>
            {(categories ?? []).map((c) => (
              <button
                key={c.name}
                type="button"
                className={cn('card', category === c.name && 'border-2')}
                style={{ padding: 14, textAlign: 'right', borderColor: category === c.name ? 'var(--brand-primary)' : undefined }}
                onClick={() => setCategory(category === c.name ? 'all' : c.name)}
              >
                <div className="font-bold">{c.name}</div>
                <div className="text-xs text-tertiary mt-2">{num(c.count)} سؤال</div>
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="filters">
            <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">كل المواد</option>
              {(categories ?? []).map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
            <select className="select" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="all">كل المستويات</option>
              <option value="سهل">سهل</option>
              <option value="متوسط">متوسط</option>
              <option value="صعب">صعب</option>
            </select>
          </div>

          <div className="flex flex-col gap-4">
            {(questions ?? []).map((q) => (
              <div key={q.id} className="question-card">
                <div className="flex items-center justify-between mb-3">
                  <Badge tone="brand">{q.category}</Badge>
                  <div className="flex gap-2 items-center">
                    <Badge tone={q.difficulty === 'سهل' ? 'success' : q.difficulty === 'صعب' ? 'danger' : 'warning'}>{q.difficulty}</Badge>
                    <span className="text-xs text-tertiary mono">{q.id}</span>
                  </div>
                </div>
                <div className="question-text">{q.text}</div>
                <div className="question-options">
                  {q.options.map((o, i) => (
                    <div key={i} className={`question-option ${i === q.correctIndex ? 'correct' : ''}`}>
                      <span className="question-option-letter">{String.fromCharCode(65 + i)}</span>
                      <span className="flex-1">{o}</span>
                      {i === q.correctIndex && <CheckCircle size={18} color="#1A8754" />}
                    </div>
                  ))}
                </div>
                <div className="text-xs text-tertiary mt-3">استُخدِم في {num(q.usedCount)} اختبار</div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </>
  );
}

export function ExamsListPage(): JSX.Element {
  const exams = [
    { id: 'EX-2026-009', name: 'اختبار 2026 — الأول',  date: Date.now() - 86_400_000 * 2, status: 'done' as const,    candidates: 240 },
    { id: 'EX-2026-010', name: 'اختبار 2026 — الثاني', date: Date.now() + 86_400_000 * 1, status: 'scheduled' as const, candidates: 240 },
    { id: 'EX-2026-011', name: 'اختبار 2026 — الثالث', date: Date.now() + 86_400_000 * 8, status: 'scheduled' as const, candidates: 240 },
  ];
  return (
    <>
      <PageHeader title="الاختبارات الإلكترونية" subtitle="قائمة الاختبارات السابقة والمجدولة" />
      <Card>
        <div className="table-wrap" style={{ borderRadius: 0, border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>كود</th>
                <th>الاختبار</th>
                <th>الموعد</th>
                <th>عدد الممتحنين</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {exams.map((e) => (
                <tr key={e.id}>
                  <td className="mono font-bold">{e.id}</td>
                  <td>{e.name}</td>
                  <td>{new Date(e.date).toLocaleDateString('ar-EG')}</td>
                  <td className="mono">{num(e.candidates)}</td>
                  <td>{e.status === 'done' ? <Badge tone="success">انتهى</Badge> : <Badge tone="warning">قادم</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

export function ExamsResultsPage(): JSX.Element {
  return (
    <>
      <PageHeader title="نتائج الاختبارات" subtitle="تحليل نتائج آخر اختبار إلكتروني" />
      <div className="grid mb-6" style={{ gridTemplateColumns: '2fr 1fr', gap: 'var(--sp-5)' }}>
        <Card>
          <CardHeader title="توزيع الدرجات" />
          <CardBody>
            <BarChart data={[
              { label: '50-60', value: 12 },
              { label: '60-70', value: 28 },
              { label: '70-80', value: 64 },
              { label: '80-90', value: 88 },
              { label: '90-100', value: 48 },
            ]} color="#7C2D8E" />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="معدل الاجتياز" />
          <CardBody>
            <DonutChart data={[
              { label: 'ناجح', value: 200, color: '#1A8754' },
              { label: 'راسب', value: 40, color: '#B82C2C' },
            ]} centerLabel="ممتحن" />
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader title="أعلى التصنيفات" />
        <CardBody>
          <div className="table-wrap" style={{ border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>الترتيب</th>
                  <th>المتقدم</th>
                  <th>الكود</th>
                  <th>الدرجة</th>
                </tr>
              </thead>
              <tbody>
                {MOCK.applicants.slice(0, 10).map((a, i) => (
                  <tr key={a.id}>
                    <td className="mono font-bold">#{i + 1}</td>
                    <td>{a.name}</td>
                    <td className="mono text-xs text-tertiary">{a.id}</td>
                    <td className="mono font-bold">{(95 - i).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
