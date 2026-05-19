import { PageHeader } from '@/shared/components';
import { useAuthStore } from '@/features/auth';
import { GeneralSettingsCard } from '../components/auth/GeneralSettingsCard';
import { LockPolicyCard } from '../components/auth/LockPolicyCard';

export function SettingsPage(): JSX.Element {
  const isSuperAdmin = useAuthStore((s) => s.user?.role === 'super_admin');

  return (
    <>
      <PageHeader title="الإعدادات العامة" subtitle="ضبط سياسات الأمان وقفل الحسابات" />

      {isSuperAdmin && (
        <div className="mt-5 flex flex-col gap-5">
          <GeneralSettingsCard />
          <LockPolicyCard />
        </div>
      )}
    </>
  );
}
