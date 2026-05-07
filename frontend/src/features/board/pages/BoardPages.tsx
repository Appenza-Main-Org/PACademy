import { PageHeader, Card, CardHeader, CardBody, StatCard, Badge, Avatar } from '@/shared/components';
import { Users, CalendarClock, Gavel, Briefcase } from 'lucide-react';
import { MOCK } from '@/shared/mock-data';
import { date as fmtDate, num } from '@/shared/lib/format';

const MEMBERS = [
  { id: 1, name: 'العميد د. أحمد محمود الفقي', role: 'رئيس الهيئة', sessions: 24 },
  { id: 2, name: 'العقيد أيمن شريف رمضان',     role: 'أمين السر',      sessions: 28 },
  { id: 3, name: 'العقيد محمد إبراهيم حسن',     role: 'عضو',            sessions: 22 },
  { id: 4, name: 'الرائد طارق علي الخطيب',       role: 'عضو',            sessions: 19 },
  { id: 5, name: 'الرائد ياسر هشام منصور',       role: 'عضو',            sessions: 21 },
];

const SESSIONS = [
  { id: 'S-2026-014', date: Date.now() + 86_400_000 * 2, agenda: 'استعراض نتائج الكشف الطبي للدفعة الأولى', status: 'scheduled' as const },
  { id: 'S-2026-013', date: Date.now() - 86_400_000 * 2, agenda: 'مناقشة طلبات إعادة التظلم — 14 طلب',         status: 'done' as const },
  { id: 'S-2026-012', date: Date.now() - 86_400_000 * 5, agenda: 'إقرار قوائم المتقدمين المُحالين للجان',     status: 'done' as const },
  { id: 'S-2026-011', date: Date.now() - 86_400_000 * 9, agenda: 'تنسيق إجراءات الاختبار الإلكتروني الموحد', status: 'done' as const },
];

const DECISIONS = [
  { id: 'D-2026-088', date: Date.now() - 86_400_000 * 3, summary: 'الموافقة على تعديل شروط القبول لذوي الهمم في الكشف الطبي', tone: 'success' as const },
  { id: 'D-2026-087', date: Date.now() - 86_400_000 * 7, summary: 'اعتماد بنك الأسئلة المُحدّث للاختبار الإلكتروني',         tone: 'info' as const },
  { id: 'D-2026-086', date: Date.now() - 86_400_000 * 12, summary: 'إيقاف 6 ملفات لظهور ملاحظات بإدارة التحريات',          tone: 'danger' as const },
  { id: 'D-2026-085', date: Date.now() - 86_400_000 * 14, summary: 'إقرار جدول الكشف الطبي للأسبوع المقبل',                  tone: 'success' as const },
];

export function BoardOverviewPage(): JSX.Element {
  return (
    <>
      <PageHeader title="الهيئة وأمانة السر" subtitle="إدارة جلسات الهيئة وقراراتها" />
      <div className="grid grid-4 mb-6">
        <StatCard label="عدد الأعضاء" value={MEMBERS.length} icon={<Users size={18} />} iconBg="var(--warning-bg)" iconColor="var(--warning)" />
        <StatCard label="جلسات هذا الشهر" value={6} icon={<CalendarClock size={18} />} iconBg="var(--teal-50)" iconColor="var(--teal-600)" />
        <StatCard label="قرارات مُعتمدة" value={28} icon={<Gavel size={18} />} iconBg="var(--success-bg)" iconColor="var(--success)" />
        <StatCard label="ملفات قيد المراجعة" value={MOCK.kpis.underReview} icon={<Briefcase size={18} />} iconBg="var(--danger-bg)" iconColor="var(--danger)" />
      </div>

      <div className="grid mb-6" style={{ gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-5)' }}>
        <Card>
          <CardHeader title="أعضاء الهيئة" subtitle="الهيئة العليا للقبول" />
          <CardBody>
            <div className="flex flex-col gap-3">
              {MEMBERS.map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <Avatar name={m.name} />
                  <div className="flex-1">
                    <div className="font-bold text-sm">{m.name}</div>
                    <div className="text-xs text-tertiary">{m.role}</div>
                  </div>
                  <span className="chip">{num(m.sessions)} جلسة</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="آخر القرارات" />
          <CardBody>
            <div className="flex flex-col gap-3">
              {DECISIONS.map((d) => (
                <div key={d.id} className="flex flex-col gap-1" style={{ paddingBottom: 12, borderBottom: '1px solid var(--border-subtle)' }}>
                  <div className="flex items-center justify-between">
                    <span className="mono text-xs text-tertiary">{d.id}</span>
                    <Badge tone={d.tone}>قرار</Badge>
                  </div>
                  <div className="text-sm">{d.summary}</div>
                  <div className="text-xs text-tertiary">{fmtDate(d.date, 'short')}</div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

export function BoardSessionsPage(): JSX.Element {
  return (
    <>
      <PageHeader title="جلسات الهيئة" subtitle="الجلسات السابقة والمجدولة" />
      <Card>
        <div className="table-wrap" style={{ borderRadius: 0, border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>رقم الجلسة</th>
                <th>الموعد</th>
                <th>جدول الأعمال</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {SESSIONS.map((s) => (
                <tr key={s.id}>
                  <td className="mono font-bold">{s.id}</td>
                  <td>{fmtDate(s.date, 'short')}</td>
                  <td>{s.agenda}</td>
                  <td>{s.status === 'scheduled' ? <Badge tone="warning">قادمة</Badge> : <Badge tone="success">منعقدة</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

export function BoardDecisionsPage(): JSX.Element {
  return (
    <>
      <PageHeader title="قرارات الهيئة" subtitle="القرارات الصادرة باسم الهيئة العليا" />
      <Card>
        <CardBody>
          <div className="flex flex-col gap-4">
            {DECISIONS.map((d) => (
              <div key={d.id} className="card" style={{ padding: 16 }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="mono font-bold">{d.id}</span>
                  <Badge tone={d.tone}>{d.tone === 'success' ? 'مُعتمد' : d.tone === 'danger' ? 'مُوقف' : 'قيد التنفيذ'}</Badge>
                </div>
                <div className="font-semibold mb-2">{d.summary}</div>
                <div className="text-xs text-tertiary">{fmtDate(d.date, 'full')}</div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </>
  );
}
