/**
 * Stage 6 — payment (PDF pp.6-7, MOI-aligned).
 *
 * Two-method flow:
 *   - Step A: method picker — الدفع بكود فوري | الدفع بالبطاقة الإئتمانية
 *   - Step B1 (fawry-code): Modal alert → inline code page with 48h
 *     countdown + "switch to card" button
 *   - Step B2 (credit-card): 3 sub-steps mimicking the Fawry hosted page
 *     - B2.a Payment Methods (Credit Card radio + VISA/MC chip)
 *     - B2.b Card details form (Card Number / Expiration / CVV)
 *     - B2.c Payment Summary → Confirm Payment
 *
 * Both methods persist a deterministic 10-digit `paymentReference` on the
 * wizard store. On Confirm Payment (or after the Fawry-code wait window),
 * the store flips `paid=true` and the user routes to /applicant/family.
 */

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
  FlaskConical,
  Lock,
  Receipt,
} from 'lucide-react';
import { Button, Card, Input, Modal, toast } from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { useApplicantPortalStore } from '../store/applicantPortal.store';
import {
  useCreatePaymentIntent,
  useConfirmPaymentMutation,
} from '../api/applicantPortal.queries';
import { MOI_APPLICANT_SESSION } from '../lib/moi-session.mock';
import { date as fmtDate } from '@/shared/lib/format';
import { toEasternArabicNumerals } from '@/shared/lib/arabic';
import { cn } from '@/shared/lib/cn';

const APPLICANT_ID = MOI_APPLICANT_SESSION.applicantId;
const FEE_EGP = 250; /* MOI reference: مقابل تقديم الخدمة إلكترونياً ٢٥٠ جنيه */

type Step = 'pick' | 'fawry-code' | 'cc-method' | 'cc-details' | 'cc-summary';

export function Stage6PaymentPage(): JSX.Element {
  const navigate = useNavigate();
  const setPayment = useApplicantPortalStore((s) => s.setPayment);
  const storedRef = useApplicantPortalStore((s) => s.paymentReference);
  const storedFawry = useApplicantPortalStore((s) => s.fawryCode);
  const createIntent = useCreatePaymentIntent();
  const confirmMut = useConfirmPaymentMutation(APPLICANT_ID);
  const [step, setStep] = useState<Step>('pick');
  const [intentId, setIntentId] = useState<string | null>(null);
  const [fawryAlertOpen, setFawryAlertOpen] = useState(false);
  const [refNumber, setRefNumber] = useState<string | null>(storedRef);
  const [fawryCode, setFawryCode] = useState<string | null>(storedFawry);
  const [cardForm, setCardForm] = useState({ number: '', expiry: '', cvv: '' });

  const pickFawry = async (): Promise<void> => {
    const r = await createIntent.mutateAsync({ method: 'fawry-code' });
    setIntentId(r.intentId);
    setRefNumber(r.refNumber);
    setFawryCode(r.fawryCode ?? null);
    setPayment({
      paid: false,
      paymentMethod: 'fawry-code',
      paymentReference: r.refNumber,
      fawryCode: r.fawryCode ?? null,
    });
    setStep('fawry-code');
    setFawryAlertOpen(true);
  };

  const pickCard = async (): Promise<void> => {
    const r = await createIntent.mutateAsync({ method: 'credit-card' });
    setIntentId(r.intentId);
    setRefNumber(r.refNumber);
    setFawryCode(null);
    setPayment({
      paid: false,
      paymentMethod: 'credit-card',
      paymentReference: r.refNumber,
      fawryCode: null,
    });
    setStep('cc-method');
  };

  const confirmCard = async (): Promise<void> => {
    if (!intentId) return;
    await confirmMut.mutateAsync({ intentId });
    setPayment({
      paid: true,
      paymentMethod: 'credit-card',
      paymentReference: refNumber,
      fawryCode: null,
    });
    toast('تم الدفع بنجاح', 'success');
    navigate(ROUTES.applicantFamily);
  };

  return (
    <Card>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-ar-display text-xl font-bold text-ink-900">الدفع مقابل الخدمة</h2>
          <p className="mt-1 text-sm text-ink-500">
            مقابل تقديم الخدمة إلكترونياً:{' '}
            <span className="font-numeric tnum font-bold text-ink-900">
              {toEasternArabicNumerals(String(FEE_EGP))} جنيه
            </span>
          </p>
        </div>
        <DemoNotice />
      </header>

      {step === 'pick' && <MethodPicker onFawry={pickFawry} onCard={pickCard} loading={createIntent.isPending} />}

      {step === 'fawry-code' && (
        <FawryCodePanel
          fawryCode={fawryCode ?? ''}
          refNumber={refNumber ?? ''}
          onSwitchToCard={pickCard}
        />
      )}

      {(step === 'cc-method' || step === 'cc-details' || step === 'cc-summary') && (
        <FawryHostedSimulation
          step={step}
          card={cardForm}
          fee={FEE_EGP}
          onCardChange={setCardForm}
          onBackToPick={() => setStep('pick')}
          onNext={(next) => setStep(next)}
          onConfirm={confirmCard}
          confirming={confirmMut.isPending}
        />
      )}

      {/* Modal alert before the inline Fawry code (PDF p.6 lower). */}
      <Modal
        open={fawryAlertOpen}
        onClose={() => setFawryAlertOpen(false)}
        title="تنبيه"
        size="sm"
      >
        <Modal.Body>
          <p className="text-sm leading-normal text-ink-800">
            تم إختيار الدفع عن طريق فوري بالكود:
          </p>
          <p className="my-3 text-center font-mono text-2xl font-bold text-ink-900" dir="ltr">
            {fawryCode ?? ''}
          </p>
          <p className="text-sm text-ink-700">
            برجاء الدفع قبل: <span className="font-bold">{plus48h()}</span>
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={() => setFawryAlertOpen(false)}>
            موافق
          </Button>
        </Modal.Footer>
      </Modal>
    </Card>
  );
}

/* ─── Method picker ──────────────────────────────────────────────────── */

function MethodPicker({
  onFawry,
  onCard,
  loading,
}: {
  onFawry: () => void;
  onCard: () => void;
  loading: boolean;
}): JSX.Element {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <BigMethodButton
        title="الدفع بكود فوري"
        subtitle="أصدر كوداً وسدّد المبلغ من أقرب نقطة فوري خلال 48 ساعة"
        icon={<Receipt size={28} strokeWidth={1.5} />}
        onClick={onFawry}
        disabled={loading}
      />
      <BigMethodButton
        title="الدفع بالبطاقة الإئتمانية"
        subtitle="ادفع مباشرة باستخدام بطاقة VISA أو Mastercard"
        icon={<CreditCard size={28} strokeWidth={1.5} />}
        onClick={onCard}
        disabled={loading}
      />
    </div>
  );
}

function BigMethodButton({
  title,
  subtitle,
  icon,
  onClick,
  disabled,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group flex flex-col items-center gap-3 rounded-lg border-2 border-teal-500 bg-teal-50/40 p-6 text-center transition-all duration-fast ease-standard hover:-translate-y-px hover:bg-teal-50 hover:shadow-card focus-visible:shadow-focus-teal focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span
        aria-hidden
        className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-teal-500 text-white transition-colors group-hover:bg-teal-600"
      >
        {icon}
      </span>
      <p className="font-ar-display text-lg font-bold text-ink-900">{title}</p>
      <p className="text-sm text-ink-500">{subtitle}</p>
    </button>
  );
}

/* ─── Fawry code inline panel ────────────────────────────────────────── */

function FawryCodePanel({
  fawryCode,
  refNumber,
  onSwitchToCard,
}: {
  fawryCode: string;
  refNumber: string;
  onSwitchToCard: () => void;
}): JSX.Element {
  const deadline = useMemo(() => plus48h(), []);
  const onCopy = (): void => {
    void navigator.clipboard.writeText(fawryCode).then(() => toast('تم نسخ الكود', 'info'));
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border-2 border-teal-500 bg-teal-50/30 p-6 text-center">
        <p className="text-2xs uppercase tracking-wide text-ink-500">كود الدفع بواسطة فوري</p>
        <div className="my-3 flex items-center justify-center gap-3">
          <span className="font-mono text-5xl font-bold text-ink-900" dir="ltr">
            {fawryCode}
          </span>
          <button
            type="button"
            onClick={onCopy}
            aria-label="نسخ الكود"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border-default bg-surface-card text-ink-700 hover:border-teal-500 hover:bg-teal-50 hover:text-teal-700 focus-visible:shadow-focus-teal focus-visible:outline-none"
          >
            <Copy size={16} strokeWidth={1.75} />
          </button>
        </div>
        <p className="text-sm text-ink-700">
          برجاء الدفع قبل: <span className="font-bold">{deadline}</span>
        </p>
        <p className="mt-1 text-2xs text-ink-500" dir="ltr">
          REF: {refNumber}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-default bg-ink-50 px-4 py-3 text-sm text-ink-700">
        <span>لتغيير طريقة الدفع:</span>
        <Button variant="secondary" onClick={onSwitchToCard}>
          الدفع بالبطاقة الإئتمانية
        </Button>
      </div>
    </div>
  );
}

/* ─── Credit card hosted-page simulation ─────────────────────────────── */

function FawryHostedSimulation({
  step,
  card,
  fee,
  onCardChange,
  onBackToPick,
  onNext,
  onConfirm,
  confirming,
}: {
  step: Step;
  card: { number: string; expiry: string; cvv: string };
  fee: number;
  onCardChange: (next: { number: string; expiry: string; cvv: string }) => void;
  onBackToPick: () => void;
  onNext: (next: Step) => void;
  onConfirm: () => void;
  confirming: boolean;
}): JSX.Element {
  const last4 = card.number.replace(/\s+/g, '').slice(-4) || '4242';
  return (
    <div className="grid gap-4 rounded-md border border-border-default bg-surface-card p-4 md:grid-cols-[1fr_minmax(0,1.6fr)]">
      <FawrySimSummary fee={fee} />
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-2xs text-ink-500">
          <span className="inline-flex items-center gap-2 rounded-pill bg-ink-50 px-3 py-1">
            <Lock size={11} strokeWidth={1.75} />
            محاكاة بوابة فوري — لا تتم عملية دفع حقيقية
          </span>
          <span className="font-mono tracking-widest" dir="ltr">
            FAWRY · sandbox
          </span>
        </div>

        {step === 'cc-method' && (
          <CcMethodPanel
            onBack={onBackToPick}
            onContinue={() => onNext('cc-details')}
          />
        )}
        {step === 'cc-details' && (
          <CcDetailsPanel
            card={card}
            onChange={onCardChange}
            onBack={() => onNext('cc-method')}
            onContinue={() => onNext('cc-summary')}
          />
        )}
        {step === 'cc-summary' && (
          <CcSummaryPanel
            fee={fee}
            last4={last4}
            onBack={() => onNext('cc-details')}
            onConfirm={onConfirm}
            confirming={confirming}
          />
        )}
      </div>
    </div>
  );
}

function FawrySimSummary({ fee }: { fee: number }): JSX.Element {
  return (
    <aside className="flex flex-col gap-2 rounded-md border border-border-subtle bg-ink-50 p-3 text-sm text-ink-800">
      <p className="text-2xs uppercase tracking-wide text-ink-500">Order summary</p>
      <dl className="grid grid-cols-2 gap-y-1.5">
        <dt>Sub Total</dt>
        <dd className="text-end font-numeric tnum" dir="ltr">
          {fee} EGP
        </dd>
        <dt className="font-bold">Total</dt>
        <dd className="text-end font-numeric tnum font-bold" dir="ltr">
          {fee} EGP
        </dd>
      </dl>
    </aside>
  );
}

function CcMethodPanel({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: () => void;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-ink-900">Payment Methods</p>
      <label className="flex items-center justify-between gap-3 rounded-md border-2 border-teal-500 bg-teal-50/40 px-3 py-2 text-sm text-ink-900">
        <span className="inline-flex items-center gap-2">
          <input type="radio" checked readOnly className="h-4 w-4 accent-teal-500" />
          <CreditCard size={16} strokeWidth={1.75} />
          <span>Credit Card</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-pill bg-surface-card px-2 py-0.5 text-2xs text-ink-700 ring-1 ring-border-default" dir="ltr">
          VISA · Mastercard
        </span>
      </label>
      <div className="mt-2 flex justify-between gap-2">
        <Button variant="ghost" leadingIcon={<ChevronRight size={14} strokeWidth={1.75} className="rtl:rotate-180" />} onClick={onBack}>
          Step Back
        </Button>
        <Button variant="primary" trailingIcon={<ChevronLeft size={14} strokeWidth={1.75} className="rtl:rotate-180" />} onClick={onContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}

function CcDetailsPanel({
  card,
  onChange,
  onBack,
  onContinue,
}: {
  card: { number: string; expiry: string; cvv: string };
  onChange: (next: { number: string; expiry: string; cvv: string }) => void;
  onBack: () => void;
  onContinue: () => void;
}): JSX.Element {
  const numberValid = card.number.replace(/\s+/g, '').length >= 12;
  const expiryValid = /^\d{2}\/\d{2}$/.test(card.expiry);
  const cvvValid = /^\d{3,4}$/.test(card.cvv);
  const valid = numberValid && expiryValid && cvvValid;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-ink-900">Card Details</p>
      <Input
        label="Card Number"
        dir="ltr"
        placeholder="0000 0000 0000 0000"
        value={card.number}
        onChange={(e) => onChange({ ...card, number: formatCardNumber(e.target.value) })}
        inputMode="numeric"
        maxLength={19}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Expiration Date"
          dir="ltr"
          placeholder="MM/YY"
          value={card.expiry}
          onChange={(e) => onChange({ ...card, expiry: formatExpiry(e.target.value) })}
          maxLength={5}
        />
        <Input
          label="CVV"
          dir="ltr"
          placeholder="123"
          value={card.cvv}
          onChange={(e) => onChange({ ...card, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
          inputMode="numeric"
        />
      </div>
      <div className="mt-2 flex justify-between gap-2">
        <Button variant="ghost" leadingIcon={<ChevronRight size={14} strokeWidth={1.75} className="rtl:rotate-180" />} onClick={onBack}>
          Step Back
        </Button>
        <Button
          variant="primary"
          trailingIcon={<ChevronLeft size={14} strokeWidth={1.75} className="rtl:rotate-180" />}
          onClick={onContinue}
          disabled={!valid}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

function CcSummaryPanel({
  fee,
  last4,
  onBack,
  onConfirm,
  confirming,
}: {
  fee: number;
  last4: string;
  onBack: () => void;
  onConfirm: () => void;
  confirming: boolean;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium text-ink-900">Payment Summary</p>
      <div className="rounded-md border border-border-default bg-surface-card p-3 text-sm">
        <dl className="grid grid-cols-2 gap-y-2">
          <dt className="text-ink-500">Credit Card</dt>
          <dd className="text-end font-mono text-ink-900" dir="ltr">
            XXXX XXXX XXXX {last4}
          </dd>
          <dt className="text-ink-500">Sub Total</dt>
          <dd className="text-end font-numeric tnum" dir="ltr">
            {fee} EGP
          </dd>
          <dt className="font-bold text-ink-900">Total</dt>
          <dd className="text-end font-numeric tnum font-bold text-ink-900" dir="ltr">
            {fee} EGP
          </dd>
        </dl>
      </div>
      <div className="mt-2 flex justify-between gap-2">
        <Button variant="ghost" leadingIcon={<ChevronRight size={14} strokeWidth={1.75} className="rtl:rotate-180" />} onClick={onBack}>
          Step Back
        </Button>
        <Button variant="primary" onClick={onConfirm} isLoading={confirming}>
          Confirm Payment
        </Button>
      </div>
    </div>
  );
}

/* ─── helpers ──────────────────────────────────────────────────────── */

function DemoNotice(): JSX.Element {
  return (
    <span
      role="note"
      className={cn(
        'inline-flex items-start gap-2 rounded-md border border-dashed border-gold-300 bg-gold-50 px-3 py-2 text-2xs text-gold-700',
      )}
    >
      <FlaskConical size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
      <span className="leading-relaxed">محاكاة عرض توضيحية — لا تتم أي عملية دفع حقيقية.</span>
    </span>
  );
}

function plus48h(): string {
  const d = new Date(Date.now() + 48 * 3600 * 1000);
  return fmtDate(d.toISOString(), 'short');
}

function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

