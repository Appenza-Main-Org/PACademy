/**
 * ProfilePage — current user's profile + preferences.
 * Source: Tasks/KARASA_GAPS.md §10.4.C.
 */

import { useState } from 'react';
import { Bell, Globe2, KeyRound, Settings } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Input,
  PageHeader,
  Select,
  toast,
} from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { AppShell } from '@/app/layouts/AppShell';
import { useAuthStore } from '@/features/auth';

export function ProfilePage(): JSX.Element {
  const user = useAuthStore((s) => s.user);
  const [dateFormat, setDateFormat] = useState<'gregorian' | 'hijri' | 'both'>('gregorian');
  const [notifyPrefs, setNotifyPrefs] = useState<{ email: boolean; sms: boolean; in_app: boolean }>({ email: true, sms: false, in_app: true });

  if (!user) return <></>;

  return (
    <AppShell appLabel="الملف الشخصي">
      <CenteredShell>
        <PageHeader
          title="الملف الشخصي"
          subtitle="معلومات الحساب والتفضيلات الشخصية"
          actions={<Badge tone="info">{user.roleLabel}</Badge>}
        />

        <div className="grid gap-5 lg:grid-cols-[1fr_2fr]">
          <Card>
            <CardHeader title="المعلومات الأساسية" />
            <div className="flex flex-col items-center gap-3">
              <Avatar name={user.name} size="xl" />
              <p className="text-md font-bold text-ink-900">{user.name}</p>
              <p className="text-2xs text-ink-500" dir="ltr">{user.id}</p>
              <p className="text-2xs text-ink-500">{user.unit}</p>
            </div>
          </Card>

          <Card>
            <CardHeader title="الأمن والكلمة السرية" />
            <div className="flex flex-col gap-3">
              <Input label="كلمة المرور الحالية" type="password" placeholder="••••••••" />
              <Input label="كلمة المرور الجديدة" type="password" placeholder="••••••••" />
              <Input label="تأكيد كلمة المرور الجديدة" type="password" placeholder="••••••••" />
              <div className="flex items-center justify-between gap-2">
                <Button variant="secondary" leadingIcon={<KeyRound size={14} strokeWidth={1.75} />}>
                  تحديث كلمة المرور
                </Button>
                <Button variant="ghost" onClick={() => toast('سيتم إعادة ضبط المصادقة الثنائية بعد التأكيد', 'info')}>
                  إعادة ضبط المصادقة الثنائية
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <Card className="mt-5">
          <CardHeader title="التفضيلات" subtitle="تخصيص العرض والإشعارات" actions={<Settings size={16} strokeWidth={1.75} />} />
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="تنسيق التاريخ"
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value as typeof dateFormat)}
              options={[
                { value: 'gregorian', label: 'ميلادي' },
                { value: 'hijri', label: 'هجري' },
                { value: 'both', label: 'ميلادي + هجري' },
              ]}
            />
            <Select
              label="اللغة"
              value="ar"
              onChange={() => undefined}
              options={[{ value: 'ar', label: 'العربية' }]}
              disabled
            />

            <div className="rounded-md border border-border-subtle bg-surface-card p-3 md:col-span-2">
              <p className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-ink-900">
                <Bell size={14} strokeWidth={1.75} /> تفضيلات الإشعارات
              </p>
              {(['email', 'sms', 'in_app'] as const).map((k) => (
                <label key={k} className="flex items-center justify-between gap-3 border-t border-border-subtle py-2 text-sm first:border-t-0">
                  <span>{k === 'email' ? 'بريد إلكتروني' : k === 'sms' ? 'رسائل SMS' : 'إشعارات داخل المنظومة'}</span>
                  <input type="checkbox" checked={notifyPrefs[k]} onChange={(e) => setNotifyPrefs({ ...notifyPrefs, [k]: e.target.checked })} className="h-4 w-4 cursor-pointer accent-teal-500" />
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-md border border-teal-300 bg-teal-50 p-3 text-2xs text-teal-700">
            <Globe2 size={12} strokeWidth={1.75} className="me-1 inline-block" />
            تفضيلاتك تُحفظ محلياً في هذه الجلسة. التزامن مع الخادم يلحق في Sprint 10.
          </div>
        </Card>
      </CenteredShell>
    </AppShell>
  );
}
