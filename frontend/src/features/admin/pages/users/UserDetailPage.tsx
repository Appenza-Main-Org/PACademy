/**
 * /admin/users/:id — admin User detail page.
 *
 * Read-only profile + audit trail. "تعديل" routes to UserEditPage;
 * the quick toggle uses `useSetUserAccountStatus` and respects the
 * self-deactivation + last-super-admin guards in `usersService`.
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Pencil } from 'lucide-react';
import {
  AlertDialog,
  Badge,
  Button,
  Card,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
  toast,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { ROLE_DEFINITIONS, type Role, useAuthStore } from '@/features/auth';
import { useAuditLog } from '@/features/audit';
import { isStatusChangeBlockedError } from '@/shared/lib/errors';
import { date as fmtDate } from '@/shared/lib/format';
import { useSetUserAccountStatus, useUser } from '../../api/users.queries';
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

  const recentAudit = useMemo(
    () => (auditEntries ?? []).filter((e) => e.entityId === id).slice(0, 10),
    [auditEntries, id],
  );

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

  const nextStatus: AccountStatus = user.accountStatus === 'active' ? 'inactive' : 'active';

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
        subtitle={`الكود: ${user.id}`}
        breadcrumbs={[
          { label: 'الإدارة', href: '#' + ROUTES.admin.dashboard },
          { label: 'المستخدمون', href: '#' + ROUTES.admin.users },
          { label: user.fullArabicName },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link to={ROUTES.admin.users} className="btn btn-ghost">
              <ArrowRight size={16} className="rtl:rotate-180" /> الرجوع للقائمة
            </Link>
            <Link to={ROUTES.admin.userEdit(user.id)} className="btn btn-primary">
              <Pencil size={14} strokeWidth={1.75} /> تعديل
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex flex-col gap-4 p-5">
            <h2 className="text-base font-semibold text-ink-900">بيانات الحساب</h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DefRow label="الاسم رباعياً" value={user.fullArabicName} />
              <DefRow label="الرقم القومى" value={user.nationalId} mono />
              <DefRow label="رمز الضابط / الكود" value={user.officerCode} mono />
              <DefRow label="رقم المحمول" value={user.mobileNumber} mono />
              <DefRow label="الفئة" value={USER_TYPE_LABEL[user.userType]} />
              <DefRow label="تاريخ الإنشاء" value={fmtDate(user.createdAt, 'full')} />
              <DefRow label="آخر تعديل" value={fmtDate(user.updatedAt, 'rel')} />
              <DefRow label="آخر دخول" value={user.lastLogin ? fmtDate(user.lastLogin, 'rel') : 'لم يسجل بعد'} />
            </dl>

            <div className="flex flex-col gap-2">
              <span className="text-2xs font-medium text-ink-500">الأدوار</span>
              <div className="flex flex-wrap gap-1.5">
                {user.roles.length === 0 && <span className="text-sm text-ink-500">—</span>}
                {user.roles.map((r) => (
                  <Badge key={r} tone="brand">
                    {ROLE_DEFINITIONS[r as Role]?.labelAr ?? r}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex flex-col gap-4 p-5">
            <h2 className="text-base font-semibold text-ink-900">الحالة</h2>
            <div className="flex items-center gap-2">
              {user.accountStatus === 'active' ? (
                <StatusBadge status="approved" />
              ) : (
                <Badge tone="neutral">غير نشط</Badge>
              )}
            </div>
            <Button
              variant={user.accountStatus === 'active' ? 'ghost' : 'primary'}
              onClick={() => setConfirmToggle(nextStatus)}
              isLoading={setStatusMut.isPending}
            >
              {user.accountStatus === 'active' ? 'تعطيل الحساب' : 'تفعيل الحساب'}
            </Button>
            <p className="text-2xs text-ink-500 leading-normal">
              الحساب غير النشط لا يستطيع تسجيل الدخول حتى يُعاد تفعيله.
            </p>
          </div>
        </Card>
      </div>

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
            <p className="text-sm text-ink-500">لا توجد عمليات مسجلة لهذا الحساب.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {recentAudit.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-col rounded-md border border-border-subtle bg-surface-card px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ink-900">
                      {entry.actionLabel}
                    </span>
                    <span className="text-2xs text-ink-500">{fmtDate(entry.timestamp, 'rel')}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-700">{entry.details}</p>
                  {entry.userName && (
                    <p className="mt-0.5 text-2xs text-ink-500">
                      {entry.userName}
                    </p>
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
        title={confirmToggle === 'inactive' ? 'تعطيل الحساب' : 'تفعيل الحساب'}
        description={
          confirmToggle === 'inactive'
            ? `سيُمنع ${user.fullArabicName} من تسجيل الدخول حتى تتم إعادة تفعيل الحساب.`
            : `سيستعيد ${user.fullArabicName} القدرة على الدخول للنظام.`
        }
        actionLabel={confirmToggle === 'inactive' ? 'تأكيد التعطيل' : 'تأكيد التفعيل'}
        tone={confirmToggle === 'inactive' ? 'danger' : 'primary'}
        onAction={performToggle}
        isActionLoading={setStatusMut.isPending}
      />
    </>
  );
}

function DefRow({ label, value, mono }: { label: string; value: string; mono?: boolean }): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-2xs font-medium text-ink-500">{label}</dt>
      <dd
        className="text-sm font-medium text-ink-900"
        dir={mono ? 'ltr' : undefined}
      >
        <span className={mono ? 'font-mono tnum' : undefined}>{value}</span>
      </dd>
    </div>
  );
}
