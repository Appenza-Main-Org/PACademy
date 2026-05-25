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
import {
  Button,
  Card,
  ErrorState,
  Input,
  PageHeader,
  RadixSelect,
  type RadixSelectOption,
  buttonClassName,
  toast,
} from '@/shared/components';
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
import { validateRoleSet } from '../../lib/role-rules';
import type { AccountStatus, UserType } from '@/shared/types/domain';
import { isValidationError } from '@/shared/lib/errors';
import { validationFieldErrors, validationMessage } from '@/shared/lib/validation-errors';

interface FormState {
  candidate: OfficerCandidate | null;
  /** Local override fields — used when admin clicks "تعديل" to correct
   *  an auto-filled value. */
  overrides: Partial<OfficerCandidate>;
  roles: Role[];
  accountStatus: AccountStatus;
  /** Whether auto-filled fields are unlocked for editing. */
  unlocked: boolean;
  isManualIdentity: boolean;
}

const INITIAL: FormState = {
  candidate: null,
  overrides: {},
  roles: [],
  accountStatus: 'active',
  unlocked: false,
  isManualIdentity: false,
};

const USER_TYPE_OPTIONS: ReadonlyArray<RadixSelectOption<UserType>> = [
  { value: 'officer', label: 'ضابط' },
  { value: 'civilian', label: 'مدنى' },
  { value: 'contractor', label: 'متعاقد' },
];

const REQUIRED_CANDIDATE_FIELDS: ReadonlyArray<keyof Pick<
  OfficerCandidate,
  'fullArabicName' | 'officerCode' | 'mobileNumber'
>> = ['fullArabicName', 'officerCode', 'mobileNumber'];

export function UserCreatePage(): JSX.Element {
  const navigate = useNavigate();
  const createMut = useUserCreate();
  const [nid, setNid] = useState('');
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const merged: OfficerCandidate | null = form.candidate
    ? { ...form.candidate, ...form.overrides }
    : null;

  const hasCandidateDetails = merged
    ? REQUIRED_CANDIDATE_FIELDS.every((field) => merged[field].trim().length > 0)
    : false;

  const canSubmit =
    Boolean(merged) && hasCandidateDetails && form.roles.length > 0 && !createMut.isPending;

  const handleLookupResult = (data: OfficerCandidate | null): void => {
    setForm((prev) => ({
      ...prev,
      candidate: data,
      overrides: {},
      unlocked: false,
      isManualIdentity: false,
    }));
  };

  const handleLookupNotFound = (nationalId: string): void => {
    setForm((prev) => ({
      ...prev,
      candidate: {
        nationalId,
        fullArabicName: '',
        officerCode: '',
        mobileNumber: '',
        userType: 'officer',
      },
      overrides: {},
      unlocked: true,
      isManualIdentity: true,
    }));
    setSubmitError(null);
    setFieldErrors({});
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
    setFieldErrors({});
    if (!merged) return;
    const missingField = REQUIRED_CANDIDATE_FIELDS.find((field) => merged[field].trim().length === 0);
    if (missingField) {
      setFieldErrors((prev) => ({
        ...prev,
        [missingField]: 'هذا الحقل مطلوب لاستكمال إنشاء الحساب',
      }));
      return;
    }
    const validation = validateRoleSet(form.roles);
    if (!validation.ok) {
      setRolesError(validation.message ?? 'مجموعة الأدوار غير صالحة');
      return;
    }
    try {
      const created = await createMut.mutateAsync({
        nationalId: merged.nationalId,
        fullArabicName: merged.fullArabicName.trim(),
        officerCode: merged.officerCode,
        mobileNumber: merged.mobileNumber,
        userType: merged.userType,
        roles: form.roles,
        accountStatus: form.accountStatus,
      });
      toast(`تم إنشاء حساب ${created.fullArabicName}`, 'success');
      navigate(ROUTES.admin.userDetail(created.id));
    } catch (err) {
      const message = validationMessage(err, 'تعذر إنشاء الحساب');
      if (isValidationError(err)) {
        const nextFieldErrors = validationFieldErrors(err);
        setFieldErrors(nextFieldErrors);
        setRolesError(nextFieldErrors.roles ?? null);
      }
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
          <Link to={ROUTES.admin.users} className={buttonClassName({ variant: 'ghost' })}>
            <ArrowRight size={16} className="rtl:rotate-180" /> العودة إلى قائمة المستخدمين
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
              onNotFound={handleLookupNotFound}
              disabled={createMut.isPending}
            />
            {form.isManualIdentity && (
              <div className="rounded-md border border-gold-300 bg-gold-50 px-4 py-3 text-sm text-ink-700">
                لم يتم العثور على الرقم القومى فى دليل الأفراد. أدخل البيانات الأساسية بالأسفل لإنشاء الحساب وإضافة الهوية إلى الدليل.
              </div>
            )}
            {merged && !form.isManualIdentity && (
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
                    required
                    value={merged.fullArabicName}
                    onChange={(e) => {
                      handleOverride('fullArabicName', e.target.value);
                      setFieldErrors((prev) => ({ ...prev, fullArabicName: '' }));
                    }}
                    error={fieldErrors.fullArabicName}
                  />
                  <Input
                    label="رمز الضابط / الكود"
                    value={merged.officerCode}
                    onChange={(e) => {
                      handleOverride('officerCode', e.target.value);
                      setFieldErrors((prev) => ({ ...prev, officerCode: '' }));
                    }}
                    error={fieldErrors.officerCode}
                  />
                  <Input
                    label="رقم المحمول"
                    value={merged.mobileNumber}
                    onChange={(e) => {
                      handleOverride('mobileNumber', e.target.value);
                      setFieldErrors((prev) => ({ ...prev, mobileNumber: '' }));
                    }}
                    inputMode="tel"
                    dir="ltr"
                    error={fieldErrors.mobileNumber}
                  />
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-ink-700">الفئة</label>
                    <RadixSelect<UserType>
                      value={merged.userType}
                      onChange={(next) => handleOverride('userType', next)}
                      options={USER_TYPE_OPTIONS}
                      ariaLabel="الفئة"
                    />
                  </div>
                </div>
              )}

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
          <Link to={ROUTES.admin.users} className={buttonClassName({ variant: 'ghost' })}>
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
