import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Shield, Users, CreditCard, Hourglass, Check, BarChart3 } from 'lucide-react';
import { AppShell } from '@/app/layouts/AppShell';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { useAuthStore } from '@/features/auth';
import { MOCK } from '@/shared/mock-data';
import { date as fmtDate, num, shortName } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import { Badge, StatCard } from '@/shared/components';
import type { AppKey } from '@/shared/lib/constants';

interface AppDef {
  key: AppKey;
  icon: string;
  num: string;
  title: string;
  desc: string;
  path: string;
  platform: 'إنترنت' | 'شبكة داخلية';
  stat: string;
}

const APPS: AppDef[] = [
  { key: 'admin',          icon: '⚙️', num: '1.1', title: 'إدارة منظومة القبول',         desc: 'إعداد شروط التقدم وإدارة الأكواد المرجعية والإحصائيات الشاملة',                path: '/admin',          platform: 'إنترنت',     stat: `${MOCK.kpis.totalApplicants} متقدم` },
  { key: 'applicant',      icon: '🎓', num: '1.2', title: 'موقع المتقدمين',                desc: 'تسجيل المتقدمين على الإنترنت ومتابعة كل مراحل التقدم والاختبارات',             path: '/applicant',      platform: 'إنترنت',     stat: 'دورة 11 مرحلة' },
  { key: 'committee',      icon: '📋', num: '2.1', title: 'لجان القبول',                   desc: 'تنظيم لجان قبول المتقدمين وإدارة بياناتهم وربط مراحل التقدم',                  path: '/committee',      platform: 'شبكة داخلية', stat: '5 لجان' },
  { key: 'board',          icon: '⚖️', num: '2.2', title: 'الهيئة وأمانة السر',           desc: 'إدارة لجنة الهيئة وتنظيم البيانات والإجراءات المرتبطة بها',                     path: '/board',          platform: 'شبكة داخلية', stat: 'هيئة عليا' },
  { key: 'investigations', icon: '🔍', num: '2.3', title: 'التحريات',                       desc: 'إجراءات صادر/وارد التحريات وإدراج ومتابعة نتائجها بالملف الإلكتروني',           path: '/investigations', platform: 'شبكة داخلية', stat: 'سرية تامة' },
  { key: 'medical',        icon: '🩺', num: '2.4', title: 'القومسيون الطبي',                desc: 'إدارة الاختبارات الطبية لقطاع الخدمات الطبية وإدراج النتائج',                   path: '/medical',        platform: 'شبكة داخلية', stat: '8 عيادات' },
  { key: 'barcode',        icon: '🏷️', num: '2.5', title: 'إنشاء وطباعة الباركود',           desc: 'إنشاء وإدارة وطباعة الباركود الخاص بالمتقدمين للاستعلام والتكامل',             path: '/barcode',        platform: 'شبكة داخلية', stat: 'كارت تردد' },
  { key: 'biometric',      icon: '👁️', num: '2.6', title: 'تسجيل واستعلام بيومتري',       desc: 'البصمة الرقمية والتعرف على الوجه والتحقق من الهوية داخل اللجان',               path: '/biometric',      platform: 'شبكة داخلية', stat: 'تحقق فوري' },
  { key: 'exams',          icon: '📝', num: '2.7', title: 'بنك الأسئلة والاختبارات',        desc: 'إعداد بنك الأسئلة وتنفيذ الاختبارات الإلكترونية واستخراج التقارير',            path: '/question-bank',  platform: 'شبكة داخلية', stat: 'نظام MCQ' },
];

export function HubPage(): JSX.Element {
  const user = useAuthStore((s) => s.user);
  if (!user) return <></>;

  const accessible = APPS.map((a) => ({
    ...a,
    locked: !user.apps.includes(a.key),
  }));

  const internet = accessible.filter((a) => a.platform === 'إنترنت');
  const internal = accessible.filter((a) => a.platform === 'شبكة داخلية');
  const k = MOCK.kpis;
  const paidPercent = Math.round((k.paidApplicants / k.totalApplicants) * 100);

  return (
    <AppShell>
      <CenteredShell>
        <section className="hub-hero">
          <h1>أهلاً بك، {shortName(user.name, 4)}</h1>
          <p>
            المنظومة الكاملة للتحول الرقمي بإجراءات القبول والاختبارات. تسعة تطبيقات مترابطة على مستوى
            الإنترنت والشبكة الداخلية تعمل بصورة موحدة.
          </p>
          <div className="hub-hero-meta">
            <div className="hub-hero-meta-item">
              <Calendar size={16} />
              <span>{fmtDate(Date.now())}</span>
            </div>
            <div className="hub-hero-meta-item">
              <Shield size={16} />
              <span>منصة التحقق الرقمي ✓</span>
            </div>
            <div className="hub-hero-meta-item">
              <span className="status-dot online" />
              <span>كل الخدمات نشطة</span>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="hub-section-title">
            <h2>
              <BarChart3 size={20} /> لوحة المؤشرات
            </h2>
            <span className="text-sm text-tertiary">آخر تحديث: {fmtDate(Date.now(), 'rel')}</span>
          </div>
          <div className="grid grid-4">
            <StatCard label="إجمالي المتقدمين" value={k.totalApplicants} icon={<Users size={18} />} iconBg="#DDE7F2" iconColor="#2D5BA0" trend={{ label: '+12%' }} />
            <StatCard label="مدفوع الرسوم" value={k.paidApplicants} icon={<CreditCard size={18} />} iconBg="#D7F0E1" iconColor="#1A8754" trend={{ label: `${paidPercent}%` }} />
            <StatCard label="قيد المراجعة" value={k.underReview} icon={<Hourglass size={18} />} iconBg="#FBE9CC" iconColor="#B8770A" trend={{ label: '+5%' }} />
            <StatCard label="تم القبول" value={k.approved} icon={<Check size={18} />} iconBg="#D7F0E1" iconColor="#1A8754" trend={{ label: 'مستقر' }} />
          </div>
        </section>

        <section className="section">
          {internet.length > 0 && (
            <>
              <div className="hub-section-title">
                <h2>🌐 تطبيقات الإنترنت</h2>
                <Badge tone="info">{num(internet.length)} تطبيقات</Badge>
              </div>
              <div className="grid grid-cols-auto mb-6">
                {internet.map((a) => (
                  <AppCard key={a.key} app={a} />
                ))}
              </div>
            </>
          )}
          {internal.length > 0 && (
            <>
              <div className="hub-section-title">
                <h2>🏢 تطبيقات الشبكة الداخلية</h2>
                <Badge tone="brand">{num(internal.length)} تطبيقات</Badge>
              </div>
              <div className="grid grid-cols-auto">
                {internal.map((a) => (
                  <AppCard key={a.key} app={a} />
                ))}
              </div>
            </>
          )}
        </section>

        <footer
          style={{
            marginTop: 48,
            paddingTop: 24,
            borderTop: '1px solid var(--border-subtle)',
            textAlign: 'center',
            color: 'var(--text-tertiary)',
            fontSize: 13,
          }}
        >
          <p>وزارة الداخلية · أكاديمية الشرطة · إدارة تكنولوجيا المعلومات</p>
          <p style={{ marginTop: 4 }}>تم الالتزام بكامل متطلبات السيادة الرقمية والأمن المعلوماتي · المنظومة آمنة ومُدققة</p>
        </footer>
      </CenteredShell>
    </AppShell>
  );
}

function AppCard({ app }: { app: AppDef & { locked: boolean } }): JSX.Element {
  const Wrapper = app.locked ? 'div' : Link;
  const wrapperProps = app.locked ? {} : { to: app.path };
  return (
    <Wrapper
      {...(wrapperProps as { to: string })}
      className={cn('app-card', app.locked && 'opacity-60 pointer-events-none')}
      data-app={app.key}
      aria-disabled={app.locked || undefined}
    >
      <div className="app-card-head">
        <div className="app-card-icon">{app.icon}</div>
        <div className="flex items-center gap-2">
          {app.locked && <Badge tone="danger">🔒 محظور</Badge>}
          <span className="app-card-num">{app.num}</span>
        </div>
      </div>
      <div className="app-card-title">{app.title}</div>
      <div className="app-card-desc">{app.desc}</div>
      <div className="app-card-foot">
        <span>{app.stat}</span>
        <div className="app-card-arrow">
          <ArrowLeft size={14} />
        </div>
      </div>
    </Wrapper>
  );
}
