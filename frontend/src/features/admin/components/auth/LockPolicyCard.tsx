/**
 * LockPolicyCard — account lock-policy section of /admin/settings.
 *
 * The lock-duration knob is controlled by the parent SettingsPage so it saves
 * with the single unified settings button. The locked-accounts list (and its
 * per-row unlock action) stays internal — unlocking is an immediate action,
 * not part of the settings save.
 */

import { ShieldOff, Unlock } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, Input, toast } from '@/shared/components';
import { useLockedUsers, useUnlockUser } from '@/features/auth';
import { date as fmtDate } from '@/shared/lib/format';

interface LockPolicyCardProps {
  lockMinutes: number;
  loading?: boolean;
  onLockMinutesChange: (value: number) => void;
}

export function LockPolicyCard({ lockMinutes, loading, onLockMinutesChange }: LockPolicyCardProps): JSX.Element {
  const lockedUsersQuery = useLockedUsers();
  const unlockMut = useUnlockUser();

  const onUnlock = (userId: string, name: string): void => {
    unlockMut.mutate(
      { userId, reason: 'إعادة تفعيل يدوي من إدارة المنظومة' },
      {
        onSuccess: () => toast(`تم إعادة تفعيل ${name}`, 'success'),
        onError: (err) => toast(err.message, 'danger'),
      },
    );
  };

  const lockedUsers = lockedUsersQuery.data ?? [];

  return (
    <Card>
      <CardHeader
        title="سياسة إيقاف الحسابات"
        subtitle="ضبط مدة الإيقاف وعرض الحسابات الموقوفة حالياً"
      />
      <CardBody>
        <div className="grid gap-3 md:grid-cols-3">
          <Input
            label="مدة الإيقاف بالدقائق"
            type="number"
            min={5}
            max={120}
            value={lockMinutes}
            disabled={loading}
            onChange={(e) => onLockMinutesChange(Number(e.target.value))}
          />
        </div>

        <div className="mt-5">
          <header className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-ink-900">الحسابات الموقوفة حالياً</h3>
            <Badge tone={lockedUsers.length > 0 ? 'danger' : 'neutral'}>
              {lockedUsers.length}
            </Badge>
          </header>
          {lockedUsers.length === 0 ? (
            <p className="rounded-md border border-border-subtle bg-ink-50 px-3 py-3 text-2xs text-ink-500">
              <ShieldOff size={12} strokeWidth={1.75} className="me-1 inline-block" />
              لا توجد حسابات موقوفة حالياً.
            </p>
          ) : (
            <ul className="divide-y divide-border-subtle rounded-md border border-border-subtle">
              {lockedUsers.map((u) => (
                <li key={u.userId} className="flex items-start justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900">{u.name}</p>
                    <p className="text-2xs text-ink-500">
                      {u.role} · أُوقف في {fmtDate(new Date(u.lockedAt).getTime(), 'rel')} —{' '}
                      {u.reason}
                    </p>
                    {u.unlocksAt && (
                      <p className="text-2xs text-ink-500" dir="ltr">
                        unlocksAt: {fmtDate(new Date(u.unlocksAt).getTime(), 'short')}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon={<Unlock size={12} strokeWidth={1.75} />}
                    onClick={() => onUnlock(u.userId, u.name)}
                    isLoading={unlockMut.isPending}
                  >
                    إعادة التفعيل
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
