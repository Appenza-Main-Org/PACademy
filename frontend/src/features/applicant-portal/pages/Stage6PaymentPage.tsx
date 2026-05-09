/**
 * Stage 6 — payment (RFP Scope Document §2.2 stage 6).
 * Single method: Fawry. The credit-card path was removed per ops feedback —
 * applicants pay only via Fawry codes. Auto-verify after demo wait, show
 * printable receipt.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, Receipt, ShieldCheck, Smartphone } from 'lucide-react';
import { Badge, Button, Card, Input, Modal, PrintLayout, toast } from '@/shared/components';
import { useInitiatePayment, useVerifyPayment } from '../api/applicantPortal.queries';
import { useActiveCycle } from '../api/categories.queries';
import { applicantPortalService } from '../api/applicantPortal.service';
import { withAudit } from '@/shared/lib/audit';

const APPLICANT_ID = 'APP-2026000';
const FEE = 1500;
const FAWRY_DEFAULT_RETRY_HOURS = 48;

export function Stage6PaymentPage(): JSX.Element {
  const navigate = useNavigate();
  const [refNumber, setRefNumber] = useState<string | null>(null);
  const [fawryCode, setFawryCode] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  /* AF-2 — pre-payment identity re-verification. Stage 6 is gated until
   * the applicant re-enters their NID and mobile to confirm identity
   * before money moves. */
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const initiateMut = useInitiatePayment(APPLICANT_ID);
  const verifyMut = useVerifyPayment(APPLICANT_ID);
  const { data: activeCycle } = useActiveCycle();
  const fawryRetryHours =
    activeCycle?.fees?.fawryConfig?.retryWindowHours ?? FAWRY_DEFAULT_RETRY_HOURS;

  const initiate = async (): Promise<void> => {
    const r = await initiateMut.mutateAsync({ method: 'fawry', amount: FEE });
    setRefNumber(r.refNumber);
    setFawryCode(r.fawryCode ?? null);
  };

  const verify = async (): Promise<void> => {
    if (!refNumber) return;
    const r = await verifyMut.mutateAsync(refNumber);
    if (r.status === 'success') {
      setPaid(true);
      toast('تم تأكيد عملية الدفع', 'success');
    } else toast('فشل التحقق من الدفع', 'danger');
  };

  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 className="font-ar-display text-xl font-bold text-ink-900">سداد رسوم التقديم</h2>
        {paid && <Badge tone="success">تم الدفع</Badge>}
      </div>

      <div
        className="mb-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border p-5"
        style={{
          borderColor: 'var(--accent-500, #1A6868)',
          background:
            'linear-gradient(135deg, var(--accent-50, #E6F1F1) 0%, var(--surface-card, #FFFFFF) 100%)',
        }}
      >
        <div>
          <p className="text-2xs font-bold uppercase tracking-wide text-ink-500">
            رسم التقديم
          </p>
          <p className="mt-1 flex items-baseline gap-2">
            <span
              className="font-numeric tnum font-ar-display text-4xl font-bold text-ink-900"
              dir="ltr"
            >
              {FEE.toLocaleString('en-US')}
            </span>
            <span className="text-md font-bold text-ink-700">جنيه</span>
          </p>
        </div>
        <div className="text-end text-2xs text-ink-500">
          <p>يُسدَّد مرة واحدة لهذه الدورة</p>
          <p className="mt-0.5">قابل للاسترداد وفق اللائحة</p>
        </div>
      </div>

      <div
        role="note"
        className="mb-5 flex items-start gap-3 rounded-md border border-dashed border-gold-300 bg-gold-50 p-3 text-2xs text-gold-700"
      >
        <FlaskConical
          size={16}
          strokeWidth={1.75}
          className="mt-0.5 shrink-0"
          aria-hidden
        />
        <div>
          <p className="font-bold">محاكاة عرض توضيحية</p>
          <p className="mt-0.5 leading-relaxed">
            هذه الخطوة عرض تجريبي ولا تتم أي عملية دفع حقيقية. لم يتم ربط
            البوابة بمزوّد فوري أو بوابة الدفع الإلكتروني بعد، ولن يُخصم أي
            مبلغ من حسابك.
          </p>
        </div>
      </div>

      {!identityConfirmed && (
        <IdentityConfirmGate onConfirmed={() => setIdentityConfirmed(true)} />
      )}

      <fieldset disabled={!identityConfirmed} className="contents">
      <div className="mb-5 flex items-start gap-3 rounded-lg border border-teal-500 bg-teal-50 p-4">
        <span
          aria-hidden
          className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-teal-500 text-white"
        >
          <Smartphone size={20} strokeWidth={1.75} />
        </span>
        <div>
          <p className="font-ar-display text-md font-bold text-teal-900">السداد عبر فوري</p>
          <p className="mt-0.5 text-2xs text-teal-800/85 leading-relaxed">
            بعد إصدار رمز السداد، توجّه إلى أقرب نقطة فوري وادفع المبلغ خلال {fawryRetryHours} ساعة.
            رمز السداد صالح لمرة واحدة فقط.
          </p>
        </div>
      </div>

      {!refNumber && !paid && (
        <Button variant="primary" size="lg" onClick={initiate}>
          إصدار رمز السداد
        </Button>
      )}

      {refNumber && !paid && (
        <div className="mb-4 rounded-md border border-teal-300 bg-teal-50 p-4">
          <p className="text-sm font-medium text-teal-800">
            رقم المرجع: <span dir="ltr" className="font-mono">{refNumber}</span>
          </p>
          {fawryCode && (
            <p className="mt-2 text-2xl font-bold font-numeric tnum text-teal-900" dir="ltr">
              {fawryCode}
            </p>
          )}
          <Button variant="primary" className="mt-3" onClick={verify}>
            التحقق من السداد
          </Button>
        </div>
      )}

      {paid && (
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            leadingIcon={<Receipt size={14} strokeWidth={1.75} />}
            onClick={() => setShowReceipt(true)}
          >
            عرض الإيصال
          </Button>
          <Button variant="primary" size="lg" onClick={() => navigate('/applicant/profile/family')}>
            متابعة
          </Button>
        </div>
      )}

      </fieldset>

      <Modal open={showReceipt} onClose={() => setShowReceipt(false)} title="إيصال الدفع" size="lg">
        <Modal.Body>
          <PrintLayout
            title="إيصال سداد رسوم التقديم"
            reportId={refNumber ?? ''}
            generatedAt={new Date().toLocaleString('ar-EG')}
          >
            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              <ReceiptRow label="رقم المتقدم" value={APPLICANT_ID} mono />
              <ReceiptRow label="طريقة الدفع" value="فوري" />
              <ReceiptRow label="رقم المرجع" value={refNumber ?? '—'} mono fullWidth />
              <ReceiptRow label="المبلغ" value={`${FEE.toLocaleString('en-US')} جنيه`} numeric fullWidth />
            </dl>
          </PrintLayout>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setShowReceipt(false)}>إغلاق</Button>
          <Button variant="primary" onClick={() => window.print()}>طباعة</Button>
        </Modal.Footer>
      </Modal>
    </Card>
  );
}

function ReceiptRow({
  label,
  value,
  mono,
  numeric,
  fullWidth,
}: {
  label: string;
  value: string;
  mono?: boolean;
  numeric?: boolean;
  fullWidth?: boolean;
}): JSX.Element {
  return (
    <div className={fullWidth ? 'sm:col-span-2' : undefined}>
      <dt className="text-2xs uppercase tracking-wide text-ink-500">{label}</dt>
      <dd
        className={
          'mt-1 text-sm text-ink-900 ' +
          (mono ? 'font-mono break-all' : '') +
          (numeric ? 'font-numeric tnum font-medium' : '')
        }
        dir={mono ? 'ltr' : undefined}
      >
        {value}
      </dd>
    </div>
  );
}

function IdentityConfirmGate({ onConfirmed }: { onConfirmed: () => void }): JSX.Element {
  const [nid, setNid] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (): Promise<void> => {
    if (submitting) return;
    setSubmitting(true);
    try {
      /* AF-2 — emit audit event for the pre-payment identity attestation.
       * This is the authoritative record that the applicant re-confirmed
       * NID + mobile before money moved; useful for downstream payment
       * dispute resolution. */
      await withAudit(
        () => applicantPortalService.confirmPrePayment('APP-2026000', { nationalId: nid, phoneNumber: phone }),
        {
          action: 'applicant.transition',
          module: 'applicants',
          entityType: 'applicant_payment_identity',
          entityLabel: 'تأكيد الهوية قبل السداد',
          entityId: 'APP-2026000',
          details: 'إعادة إدخال الرقم القومي والهاتف للتحقق من الهوية قبل السداد',
          afterFrom: () => ({ confirmedAt: Date.now() }),
          actor: { id: 'APP-2026000', name: 'المتقدم', role: 'applicant' },
        },
      );
      toast('تم تأكيد الهوية', 'success');
      onConfirmed();
    } catch (err) {
      toast((err as Error).message ?? 'تعذر تأكيد الهوية', 'danger');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mb-5 rounded-md border border-teal-300 bg-teal-50 p-4">
      <div className="mb-3 flex items-start gap-3">
        <span aria-hidden className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-teal-500 text-white">
          <ShieldCheck size={18} strokeWidth={1.75} />
        </span>
        <div>
          <p className="font-ar-display text-md font-bold text-teal-900">تأكيد الهوية قبل السداد</p>
          <p className="mt-0.5 text-2xs text-teal-800/85 leading-relaxed">
            احتياطاً قبل تحريك أي مبلغ، يُرجى إعادة إدخال رقمك القومي ورقم هاتفك. يجب أن يطابقا
            البيانات المُسجَّلة في خطوة التحقق من الهاتف.
          </p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Input
          label="الرقم القومي"
          required
          placeholder="14 رقماً"
          dir="ltr"
          value={nid}
          onChange={(e) => setNid(e.target.value)}
        />
        <Input
          label="رقم الهاتف المحمول"
          required
          placeholder="01XXXXXXXXX"
          dir="ltr"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <div className="mt-3 flex justify-end">
        <Button variant="primary" onClick={submit} isLoading={submitting} disabled={!nid || !phone}>
          تأكيد الهوية
        </Button>
      </div>
    </div>
  );
}

