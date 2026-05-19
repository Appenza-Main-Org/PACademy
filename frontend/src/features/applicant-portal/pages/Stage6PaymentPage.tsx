/**
 * Stage 6 — payment (MOI-aligned, single-method).
 *
 * Single method: الدفع بكود فوري. The credit-card sub-flow was removed
 * per ops feedback (applicants pay only via Fawry codes). The page
 * auto-issues a deterministic 8-digit code on mount, surfaces a تنبيه
 * Modal with the code and a copy button, then keeps the code visible
 * in an inline panel with a 48h countdown.
 *
 * The wizard store persists the issued code + 10-digit paymentReference
 * so the printed attendance card (Stage 9) can render them later.
 * On موافق dismiss, the store flips paid=true and the user routes to
 * /applicant/profile/family.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Copy, CreditCard, Loader2, RefreshCw, Receipt } from 'lucide-react';
import { Button, Card, Modal, toast } from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { useApplicantPortalStore } from '../store/applicantPortal.store';
import {
  useConfirmPaymentMutation,
  useCreatePaymentIntent,
} from '../api/applicantPortal.queries';
import { MOI_APPLICANT_SESSION } from '../lib/moi-session.mock';
import { cn } from '@/shared/lib/cn';

const APPLICANT_ID = MOI_APPLICANT_SESSION.applicantId;
const FEE_EGP = 250;
/** Demo-friendly TTL — short enough for the countdown to tick visibly
 *  and for the expiry → "إنشاء كود جديد" path to be demonstrable. */
const DEMO_FAWRY_TTL_MS = 3 * 60 * 1000;

export function Stage6PaymentPage(): JSX.Element {
  const navigate = useNavigate();
  const setPayment = useApplicantPortalStore((s) => s.setPayment);
  const createIntent = useCreatePaymentIntent();
  const confirmMut = useConfirmPaymentMutation(APPLICANT_ID);

  const [intentId, setIntentId] = useState<string | null>(null);
  const [refNumber, setRefNumber] = useState<string | null>(null);
  const [fawryCode, setFawryCode] = useState<string | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [issued, setIssued] = useState(false);
  /* Multi-step payment simulation modal. */
  const [payStep, setPayStep] = useState<'idle' | 'redirecting' | 'processing' | 'success'>(
    'idle',
  );
  /* Expiry ticks down every second; when it hits zero the code is dead
   *  until the applicant clicks "إنشاء كود جديد". */
  const [expiresAt, setExpiresAt] = useState<number>(() => Date.now() + DEMO_FAWRY_TTL_MS);
  const [now, setNow] = useState<number>(() => Date.now());
  const remainingMs = Math.max(0, expiresAt - now);
  const expired = remainingMs === 0;

  useEffect(() => {
    if (expired) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [expired, expiresAt]);

  /* Always issue a fresh Fawry code on mount — never reuse a persisted
   * one (client direction 2026-05-19: each visit should generate a new
   * code so the demo can show the regenerate flow). */
  useEffect(() => {
    if (issued) return;
    void createIntent
      .mutateAsync({ method: 'fawry-code' })
      .then((r) => {
        setIntentId(r.intentId);
        setRefNumber(r.refNumber);
        setFawryCode(r.fawryCode ?? null);
        setPayment({
          paid: false,
          paymentMethod: 'fawry-code',
          paymentReference: r.refNumber,
          fawryCode: r.fawryCode ?? null,
        });
        setIssued(true);
        setAlertOpen(true);
        setExpiresAt(Date.now() + DEMO_FAWRY_TTL_MS);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Regenerate a fresh code after expiry. */
  const onRegenerate = (): void => {
    void createIntent
      .mutateAsync({ method: 'fawry-code' })
      .then((r) => {
        setIntentId(r.intentId);
        setRefNumber(r.refNumber);
        setFawryCode(r.fawryCode ?? null);
        setPayment({
          paid: false,
          paymentMethod: 'fawry-code',
          paymentReference: r.refNumber,
          fawryCode: r.fawryCode ?? null,
        });
        setExpiresAt(Date.now() + DEMO_FAWRY_TTL_MS);
        setNow(Date.now());
        toast('تم إصدار كود فوري جديد', 'success');
      });
  };

  /**
   * Simulate the Fawry payment flow with three visible steps:
   *   1. redirecting → "جاري التحويل إلى بوابة فوري..."
   *   2. processing  → "جاري معالجة الدفع..."
   *   3. success     → "تم الدفع بنجاح"
   * On success: confirm the intent server-side, mark paid, navigate.
   */
  const onPay = (): void => {
    if (!intentId || payStep !== 'idle') return;
    setPayStep('redirecting');
    window.setTimeout(() => {
      setPayStep('processing');
      window.setTimeout(() => {
        void confirmMut
          .mutateAsync({ intentId })
          .then(() => {
            setPayment({
              paid: true,
              paymentMethod: 'fawry-code',
              paymentReference: refNumber,
              fawryCode,
            });
            setPayStep('success');
            window.setTimeout(() => {
              setPayStep('idle');
              navigate(ROUTES.applicantFamily);
            }, 1100);
          })
          .catch(() => {
            setPayStep('idle');
            toast('تعذّر إتمام عملية الدفع', 'danger');
          });
      }, 1500);
    }, 1200);
  };

  return (
    <Card>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-ar-display text-xl font-bold text-ink-900">الدفع مقابل الخدمة</h2>
          <p className="mt-1 text-sm text-ink-500">
            مقابل تقديم الخدمة إلكترونياً:{' '}
            <span className="font-numeric tnum font-bold text-ink-900" dir="ltr">
              {FEE_EGP} جنيه
            </span>
            {' '}— سدِّد كود فوري قبل انتهاء صلاحيته.
          </p>
        </div>
      </header>

      <FawryCodePanel
        fawryCode={fawryCode ?? ''}
        refNumber={refNumber ?? ''}
        loading={createIntent.isPending && !fawryCode}
        remainingMs={remainingMs}
        expired={expired}
        onRegenerate={onRegenerate}
        regenerating={createIntent.isPending}
        onPay={onPay}
        paying={confirmMut.isPending}
      />

      <PaymentSimulationModal step={payStep} />

      <Modal
        open={alertOpen}
        onClose={() => setAlertOpen(false)}
        title="تنبيه"
        size="sm"
      >
        <Modal.Body>
          <p className="text-sm leading-normal text-ink-800">
            تم إصدار كود فوري للدفع:
          </p>
          <div className="my-3 flex items-center justify-center gap-3">
            <span
              className="font-mono text-2xl font-bold text-ink-900"
              dir="ltr"
            >
              {fawryCode ?? ''}
            </span>
            <CopyCodeButton value={fawryCode ?? ''} />
          </div>
          <p className="text-sm text-ink-700">
            صلاحية الكود <span className="font-bold">3 دقائق</span> فقط — يمكنك إعادة الإصدار بعد انتهاء الصلاحية.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="primary" onClick={() => setAlertOpen(false)}>
            حسنا
          </Button>
        </Modal.Footer>
      </Modal>
    </Card>
  );
}

/* ─── Inline Fawry-code panel ────────────────────────────────────────── */

function FawryCodePanel({
  fawryCode,
  refNumber,
  loading,
  remainingMs,
  expired,
  onRegenerate,
  regenerating,
  onPay,
  paying,
}: {
  fawryCode: string;
  refNumber: string;
  loading: boolean;
  remainingMs: number;
  expired: boolean;
  onRegenerate: () => void;
  regenerating: boolean;
  onPay: () => void;
  paying: boolean;
}): JSX.Element {
  if (loading || !fawryCode) {
    return (
      <div className="rounded-lg border border-border-default bg-ink-50/60 p-6 text-center text-sm text-ink-700">
        جاري إصدار كود السداد...
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          'rounded-lg border-2 p-6 text-center',
          expired
            ? 'border-ink-300 bg-ink-50 text-ink-500'
            : 'border-teal-500 bg-teal-50/30',
        )}
      >
        <p className="text-2xs uppercase tracking-wide text-ink-500">
          كود الدفع بواسطة فوري
        </p>
        <div className="my-3 flex items-center justify-center gap-3">
          <span
            className={cn(
              'font-mono text-5xl font-bold',
              expired ? 'text-ink-400 line-through' : 'text-ink-900',
            )}
            dir="ltr"
          >
            {fawryCode}
          </span>
          {!expired && <CopyCodeButton value={fawryCode} size="lg" />}
        </div>
        {expired ? (
          <p className="text-sm font-bold text-terra-700">انتهت صلاحية الكود</p>
        ) : (
          <p className="text-sm text-ink-700">
            تنتهي الصلاحية خلال{' '}
            <span className="font-mono font-bold text-ink-900" dir="ltr">
              {formatRemaining(remainingMs)}
            </span>
          </p>
        )}
        {refNumber && (
          <p className="mt-1 text-2xs text-ink-500" dir="ltr">
            REF: {refNumber}
          </p>
        )}
      </div>

      {!expired && (
        <div className="flex items-start gap-3 rounded-md border border-dashed border-gold-300 bg-gold-50 px-4 py-3 text-2xs text-gold-800">
          <Receipt size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
          <p className="leading-relaxed">
            توجَّه إلى أقرب نقطة فوري وادفع المبلغ باستخدام الكود أعلاه. الكود صالح
            لمرة واحدة فقط ويُحتسب من تاريخ إصداره.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {expired ? (
          <Button
            variant="primary"
            size="lg"
            leadingIcon={<RefreshCw size={16} strokeWidth={1.75} />}
            onClick={onRegenerate}
            isLoading={regenerating}
          >
            إنشاء كود جديد
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            leadingIcon={<CreditCard size={16} strokeWidth={1.75} />}
            onClick={onPay}
            isLoading={paying}
          >
            ادفع الآن
          </Button>
        )}
      </div>
    </div>
  );
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ─── Payment simulation modal ──────────────────────────────────────── */

function PaymentSimulationModal({
  step,
}: {
  step: 'idle' | 'redirecting' | 'processing' | 'success';
}): JSX.Element {
  const open = step !== 'idle';
  const isSuccess = step === 'success';
  const label =
    step === 'redirecting'
      ? 'جاري التحويل إلى بوابة فوري...'
      : step === 'processing'
        ? 'جاري معالجة الدفع...'
        : 'تم الدفع بنجاح';
  return (
    <Modal open={open} onClose={() => undefined} title="بوابة الدفع — فوري" size="sm">
      <Modal.Body>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <span
            aria-hidden
            className={cn(
              'inline-flex h-14 w-14 items-center justify-center rounded-full',
              isSuccess ? 'bg-teal-50 text-teal-700' : 'bg-ink-50 text-teal-700',
            )}
          >
            {isSuccess ? (
              <CheckCircle2 size={32} strokeWidth={1.75} />
            ) : (
              <Loader2 size={28} strokeWidth={1.75} className="animate-spin" />
            )}
          </span>
          <p
            className={cn(
              'font-ar-display text-md font-bold',
              isSuccess ? 'text-teal-700' : 'text-ink-900',
            )}
          >
            {label}
          </p>
          {!isSuccess && (
            <p className="text-2xs text-ink-500">
              يرجى عدم إغلاق هذه الصفحة حتى تكتمل عملية الدفع.
            </p>
          )}
        </div>
      </Modal.Body>
    </Modal>
  );
}

/* ─── Copy button ───────────────────────────────────────────────────── */

function CopyCodeButton({
  value,
  size = 'md',
}: {
  value: string;
  size?: 'md' | 'lg';
}): JSX.Element {
  const onCopy = (): void => {
    void navigator.clipboard
      .writeText(value)
      .then(() => toast('تم نسخ الكود', 'info'))
      .catch(() => toast('تعذر نسخ الكود', 'danger'));
  };
  const dim = size === 'lg' ? 'h-10 w-10' : 'h-8 w-8';
  const iconSize = size === 'lg' ? 18 : 14;
  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label="نسخ الكود"
      className={cn(
        dim,
        'inline-flex shrink-0 items-center justify-center rounded-md border border-border-default bg-surface-card text-ink-700 transition-colors hover:border-teal-500 hover:bg-teal-50 hover:text-teal-700 focus-visible:shadow-focus-teal focus-visible:outline-none',
      )}
    >
      <Copy size={iconSize} strokeWidth={1.75} />
    </button>
  );
}

