/**
 * /admin/users/:id — admin User detail page.
 *
 * Read-only profile + audit trail. "تعديل" routes to UserEditPage;
 * the quick toggle uses `useSetUserAccountStatus` and respects the
 * self-deactivation + last-super-admin guards in `usersService`.
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowRight,
  AtSign,
  History,
  KeyRound,
  Pencil,
  Power,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react';
import {
  AlertDialog,
  Avatar,
  Badge,
  Button,
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  buttonClassName,
  toast,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { ROLE_DEFINITIONS, type Role, useAuthStore } from '@/features/auth';
import { useAuditLog } from '@/features/audit';
import { isStatusChangeBlockedError } from '@/shared/lib/errors';
import { date as fmtDate } from '@/shared/lib/format';
import { useSetUserAccountStatus, useUser, useUserResetPassword } from '../../api/users.queries';
import { CredentialsModal } from '../../components/users';
import type { AccountStatus } from '@/shared/types/domain';

const USER_TYPE_LABEL: Record<'officer' | 'civilian' | 'contractor', string> = {
  officer: 'ضابط',
  civilian: 'مدنى',
  contractor: 'متعاقد',
};

export function UserDetailPage(): JSX.Element {
  const { id = '' } = useParams<{ id: string }>();
  const { data: user, isLoading, error } = useUser(id);
  const setStatusMut = useSetUserAccountStatus();
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const { data: auditEntries } = useAuditLog({ entityType: 'SystemUser', limit: 50 });
  const [confirmToggle, setConfirmToggle] = useState<AccountStatus | null>(null);
  const resetPassword = useUserResetPassword();
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const [resetResult, setResetResult] = useState<{ username: string; password: string } | null>(null);

  const recentAudit = useMemo(
    () => (auditEntries ?? []).filter((e) => e.entityId === id).slice(0, 10),
    [auditEntries, id],
  );

  const handleResetPassword = (): void => {
    if (!user) return;
    resetPassword.mutate(
      { id: user.id },
      {
        onSuccess: (res) => {
          setResetResult({ username: res.username, password: res.temporaryPassword });
          toast('تم إعادة تعيين كلمة المرور', 'success');
        },
        onError: () => toast('تعذّر إعادة تعيين كلمة المرور', 'danger'),
      },
    );
  };

  if (isLoading) return <LoadingState variant="detail" />;
  if (error) return <ErrorState error={error as Error} />;
  if (!user) {
    return (
      <ErrorState
        title="لم يُعثر على المستخدم"
        description={`الكود "${id}" غير موجود.`}
        onBack={() => navigate(ROUTES.admin.users)}
      />
    );
  }

  const isInactive = user.accountStatus === 'inactive';
  const primaryRoleLabel =
    user.roles.length > 0
      ? ROLE_DEFINITIONS[user.roles[0] as Role]?.labelAr ?? user.roles[0]
      : null;

  const performToggle = async (): Promise<void> => {
    if (!confirmToggle) return;
    try {
      await setStatusMut.mutateAsync({
        id: user.id,
        next: confirmToggle,
        actorId: currentUser?.id,
      });
      toast(
        confirmToggle === 'active' ? 'تم تفعيل الحساب' : 'تم تعطيل الحساب',
        confirmToggle === 'active' ? 'success' : 'warning',
      );
      setConfirmToggle(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذر تغيير الحالة';
      if (isStatusChangeBlockedError(err)) {
        toast(msg, 'danger');
      } else {
        toast(msg, 'danger');
      }
      setConfirmToggle(null);
    }
  };

  return (
    <>
      <PageHeader
        title={user.fullArabicName}
        subtitle={primaryRoleLabel ? `${primaryRoleLabel} · الكود ${user.id}` : `الكود: ${user.id}`}
        breadcrumbs={[
          { label: 'الإدارة', href: '#' + ROUTES.admin.dashboard },
          { label: 'المستخدمون', href: '#' + ROUTES.admin.users },
          { label: user.fullArabicName },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link to={ROUTES.admin.users} className={buttonClassName({ variant: 'ghost' })}>
              <ArrowRight size={16} className="rtl:rotate-180" /> العودة إلى القائمة
            </Link>
            <Link
              to={ROUTES.admin.userEdit(user.id)}
              className={buttonClassName({ variant: 'primary' })}
            >
              <Pencil size={14} strokeWidth={1.75} /> تعديل البيانات
            </Link>
          </div>
        }
      />

      {/* ─── Hero: avatar · name · username · roles · status ──────── */}
      <Card variant="feature" withAccentBorder className="mb-4">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
          <Avatar size="xl" name={user.fullArabicName} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h2 className="font-ar-display text-lg font-semibold leading-snug text-ink-900">
              {user.fullArabicName}
            </h2>
            {user.username && (
              <span className="inline-flex w-fit items-center gap-1.5 rounded-pill bg-ink-50 px-2.5 py-1 font-mono text-2xs text-ink-700">
                <AtSign size={12} strokeWidth={2} aria-hidden />
                <bdi>{user.username}</bdi>
              </span>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              {user.roles.length === 0 ? (
                <span className="text-sm text-ink-500">— لا توجد أدوار</span>
              ) : (
                user.roles.map((r) => (
                  <Badge key={r} tone="brand">
                    {ROLE_DEFINITIONS[r as Role]?.labelAr ?? r}
                  </Badge>
                ))
              )}
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            {isInactive ? (
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-ink-50 px-2.5 py-1 text-2xs font-medium text-ink-700">
                <ShieldOff size={12} strokeWidth={2} aria-hidden /> الحساب غير نشط
              </span>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-2xs font-medium"
                style={{ background: 'var(--accent-50)', color: 'var(--accent-700)' }}
              >
                <ShieldCheck size={12} strokeWidth={2} aria-hidden /> الحساب نشط
              </span>
            )}
            {user.mustChangePassword && (
              <span className="inline-flex items-center gap-1.5 rounded-pill border border-dashed border-gold-300 bg-gold-50 px-2.5 py-1 text-2xs font-medium text-gold-700">
                <KeyRound size={12} strokeWidth={2} aria-hidden /> كلمة مرور مؤقتة
              </span>
            )}
            <span className="text-2xs text-ink-500">
              آخر دخول · {user.lastLogin ? fmtDate(user.lastLogin, 'rel') : 'لم يسجل بعد'}
            </span>
            {isInactive && (
              <Button
                variant="primary"
                size="sm"
                leadingIcon={<Power size={14} strokeWidth={1.75} />}
                onClick={() => setConfirmToggle('active')}
                isLoading={setStatusMut.isPending}
              >
                تفعيل الحساب
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* ─── بيانات الحساب — flat 3-col grid ──────────────────────── */}
      <Card>
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink-900">بيانات الحساب</h2>
            <span className="font-mono text-2xs text-ink-500" dir="ltr">
              {user.id}
            </span>
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <DefRow label="الاسم رباعياً" value={user.fullArabicName} />
            <DefRow label="الرقم القومى" value={user.nationalId} mono />
            <DefRow label="رمز الضابط / الكود" value={user.officerCode} mono />
            <DefRow label="رقم المحمول" value={user.mobileNumber} mono />
            <DefRow label="الفئة" value={USER_TYPE_LABEL[user.userType]} />
            <DefRow label="تاريخ الإنشاء" value={fmtDate(user.createdAt, 'full')} />
            <DefRow label="آخر تعديل" value={fmtDate(user.updatedAt, 'rel')} />
            <DefRow
              label="آخر دخول"
              value={user.lastLogin ? fmtDate(user.lastLogin, 'rel') : 'لم يسجل بعد'}
            />
          </dl>
        </div>
      </Card>

      {/* ─── الدخول والأمان — credentials + password state ─────────── */}
      <Card className="mt-4">
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-md"
              style={{ background: 'var(--accent-50)', color: 'var(--accent-700)' }}
            >
              <KeyRound size={15} strokeWidth={1.75} aria-hidden />
            </span>
            <h2 className="text-base font-semibold text-ink-900">الدخول والأمان</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="text-2xs font-medium uppercase tracking-wide text-ink-500">
                اسم المستخدم
              </span>
              {user.username ? (
                <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border-subtle bg-ink-50 px-2.5 py-1.5 font-mono text-sm text-ink-900">
                  <AtSign size={13} strokeWidth={2} className="text-ink-500" aria-hidden />
                  <bdi>{user.username}</bdi>
                </span>
              ) : (
                <span className="text-sm text-ink-500">— لم يُنشأ بعد</span>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-2xs font-medium uppercase tracking-wide text-ink-500">
                حالة كلمة المرور
              </span>
              {!user.hasCredentials ? (
                <Badge tone="neutral">لا توجد كلمة مرور</Badge>
              ) : user.mustChangePassword ? (
                <span className="inline-flex w-fit items-center gap-1.5 rounded-pill border border-dashed border-gold-300 bg-gold-50 px-2.5 py-1 text-2xs font-medium text-gold-700">
                  <KeyRound size={12} strokeWidth={2} aria-hidden /> مؤقتة · بانتظار تغيير المستخدم
                </span>
              ) : (
                <Badge tone="success">مُعيّنة من قِبل المستخدم</Badge>
              )}
            </div>
          </div>

          {isSuperAdmin && (
            <div className="flex flex-col gap-2 border-t border-dashed border-border-subtle pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-2xs leading-relaxed text-ink-500">
                إعادة التعيين تُنشئ كلمة مرور مؤقتة جديدة تظهر لمرة واحدة فقط لتسليمها للمستخدم.
              </p>
              <Button
                variant="secondary"
                size="sm"
                leadingIcon={<RotateCcw size={14} strokeWidth={1.75} />}
                onClick={handleResetPassword}
                isLoading={resetPassword.isPending}
                className="sm:flex-shrink-0"
              >
                إعادة تعيين كلمة المرور
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* ─── سجل النشاط ────────────────────────────────────────── */}
      <Card className="mt-4">
        <div className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink-900">سجل النشاط</h2>
            <Link
              to={`${ROUTES.admin.audit}?entityType=SystemUser&entityId=${encodeURIComponent(user.id)}`}
              className="text-2xs font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800"
            >
              عرض الكل
            </Link>
          </div>
          {recentAudit.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border-subtle bg-ink-50/40 px-4 py-8 text-center">
              <History size={22} strokeWidth={1.5} className="text-ink-400" aria-hidden />
              <p className="text-sm text-ink-500">لا توجد عمليات مسجلة لهذا الحساب بعد.</p>
            </div>
          ) : (
            <ol className="flex flex-col gap-2">
              {recentAudit.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-col rounded-md border border-border-subtle bg-surface-card px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ink-900">{entry.actionLabel}</span>
                    <span className="text-2xs text-ink-500">{fmtDate(entry.timestamp, 'rel')}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-700">{entry.details}</p>
                  {entry.userName && (
                    <p className="mt-0.5 text-2xs text-ink-500">{entry.userName}</p>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </Card>

      <AlertDialog
        open={confirmToggle !== null}
        onOpenChange={(open) => !open && setConfirmToggle(null)}
        title="تفعيل الحساب"
        description={`سيستعيد ${user.fullArabicName} القدرة على الدخول للنظام.`}
        actionLabel="تأكيد التفعيل"
        tone="primary"
        onAction={performToggle}
        isActionLoading={setStatusMut.isPending}
      />

      {resetResult && (
        <CredentialsModal
          open
          title="بيانات الدخول الجديدة"
          username={resetResult.username}
          password={resetResult.password}
          onClose={() => setResetResult(null)}
        />
      )}
    </>
  );
}

function DefRow({ label, value, mono }: { label: string; value: string; mono?: boolean }): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5 border-b border-dashed border-border-subtle pb-3 sm:border-0 sm:pb-0">
      <dt className="text-2xs font-medium uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="text-start text-sm font-medium text-ink-900">
        {/* <bdi> isolates LTR digits so they render correctly while the value
            stays aligned to the row's start edge under its label (RTL-safe). */}
        <bdi className={mono ? 'font-mono tnum' : undefined}>{value}</bdi>
      </dd>
    </div>
  );
}
