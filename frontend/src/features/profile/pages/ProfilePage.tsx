/**
 * ProfilePage — current user's identity and contact profile.
 * Source: Tasks/KARASA_GAPS.md §10.4.C.
 */

import { IdCard, Mail, Phone, ShieldCheck } from 'lucide-react';
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  PageHeader,
} from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { AppShell } from '@/app/layouts/AppShell';
import { useAuthStore } from '@/features/auth';

export function ProfilePage(): JSX.Element {
  const user = useAuthStore((s) => s.user);

  if (!user) return <></>;

  return (
    <AppShell appLabel="الملف الشخصي">
      <CenteredShell>
        <PageHeader
          title="الملف الشخصي"
          subtitle="بيانات الحساب المسجلة في منظومة الموظفين"
          actions={<Badge tone="info">{user.roleLabel}</Badge>}
        />

        <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
          <Card>
            <CardHeader title="المعلومات الأساسية" />
            <div className="flex flex-col items-center gap-3">
              <Avatar name={user.name} size="xl" />
              <p className="text-md font-bold text-ink-900">{user.name}</p>
              <p className="text-2xs text-ink-500" dir="ltr">{user.officerCode ?? user.id}</p>
            </div>
          </Card>

          <Card>
            <CardHeader title="بيانات التعريف والاتصال" subtitle="لا يستخدم دخول الموظفين كلمة مرور منفصلة" />
            <div className="grid gap-3 md:grid-cols-2">
              <ProfileField
                icon={<IdCard size={16} strokeWidth={1.75} />}
                label="الرقم القومي"
                value={user.nationalId ?? '—'}
                ltr
              />
              <ProfileField
                icon={<Phone size={16} strokeWidth={1.75} />}
                label="رقم المحمول"
                value={user.mobileNumber ?? '—'}
                ltr
              />
              <ProfileField
                icon={<Mail size={16} strokeWidth={1.75} />}
                label="البريد الإلكتروني"
                value={user.email ?? '—'}
                ltr
              />
              <ProfileField
                icon={<ShieldCheck size={16} strokeWidth={1.75} />}
                label="الدور"
                value={user.roleLabel}
              />
            </div>
          </Card>
        </div>
      </CenteredShell>
    </AppShell>
  );
}

interface ProfileFieldProps {
  icon: JSX.Element;
  label: string;
  value: string;
  ltr?: boolean;
}

function ProfileField({ icon, label, value, ltr = false }: ProfileFieldProps): JSX.Element {
  return (
    <div className="rounded-md border border-border-subtle bg-ink-50 px-3 py-3">
      <p className="mb-1 inline-flex items-center gap-2 text-2xs font-medium text-ink-500">
        <span className="text-teal-700">{icon}</span>
        {label}
      </p>
      <p className="text-sm font-medium text-ink-900" dir={ltr ? 'ltr' : 'rtl'}>
        {value}
      </p>
    </div>
  );
}
