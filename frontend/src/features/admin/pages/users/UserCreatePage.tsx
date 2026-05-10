/**
 * /admin/users/new — admin Add User page.
 *
 * NID-driven creation. The form gates submission on a successful
 * `nidLookupService.lookup`, then auto-fills name, NID, officer code,
 * mobile, and userType. Auto-filled fields are read-only by default
 * with an explicit "تعديل" override link for edge cases.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button, Card, ErrorState, Input, PageHeader, toast } from '@/shared/components';
import { ROUTES } from '@/config/routes';
import type { Role } from '@/features/auth';
import {
  AccountStatusToggle,
  NidLookupField,
  NidLookupResultCard,
  RoleMultiSelect,
} from '../../components/users';
import { useUserCreate } from '../../api/users.queries';
import type { OfficerCandidate } from '../../api/nid-lookup.service';
import type { AccountStatus } from '@/shared/types/domain';

interface FormState {
  candidate: OfficerCandidate | null;
  /** Local override fields — used when admin clicks "تعديل" to correct
   *  an auto-filled value. */
  overrides: Partial<OfficerCandidate>;
  unit: string;
  roles: Role[];
  accountStatus: AccountStatus;
  /** Whether auto-filled fields are unlocked for editing. */
  unlocked: boolean;
}

const INITIAL: FormState = {
  candidate: null,
  overrides: {},
  unit: '',
  roles: [],
  accountStatus: 'active',
  unlocked: false,
};

export function UserCreatePage(): JSX.Element {
  const navigate = useNavigate();
  const createMut = useUserCreate();
  const [nid, setNid] = useState('');
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rolesError, setRolesError] = useState<string | null>(null);

  const merged: OfficerCandidate | null = form.candidate
    ? { ...form.candidate, ...form.overrides }
    : null;

  const canSubmit =
    Boolean(merged) && form.roles.length > 0 && !createMut.isPending;

  const handleLookupResult = (data: OfficerCandidate | null): void => {
    setForm((prev) => ({
      ...prev,
      candidate: data,
      overrides: {},
      unlocked: false,
    }));
  };

  const handleOverride = <K extends keyof OfficerCandidate>(field: K, value: OfficerCandidate[K]): void => {
    setForm((prev) => ({
      ...prev,
      overrides: { ...prev.overrides, [field]: value },
    }));
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSubmitError(null);
    setRolesError(null);
    if (!merged) return;
    if (form.roles.length === 0) {
      setRolesError('يجب اختيار دور واحد على الأقل');
      return;
    }
    try {
      const created = await createMut.mutateAsync({
        nationalId: merged.nationalId,
        fullArabicName: merged.fullArabicName,
        officerCode: merged.officerCode,
        mobileNumber: merged.mobileNumber,
        userType: merged.userType,
        unit: form.unit,
        roles: form.roles,
        accountStatus: form.accountStatus,
      });
      toast(`تم إنشاء حساب ${created.fullArabicName}`, 'success');
      navigate(ROUTES.admin.userDetail(created.id));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'تعذر إنشاء الحساب';
      setSubmitError(message);
      toast(message, 'danger');
    }
  };

  return (
    <>
      <PageHeader
        title="إنشاء حساب مستخدم"
        subtitle="ابدأ بإدخال الرقم القومى للتحقق من بيانات الشخص"
        breadcrumbs={[
          { label: 'الإدارة', href: '#' + ROUTES.admin.dashboard },
          { label: 'المستخدمون', href: '#' + ROUTES.admin.users },
          { label: 'إنشاء حساب جديد' },
        ]}
        actions={
          <Link to={ROUTES.admin.users} className="btn btn-ghost">
            <ArrowRight size={16} className="rtl:rotate-180" /> الرجوع للقائمة
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <Card>
          <div className="flex flex-col gap-4 p-5">
            <h2 className="text-base font-semibold text-ink-900">١. تحقّق الهوية</h2>
            <NidLookupField
              value={nid}
              onChange={setNid}
              onLookupResult={handleLookupResult}
              disabled={createMut.isPending}
            />
            {merged && (
              <NidLookupResultCard
                data={merged}
                onEditOverride={() =>
                  setForm((prev) => ({ ...prev, unlocked: !prev.unlocked }))
                }
              />
            )}
          </div>
        </Card>

        {merged && (
          <Card>
            <div className="flex flex-col gap-4 p-5">
              <h2 className="text-base font-semibold text-ink-900">٢. تفاصيل الحساب</h2>

              {form.unlocked && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    label="الاسم رباعياً"
                    value={merged.fullArabicName}
                    onChange={(e) => handleOverride('fullArabicName', e.target.value)}
                  />
                  <Input
                    label="رمز الضابط / الكود"
                    value={merged.officerCode}
                    onChange={(e) => handleOverride('officerCode', e.target.value)}
                  />
                  <Input
                    label="رقم المحمول"
                    value={merged.mobileNumber}
                    onChange={(e) => handleOverride('mobileNumber', e.target.value)}
                    inputMode="tel"
                    dir="ltr"
                  />
                </div>
              )}

              <Input
                label="الوحدة / الإدارة"
                value={form.unit}
                onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                placeholder="اختياري — مثال: لجان القبول"
              />

              <RoleMultiSelect
                value={form.roles}
                onChange={(next) => {
                  setForm((p) => ({ ...p, roles: next }));
                  setRolesError(null);
                }}
                error={rolesError ?? undefined}
              />

              <AccountStatusToggle
                value={form.accountStatus}
                onChange={(next) => setForm((p) => ({ ...p, accountStatus: next }))}
                helper="الحساب غير النشط لا يستطيع تسجيل الدخول"
              />
            </div>
          </Card>
        )}

        {submitError && (
          <ErrorState
            title="تعذر إنشاء الحساب"
            description={submitError}
            onRetry={() => setSubmitError(null)}
          />
        )}

        <div className="flex items-center justify-end gap-2">
          <Link to={ROUTES.admin.users} className="btn btn-ghost">
            إلغاء
          </Link>
          <Button
            type="submit"
            variant="primary"
            isLoading={createMut.isPending}
            disabled={!canSubmit}
          >
            إنشاء الحساب
          </Button>
        </div>
      </form>
    </>
  );
}
