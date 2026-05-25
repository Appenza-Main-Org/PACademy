/**
 * /admin/users/:id/edit — admin Edit User page.
 *
 * NID is locked (you don't change identity through edit). Roles and
 * accountStatus are editable; other metadata fields are editable for
 * directory corrections. Save is gated on a dirty form.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Lock } from 'lucide-react';
import {
  Button,
  Card,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  buttonClassName,
  toast,
} from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { type Role, useAuthStore } from '@/features/auth';
import { isStatusChangeBlockedError, isValidationError } from '@/shared/lib/errors';
import { validationFieldErrors, validationMessage } from '@/shared/lib/validation-errors';
import {
  AccountStatusToggle,
  RoleMultiSelect,
} from '../../components/users';
import { useUser, useUserUpdate } from '../../api/users.queries';
import { validateRoleSet } from '../../lib/role-rules';
import type { AccountStatus, SystemUser } from '@/shared/types/domain';

interface DraftState {
  fullArabicName: string;
  officerCode: string;
  mobileNumber: string;
  roles: Role[];
  accountStatus: AccountStatus;
}

function toDraft(u: SystemUser): DraftState {
  return {
    fullArabicName: u.fullArabicName,
    officerCode: u.officerCode,
    mobileNumber: u.mobileNumber,
    roles: u.roles as Role[],
    accountStatus: u.accountStatus,
  };
}

function isDirty(a: DraftState, b: DraftState): boolean {
  if (a.fullArabicName !== b.fullArabicName) return true;
  if (a.officerCode !== b.officerCode) return true;
  if (a.mobileNumber !== b.mobileNumber) return true;
  if (a.accountStatus !== b.accountStatus) return true;
  if (a.roles.length !== b.roles.length) return true;
  if (a.roles.some((r, i) => r !== b.roles[i])) return true;
  return false;
}

export function UserEditPage(): JSX.Element {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: user, isLoading, error } = useUser(id);
  const updateMut = useUserUpdate();
  const currentUser = useAuthStore((s) => s.user);

  const [draft, setDraft] = useState<DraftState | null>(null);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user && draft === null) {
      setDraft(toDraft(user));
    }
  }, [user, draft]);

  const initial = useMemo(() => (user ? toDraft(user) : null), [user]);

  if (isLoading) return <LoadingState variant="detail" />;
  if (error) return <ErrorState error={error as Error} />;
  if (!user || !draft || !initial) {
    return (
      <ErrorState
        title="لم يُعثر على المستخدم"
        description={`الكود "${id}" غير موجود.`}
        onBack={() => navigate(ROUTES.admin.users)}
      />
    );
  }

  const dirty = isDirty(draft, initial);
  const roleValidation = validateRoleSet(draft.roles);
  const formValid = roleValidation.ok;
  const isSelf = currentUser?.id === user.id;

  /* If editing yourself, lock the status toggle to active to prevent
   * self-deactivation. The detail-page toggle has the same guard with
   * a confirmation dialog; the edit page just hides the lever. */
  const statusLocked = isSelf;

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setRolesError(null);
    setFieldErrors({});
    if (!dirty) return;
    if (draft.fullArabicName.trim().length === 0) {
      setFieldErrors((prev) => ({
        ...prev,
        fullArabicName: 'الاسم رباعياً مطلوب',
      }));
      return;
    }
    if (!roleValidation.ok) {
      setRolesError(roleValidation.message ?? 'مجموعة الأدوار غير صالحة');
      return;
    }
    try {
      await updateMut.mutateAsync({
        id: user.id,
        patch: {
          fullArabicName: draft.fullArabicName.trim(),
          officerCode: draft.officerCode,
          mobileNumber: draft.mobileNumber,
          roles: draft.roles,
          accountStatus: draft.accountStatus,
        },
      });
      toast('تم حفظ التعديلات', 'success');
      navigate(ROUTES.admin.userDetail(user.id));
    } catch (err) {
      const msg = validationMessage(err, 'تعذر حفظ التعديلات');
      if (isValidationError(err)) {
        const nextFieldErrors = validationFieldErrors(err);
        setFieldErrors(nextFieldErrors);
        setRolesError(nextFieldErrors.roles ?? null);
      }
      if (isStatusChangeBlockedError(err)) {
        toast(msg, 'warning');
      } else {
        toast(msg, 'danger');
      }
    }
  };

  return (
    <>
      <PageHeader
        title={`تعديل ${user.fullArabicName}`}
        subtitle={`الكود: ${user.id}`}
        breadcrumbs={[
          { label: 'الإدارة', href: '#' + ROUTES.admin.dashboard },
          { label: 'المستخدمون', href: '#' + ROUTES.admin.users },
          { label: user.fullArabicName, href: '#' + ROUTES.admin.userDetail(user.id) },
          { label: 'تعديل' },
        ]}
        actions={
          <Link
            to={ROUTES.admin.userDetail(user.id)}
            className={buttonClassName({ variant: 'ghost' })}
          >
            <ArrowRight size={16} className="rtl:rotate-180" /> العودة إلى ملف المستخدم
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <Card>
          <div className="flex flex-col gap-4 p-5">
            <h2 className="text-base font-semibold text-ink-900">بيانات الهوية</h2>

            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-ink-700">الرقم القومى</span>
              <div className="flex items-center gap-2 rounded-md border border-dashed border-border-default bg-ink-50 px-3 py-2">
                <Lock size={14} strokeWidth={1.75} className="text-ink-400" />
                <span className="text-sm font-mono tnum text-ink-900" dir="ltr">
                  {user.nationalId || '—'}
                </span>
              </div>
              <span className="text-2xs text-ink-500">لا يمكن تعديل الرقم القومى بعد الإنشاء</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="الاسم رباعياً"
                value={draft.fullArabicName}
                onChange={(e) => {
                  setDraft({ ...draft, fullArabicName: e.target.value });
                  setFieldErrors((prev) => ({ ...prev, fullArabicName: '' }));
                }}
                required
                error={fieldErrors.fullArabicName}
              />
              <Input
                label="رمز الضابط / الكود"
                value={draft.officerCode}
                onChange={(e) => {
                  setDraft({ ...draft, officerCode: e.target.value });
                  setFieldErrors((prev) => ({ ...prev, officerCode: '' }));
                }}
                error={fieldErrors.officerCode}
              />
              <Input
                label="رقم المحمول"
                value={draft.mobileNumber}
                onChange={(e) => {
                  setDraft({ ...draft, mobileNumber: e.target.value });
                  setFieldErrors((prev) => ({ ...prev, mobileNumber: '' }));
                }}
                inputMode="tel"
                dir="ltr"
                error={fieldErrors.mobileNumber}
              />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex flex-col gap-4 p-5">
            <h2 className="text-base font-semibold text-ink-900">الأدوار والصلاحيات</h2>
            <RoleMultiSelect
              value={draft.roles}
              onChange={(next) => {
                setDraft({ ...draft, roles: next });
                setRolesError(null);
              }}
              error={rolesError ?? undefined}
            />
            <AccountStatusToggle
              value={draft.accountStatus}
              onChange={(next) => setDraft({ ...draft, accountStatus: next })}
              disabled={statusLocked}
              helper={
                statusLocked
                  ? 'لا يمكن تعطيل حسابك الخاص من هنا'
                  : 'الحساب غير النشط لا يستطيع تسجيل الدخول'
              }
            />
          </div>
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Link
            to={ROUTES.admin.userDetail(user.id)}
            className={buttonClassName({ variant: 'ghost' })}
          >
            إلغاء
          </Link>
          <Button
            type="submit"
            variant="primary"
            isLoading={updateMut.isPending}
            disabled={!dirty || !formValid || updateMut.isPending}
          >
            حفظ التعديلات
          </Button>
        </div>
      </form>
    </>
  );
}
