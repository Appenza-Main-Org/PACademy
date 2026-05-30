/**
 * ProfilePage — current user's identity and contact profile.
 * Source: Tasks/KARASA_GAPS.md §10.4.C.
 */

import { useState } from 'react';
import { IdCard, KeyRound, Mail, Phone, ShieldCheck } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Input,
  PageHeader,
  toast,
} from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { AppShell } from '@/app/layouts/AppShell';
import { useAuthStore, useChangeOwnPassword } from '@/features/auth';

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

        <div className="mt-5">
          <ChangePasswordCard userId={user.id} mustChange={user.mustChangePassword} />
        </div>
      </CenteredShell>
    </AppShell>
  );
}

interface ChangePasswordCardProps {
  userId: string;
  mustChange?: boolean;
}

function ChangePasswordCard({ userId, mustChange }: ChangePasswordCardProps): JSX.Element {
  const changePassword = useChangeOwnPassword();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError('كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('تأكيد كلمة المرور غير مطابق');
      return;
    }
    changePassword.mutate(
      { userId, currentPassword, newPassword },
      {
        onSuccess: () => {
          toast('تم تغيير كلمة المرور بنجاح', 'success');
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        },
        onError: (err) => setError(err.message || 'تعذّر تغيير كلمة المرور'),
      },
    );
  };

  return (
    <Card>
      <CardHeader
        title="تغيير كلمة المرور"
        subtitle="كلمة مرور الدخول إلى المنظومة عبر بوابة وزارة الداخلية"
      />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {mustChange && (
          <div className="flex items-start gap-2 rounded-md border border-dashed border-gold-300 bg-gold-50 px-4 py-3 text-2xs text-gold-700">
            <KeyRound size={14} className="mt-0.5 flex-shrink-0" />
            <span>تستخدم حالياً كلمة مرور مؤقتة صادرة من الإدارة. يُنصح بتغييرها الآن.</span>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            label="كلمة المرور الحالية"
            type="password"
            dir="ltr"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <Input
            label="كلمة المرور الجديدة"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Input
            label="تأكيد كلمة المرور"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={error ?? undefined}
          />
        </div>
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            isLoading={changePassword.isPending}
            disabled={!currentPassword || !newPassword || !confirmPassword}
          >
            تحديث كلمة المرور
          </Button>
        </div>
      </form>
    </Card>
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
