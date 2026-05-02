import { useState } from 'react';
import { Building2, Cloud, Code2, Cog, Database, Globe, Lock, Network, ServerCog } from 'lucide-react';
import { AppShell } from '@/app/layouts/AppShell';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { Badge, Card, CardBody, CardHeader, Drawer, PageHeader } from '@/shared/components';

const TIERS = [
  { label: 'طبقة الإنترنت', color: '#1A8754', bg: '#D7F0E1', blocks: [{ icon: '🌐', title: 'موقع المتقدمين', meta: '1.2' }, { icon: '⚙️', title: 'إدارة المنظومة', meta: '1.1' }] },
  { label: 'طبقة الأمن (DMZ)', color: '#B82C2C', bg: '#FBD6D6', blocks: [{ icon: '🛡️', title: 'WAF + IDS', meta: 'حماية' }, { icon: '🔒', title: 'API Gateway', meta: 'OAuth2 / JWT' }, { icon: '🔐', title: 'Identity Server', meta: 'RBAC + MFA' }] },
  { label: 'الشبكة الداخلية', color: '#2D5BA0', bg: '#DDE7F2', blocks: [{ icon: '📋', title: 'لجان القبول', meta: '2.1' }, { icon: '⚖️', title: 'الهيئة', meta: '2.2' }, { icon: '🔍', title: 'التحريات', meta: '2.3' }, { icon: '🩺', title: 'القومسيون الطبي', meta: '2.4' }, { icon: '🏷️', title: 'الباركود', meta: '2.5' }, { icon: '👁️', title: 'البيومتري', meta: '2.6' }, { icon: '📝', title: 'بنك الأسئلة', meta: '2.7' }] },
  { label: 'طبقة الخدمات (Services)', color: '#6B46C1', bg: '#E5DEF5', blocks: [{ icon: '🔧', title: 'Auth Service', meta: 'JWT + RBAC' }, { icon: '🧾', title: 'Applicant Service', meta: 'CQRS' }, { icon: '🩺', title: 'Medical Service', meta: 'Workflow' }, { icon: '📝', title: 'Exam Engine', meta: 'MCQ Engine' }, { icon: '🔍', title: 'Investigation Service', meta: 'Crypto' }] },
  { label: 'طبقة البيانات', color: '#B8770A', bg: '#FBE9CC', blocks: [{ icon: '🗄️', title: 'PostgreSQL', meta: 'OLTP' }, { icon: '🔎', title: 'Elasticsearch', meta: 'بحث' }, { icon: '📊', title: 'ClickHouse', meta: 'تقارير' }, { icon: '🧊', title: 'Redis', meta: 'كاش' }, { icon: '📦', title: 'MinIO', meta: 'مستندات' }] },
  { label: 'تكاملات حكومية', color: '#0E8E8E', bg: '#C8EBEB', blocks: [{ icon: '🪪', title: 'منصة التحقق الرقمي', meta: 'NID API' }, { icon: '💳', title: 'بوابة الدفع', meta: 'E-Pay' }, { icon: '🎓', title: 'الثانوية العامة', meta: 'وزارة التعليم' }, { icon: '👨‍👩‍👧‍👦', title: 'الأحوال المدنية', meta: 'سجل عائلي' }, { icon: '🏥', title: 'القطاع الطبي', meta: 'وزارة الصحة' }, { icon: '🚓', title: 'الأمن العام', meta: 'تحريات' }] },
];

const STACK = [
  { icon: <Code2 size={20} />, title: 'Frontend',     items: ['React 18 + TypeScript', 'Vite + Tailwind', 'TanStack Query', 'Zustand', 'shadcn/ui patterns'] },
  { icon: <ServerCog size={20} />, title: 'Backend',  items: ['Node.js / .NET 8', 'REST + GraphQL', 'Workflow Engine', 'CQRS / Event Sourcing'] },
  { icon: <Database size={20} />, title: 'Data',       items: ['PostgreSQL 16', 'Elasticsearch', 'ClickHouse', 'Redis 7', 'MinIO Object Store'] },
  { icon: <Lock size={20} />, title: 'Security',       items: ['OAuth2 + JWT', 'mTLS داخلي', 'WAF + IDS', 'تشفير at-rest + in-transit', 'Audit Trail شامل'] },
  { icon: <Cloud size={20} />, title: 'DevOps',        items: ['Kubernetes', 'GitOps (ArgoCD)', 'Prometheus + Grafana', 'OpenTelemetry'] },
  { icon: <Globe size={20} />, title: 'Integration',   items: ['ESB ESCo', 'منصات حكومية', 'EAI Gateway', 'Event Streaming (Kafka)'] },
];

const INTEGRATIONS = [
  { system: 'منصة التحقق الرقمي',     endpoint: 'POST /verify/nid',         auth: 'OAuth2',    purpose: 'التحقق من الرقم القومي', status: 'متصل' as const },
  { system: 'بوابة الدفع الإلكتروني', endpoint: 'POST /payment/initiate',   auth: 'API Key',  purpose: 'سداد رسوم التقدم',        status: 'متصل' as const },
  { system: 'الثانوية العامة',         endpoint: 'GET  /students/:nid',     auth: 'mTLS',      purpose: 'استرجاع المجموع والشهادة', status: 'متصل' as const },
  { system: 'الأحوال المدنية',         endpoint: 'GET  /family/:nid',       auth: 'OAuth2',    purpose: 'الوثيقة الأسرية',         status: 'متصل' as const },
  { system: 'الأمن العام (تحريات)',    endpoint: 'POST /investigation',     auth: 'mTLS+Sign', purpose: 'إحالة طلب التحريات',      status: 'قيد التحقق' as const },
  { system: 'القطاع الطبي',            endpoint: 'POST /medical/results',   auth: 'OAuth2',    purpose: 'تبادل النتائج الطبية',     status: 'متصل' as const },
];

export function ArchitecturePage(): JSX.Element {
  const [openIntegration, setOpenIntegration] = useState<typeof INTEGRATIONS[number] | null>(null);

  return (
    <AppShell appLabel="معمارية النظام">
      <CenteredShell>
        <PageHeader
          title="معمارية المنظومة"
          subtitle="رؤية متعدد الطبقات تربط ٩ تطبيقات بـ ٦ تكاملات حكومية"
        />

        <Card className="mb-6">
          <CardHeader title="المعمارية الرئيسية — 4 طبقات (K§9)" subtitle="نموذج عالي المستوى لاتصال الواجهات والخدمات والبيانات" actions={<Network size={16} strokeWidth={1.75} />} />
          <CardBody>
            <div className="grid gap-3 md:grid-cols-4">
              <FourLayerCard color="var(--teal-500)" title="بوابات عامة" subtitle="Public Portals" items={['موقع المتقدمين', 'بوابة الإعلانات', 'CDN'] } />
              <FourLayerCard color="var(--gold-500)" title="الـ Middleware" subtitle="API Gateway · Auth · ESB" items={['API Gateway', 'OAuth2/OIDC', 'Event Bus', 'WAF + IDS']} />
              <FourLayerCard color="var(--terra-500)" title="بوابات خاصة" subtitle="Private Portals" items={['الإدارة', 'اللجان', 'الهيئة', 'التحريات', 'القومسيون', 'الباركود/البيومتري', 'بنك الأسئلة']} />
              <FourLayerCard color="var(--ink-700)" title="طبقة البيانات" subtitle="Database · Object Store" items={['PostgreSQL', 'Elasticsearch', 'ClickHouse', 'Redis', 'MinIO']} />
            </div>
          </CardBody>
        </Card>

        <Card className="mb-6">
          <CardHeader title="تفصيل الطبقات" subtitle="لون لكل طبقة من الـ 6" />
          <CardBody>
            <div className="flex flex-wrap gap-3">
              {TIERS.map((t) => (
                <span key={t.label} className="chip" style={{ background: t.bg, color: t.color }}>
                  ● {t.label}
                </span>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card className="mb-6">
          <CardHeader title="الطبقات (Tiers)" />
          <CardBody>
            <div className="arch-canvas" style={{ background: 'transparent', border: 'none', padding: 0 }}>
              {TIERS.map((t) => (
                <div className="arch-tier" key={t.label} style={{ background: t.bg, borderColor: t.color }}>
                  <div className="arch-tier-label" style={{ color: t.color }}>{t.label}</div>
                  <div className="arch-blocks">
                    {t.blocks.map((b) => (
                      <div className="arch-block" key={b.title}>
                        <div className="arch-block-icon" style={{ background: 'rgba(255,255,255,0.5)', color: t.color }}>{b.icon}</div>
                        <div>{b.title}</div>
                        <div className="arch-block-meta">{b.meta}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card className="mb-6">
          <CardHeader title="التكاملات الحكومية" subtitle="جدول الـ APIs الخارجية" />
          <div className="table-wrap" style={{ borderRadius: 0, border: 'none' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>المنظومة</th>
                  <th>الـ Endpoint</th>
                  <th>المصادقة</th>
                  <th>الغرض</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {INTEGRATIONS.map((i) => (
                  <tr key={i.system} className="cursor-pointer hover:bg-ink-50" onClick={() => setOpenIntegration(i)}>
                    <td className="font-bold">{i.system}</td>
                    <td className="mono text-xs" dir="ltr">{i.endpoint}</td>
                    <td className="text-sm">{i.auth}</td>
                    <td className="text-sm text-secondary">{i.purpose}</td>
                    <td>{i.status === 'متصل' ? <Badge tone="success">{i.status}</Badge> : <Badge tone="warning">{i.status}</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <h2 className="section-title"><Cog size={20} /> الـ Stack المقترح</h2>
        <div className="grid grid-3">
          {STACK.map((s) => (
            <Card key={s.title}>
              <CardBody>
                <div className="stat-icon mb-3" style={{ background: 'var(--brand-primary-100)', color: 'var(--brand-primary)' }}>{s.icon}</div>
                <div className="font-bold text-md mb-3">{s.title}</div>
                <ul className="flex flex-col gap-2 text-sm">
                  {s.items.map((it) => (
                    <li key={it} className="flex items-center gap-2 text-secondary">
                      <span style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--brand-primary)' }} />
                      {it}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))}
        </div>

        <div className="mt-6 alert alert-info">
          <Building2 size={20} />
          <div className="alert-body">
            <div className="alert-title">السيادة الرقمية</div>
            <div>كل البيانات تستضاف داخل البنية التحتية الحكومية المعتمدة، مع تشفير at-rest وaudit log لكل API call.</div>
          </div>
        </div>

        <Drawer open={Boolean(openIntegration)} onClose={() => setOpenIntegration(null)} title={openIntegration?.system ?? ''} size="md">
          {openIntegration && (
            <Drawer.Body>
              <dl className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-md border border-border-subtle bg-ink-50 px-3 py-2">
                  <dt className="text-2xs text-ink-500">Endpoint</dt>
                  <dd className="font-mono text-ink-900" dir="ltr">{openIntegration.endpoint}</dd>
                </div>
                <div className="rounded-md border border-border-subtle bg-ink-50 px-3 py-2">
                  <dt className="text-2xs text-ink-500">المصادقة</dt>
                  <dd>{openIntegration.auth}</dd>
                </div>
                <div className="rounded-md border border-border-subtle bg-ink-50 px-3 py-2">
                  <dt className="text-2xs text-ink-500">الحالة</dt>
                  <dd>{openIntegration.status === 'متصل' ? <Badge tone="success">{openIntegration.status}</Badge> : <Badge tone="warning">{openIntegration.status}</Badge>}</dd>
                </div>
              </dl>
              <h3 className="mt-4 text-sm font-medium text-ink-900">تدفق البيانات</h3>
              <ol className="mt-2 flex flex-col gap-2 text-sm">
                <li className="rounded-md border border-border-subtle bg-surface-card px-3 py-2">1. الواجهة تطلب التحقق عبر API Gateway.</li>
                <li className="rounded-md border border-border-subtle bg-surface-card px-3 py-2">2. الـ Gateway يتحقق من JWT ويستدعي خدمة التكامل عبر mTLS.</li>
                <li className="rounded-md border border-border-subtle bg-surface-card px-3 py-2">3. خدمة التكامل تطلب البيانات من الجهة الحكومية وترجع الاستجابة.</li>
                <li className="rounded-md border border-border-subtle bg-surface-card px-3 py-2">4. النتيجة تُسجَّل في الـ audit وتُعاد للواجهة.</li>
              </ol>
            </Drawer.Body>
          )}
        </Drawer>
      </CenteredShell>
    </AppShell>
  );
}

function FourLayerCard({ color, title, subtitle, items }: { color: string; title: string; subtitle: string; items: string[] }): JSX.Element {
  return (
    <div className="rounded-lg border bg-surface-card p-4" style={{ borderColor: color }}>
      <span aria-hidden className="inline-block h-2 w-10 rounded-pill" style={{ background: color }} />
      <p className="mt-2 font-bold text-ink-900">{title}</p>
      <p className="text-2xs text-ink-500" dir="ltr">{subtitle}</p>
      <ul className="mt-2 flex flex-col gap-1 text-2xs text-ink-700">
        {items.map((it) => <li key={it}>· {it}</li>)}
      </ul>
    </div>
  );
}
