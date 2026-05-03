/**
 * Stage 3 — personal data (RFP Scope Document §2.2 stage 3).
 * Comprehensive 4-part name + address + photo upload.
 */

import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Button, Card, FileUpload, Input, Select, toast } from '@/shared/components';
import { zodResolver } from '@/shared/lib/zod-resolver';
import { stage3Schema, type Stage3Values } from '../schemas';
import { applicantPortalService } from '../api/applicantPortal.service';
import { REF_GOVERNORATES, REF_NATIONALITIES } from '@/shared/mock-data/referenceData';

const APPLICANT_ID = 'APP-2026000';

export function Stage3PersonalPage(): JSX.Element {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors, isSubmitting }, watch, setValue } = useForm<Stage3Values>({
    resolver: zodResolver(stage3Schema),
    defaultValues: {
      gender: 'male',
      religion: 'مسلم',
      permanentSameAsCurrent: false,
    },
  });

  const sameAsCurrent = watch('permanentSameAsCurrent');
  const currentAddress = watch('currentAddress');

  const onSubmit = async (values: Stage3Values): Promise<void> => {
    if (values.permanentSameAsCurrent) values.permanentAddress = values.currentAddress;
    await applicantPortalService.submitStage(APPLICANT_ID, 3, { personal: values });
    toast('تم حفظ البيانات الشخصية', 'success');
    navigate('/applicant/profile/education');
  };

  return (
    <Card>
      <h2 className="mb-4 font-ar-display text-xl font-bold text-ink-900">البيانات الشخصية</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-4">
        <Input label="الاسم الأول" required {...register('firstName')} error={errors.firstName?.message} />
        <Input label="اسم الأب" required {...register('secondName')} error={errors.secondName?.message} />
        <Input label="اسم الجد" required {...register('thirdName')} error={errors.thirdName?.message} />
        <Input label="اللقب العائلي" required {...register('fourthName')} error={errors.fourthName?.message} />

        <Input
          label="تاريخ الميلاد"
          type="date"
          required
          {...register('dateOfBirth')}
          error={errors.dateOfBirth?.message}
        />
        <Select
          label="النوع"
          required
          {...register('gender')}
          options={[
            { value: 'male', label: 'ذكر' },
            { value: 'female', label: 'أنثى' },
          ]}
        />
        <Select
          label="محل الميلاد"
          required
          {...register('placeOfBirth')}
          options={REF_GOVERNORATES.map((g) => ({ value: g.nameAr, label: g.nameAr }))}
          error={errors.placeOfBirth?.message}
        />
        <Select
          label="الديانة"
          required
          {...register('religion')}
          options={[
            { value: 'مسلم', label: 'مسلم' },
            { value: 'مسيحي', label: 'مسيحي' },
          ]}
        />

        <Select
          label="الجنسية"
          required
          {...register('nationalityId')}
          options={REF_NATIONALITIES.map((n) => ({ value: n.id, label: n.nameAr }))}
          containerClassName="md:col-span-2"
          error={errors.nationalityId?.message}
        />
        <Input
          label="رقم المحمول"
          required
          dir="ltr"
          {...register('mobilePhone')}
          error={errors.mobilePhone?.message}
          containerClassName="md:col-span-2"
        />

        <Input
          label="البريد الإلكتروني"
          type="email"
          dir="ltr"
          {...register('email')}
          error={errors.email?.message}
          containerClassName="md:col-span-2"
        />
        <Input
          label="هاتف المنزل"
          dir="ltr"
          {...register('homePhone')}
          containerClassName="md:col-span-2"
        />

        <Input
          label="العنوان الحالي"
          required
          {...register('currentAddress')}
          error={errors.currentAddress?.message}
          containerClassName="md:col-span-4"
          placeholder="المحافظة - المركز/الحي - الشارع - رقم المبنى - الدور"
        />

        <label className="md:col-span-4 flex items-center gap-2 text-sm text-ink-700">
          <input
            type="checkbox"
            checked={sameAsCurrent}
            onChange={(e) => {
              setValue('permanentSameAsCurrent', e.target.checked);
              if (e.target.checked) setValue('permanentAddress', currentAddress);
            }}
            className="h-4 w-4 cursor-pointer accent-teal-500"
          />
          العنوان الدائم نفس العنوان الحالي
        </label>
        {!sameAsCurrent && (
          <Input
            label="العنوان الدائم"
            required
            {...register('permanentAddress')}
            error={errors.permanentAddress?.message}
            containerClassName="md:col-span-4"
          />
        )}

        <div className="md:col-span-4">
          <p className="mb-1 text-sm font-medium text-ink-700">الصورة الشخصية</p>
          <FileUpload
            accept="image/jpeg,image/png"
            maxSize={2 * 1024 * 1024}
            title="صورة بصيغة JPG أو PNG (حد أقصى 2 م.ب)"
          />
        </div>

        <div className="md:col-span-4 flex items-center justify-end gap-2 pt-2">
          <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting}>
            حفظ والمتابعة
          </Button>
        </div>
      </form>
    </Card>
  );
}
