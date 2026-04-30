import { Upload, FileText, Phone, Mail, HelpCircle, Calendar, Shield, GraduationCap } from 'lucide-react';
import { AppShell } from '@/app/layouts/AppShell';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { Card, CardHeader, CardBody, Badge, Button, StageStepper } from '@/shared/components';
import { STAGE_LABELS } from '@/shared/lib/constants';
import { date as fmtDate } from '@/shared/lib/format';

const DOCS = [
  { key: 'national-id', icon: '🪪', title: 'بطاقة الرقم القومي', desc: 'صورة واضحة من الجهتين', required: true },
  { key: 'cert',         icon: '🎓', title: 'شهادة الثانوية',     desc: 'الأصل + صورة', required: true },
  { key: 'photo',        icon: '🖼️', title: 'صورة شخصية',          desc: 'بخلفية بيضاء — 4×6', required: true },
  { key: 'birth',        icon: '📜', title: 'شهادة الميلاد',       desc: 'مميكنة حديثة', required: true },
  { key: 'family',       icon: '👨‍👩‍👧‍👦', title: 'وثيقة التعارف الأسري', desc: 'يتم استخراجها من القسم', required: true },
  { key: 'good-conduct', icon: '🏛️', title: 'شهادة حسن السير والسلوك', desc: 'سارية لمدة 6 أشهر', required: false },
];

export function ApplicantPortalPage(): JSX.Element {
  const currentStage = 2; // Demo stage: docs upload

  return (
    <AppShell app="applicant" appLabel="موقع المتقدمين · 1.2">
      <CenteredShell>
        <section className="hub-hero" style={{ background: 'linear-gradient(135deg, #0E7240, #1A8754)' }}>
          <h1>أهلاً بك في منظومة القبول الإلكتروني</h1>
          <p>تابع كل مراحل تقدمك من تسجيل الطلب وحتى ظهور النتيجة النهائية. أي خطوة لها مستندات أو إجراءات يتم إخطارك بها فور اعتمادها.</p>
          <div className="hub-hero-meta">
            <div className="hub-hero-meta-item">
              <Calendar size={16} />
              <span>اليوم: {fmtDate(Date.now())}</span>
            </div>
            <div className="hub-hero-meta-item">
              <GraduationCap size={16} />
              <span>كود التقدم: APP-2026000142</span>
            </div>
            <div className="hub-hero-meta-item">
              <Shield size={16} />
              <span>تم التحقق من الهوية ✓</span>
            </div>
          </div>
        </section>

        <Card className="mb-6">
          <CardHeader title="مراحل ملف التقدم" subtitle={`أنت حالياً في المرحلة ${currentStage + 1}: ${STAGE_LABELS[currentStage]}`} />
          <CardBody>
            <StageStepper stages={STAGE_LABELS} currentIndex={currentStage} />
          </CardBody>
        </Card>

        <Card className="mb-6">
          <CardHeader
            title="المستندات المطلوبة"
            subtitle="ارفع المستندات الستة لاستكمال هذه المرحلة"
            actions={<Badge tone="warning">في انتظار 6 / 6</Badge>}
          />
          <CardBody>
            <div className="grid grid-cols-auto" style={{ gap: 16 }}>
              {DOCS.map((d) => (
                <div key={d.key} className="card" style={{ padding: 20, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 28 }}>{d.icon}</span>
                    {d.required ? <Badge tone="danger">إلزامي</Badge> : <Badge tone="neutral">اختياري</Badge>}
                  </div>
                  <div className="font-bold text-md">{d.title}</div>
                  <div className="text-sm text-tertiary flex-1">{d.desc}</div>
                  <Button variant="secondary" leadingIcon={<Upload size={16} />}>رفع المستند</Button>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <section className="section">
          <h2 className="section-title"><HelpCircle size={20} /> الدعم والمساعدة</h2>
          <div className="grid grid-3">
            <SupportCard icon={<Phone size={20} />} title="الخط الساخن" body="19000" hint="من الأحد إلى الخميس · 9 ص — 9 م" />
            <SupportCard icon={<Mail size={20} />} title="البريد الإلكتروني" body="support@police-academy.gov.eg" hint="ردنا خلال 24 ساعة عمل" />
            <SupportCard icon={<FileText size={20} />} title="الأسئلة الشائعة" body="مكتبة الإجابات" hint="مفهرسة بحسب مرحلة التقدم" />
          </div>
        </section>
      </CenteredShell>
    </AppShell>
  );
}

function SupportCard({ icon, title, body, hint }: { icon: React.ReactNode; title: string; body: string; hint: string }): JSX.Element {
  return (
    <Card>
      <CardBody>
        <div className="stat-icon mb-3" style={{ background: 'var(--brand-primary-100)', color: 'var(--brand-primary)' }}>{icon}</div>
        <div className="font-bold text-md mb-2">{title}</div>
        <div className="font-semibold mb-2 mono" style={{ direction: 'ltr', textAlign: 'right' }}>{body}</div>
        <div className="text-xs text-tertiary">{hint}</div>
      </CardBody>
    </Card>
  );
}
