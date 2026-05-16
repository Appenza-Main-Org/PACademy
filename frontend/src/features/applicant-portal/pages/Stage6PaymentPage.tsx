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

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, FlaskConical, Receipt } from 'lucide-react';
import { Button, Card, Modal, toast } from '@/shared/components';
import { ROUTES } from '@/config/routes';
import { useApplicantPortalStore } from '../store/applicantPortal.store';
import {
  useConfirmPaymentMutation,
  useCreatePaymentIntent,
} from '../api/applicantPortal.queries';
import { MOI_APPLICANT_SESSION } from '../lib/moi-session.mock';
import { date as fmtDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';

const APPLICANT_ID = MOI_APPLICANT_SESSION.applicantId;
const FEE_EGP = 250;

export function Stage6PaymentPage(): JSX.Element {
  const navigate = useNavigate();
  const setPayment = useApplicantPortalStore((s) => s.setPayment);
  const storedRef = useApplicantPortalStore((s) => s.paymentReference);
  const storedFawry = useApplicantPortalStore((s) => s.fawryCode);
  const createIntent = useCreatePaymentIntent();
  const confirmMut = useConfirmPaymentMutation(APPLICANT_ID);

  const [intentId, setIntentId] = useState<string | null>(null);
  const [refNumber, setRefNumber] = useState<string | null>(storedRef);
  const [fawryCode, setFawryCode] = useState<string | null>(storedFawry);
  const [alertOpen, setAlertOpen] = useState(false);
  const [issued, setIssued] = useState(false);

  /* Auto-issue the Fawry code on mount when nothing is persisted yet.
   * Re-mounts that find a stored code/reference skip the intent call and
   * just re-open the alert so the applicant can grab the code again. */
  useEffect(() => {
    if (issued) return;
    if (storedRef && storedFawry) {
      setIntentId(`INT-${storedRef}`);
      setIssued(true);
      setAlertOpen(true);
      return;
    }
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
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onAcknowledge = async (): Promise<void> => {
    setAlertOpen(false);
    if (!intentId) return;
    await confirmMut.mutateAsync({ intentId });
    setPayment({
      paid: true,
      paymentMethod: 'fawry-code',
      paymentReference: refNumber,
      fawryCode,
    });
    toast('تم اعتماد كود فوري — سيتم تأكيد الدفع تلقائياً بعد سداده', 'success');
    navigate(ROUTES.applicantFamily);
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
            {' '}— يُسدَّد عبر فوري خلال 48 ساعة.
          </p>
        </div>
        <DemoNotice />
      </header>

      <FawryCodePanel
        fawryCode={fawryCode ?? ''}
        refNumber={refNumber ?? ''}
        loading={createIntent.isPending && !fawryCode}
      />

      <Modal
        open={alertOpen}
        onClose={() => setAlertOpen(false)}
        title="تنبيه"
        size="sm"
      >
        <Modal.Body>
          <p className="text-sm leading-normal text-ink-800">
            تم إختيار الدفع عن طريق فوري بالكود:
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
            برجاء الدفع قبل: <span className="font-bold">{plus48h()}</span>
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="primary"
            onClick={onAcknowledge}
            isLoading={confirmMut.isPending}
          >
            موافق
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
}: {
  fawryCode: string;
  refNumber: string;
  loading: boolean;
}): JSX.Element {
  const deadline = useMemo(() => plus48h(), []);
  if (loading || !fawryCode) {
    return (
      <div className="rounded-lg border border-border-default bg-ink-50/60 p-6 text-center text-sm text-ink-700">
        جاري إصدار كود السداد...
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border-2 border-teal-500 bg-teal-50/30 p-6 text-center">
        <p className="text-2xs uppercase tracking-wide text-ink-500">
          كود الدفع بواسطة فوري
        </p>
        <div className="my-3 flex items-center justify-center gap-3">
          <span className="font-mono text-5xl font-bold text-ink-900" dir="ltr">
            {fawryCode}
          </span>
          <CopyCodeButton value={fawryCode} size="lg" />
        </div>
        <p className="text-sm text-ink-700">
          برجاء الدفع قبل: <span className="font-bold">{deadline}</span>
        </p>
        {refNumber && (
          <p className="mt-1 text-2xs text-ink-500" dir="ltr">
            REF: {refNumber}
          </p>
        )}
      </div>
      <div className="flex items-start gap-3 rounded-md border border-dashed border-gold-300 bg-gold-50 px-4 py-3 text-2xs text-gold-800">
        <Receipt size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden />
        <p className="leading-relaxed">
          توجَّه إلى أقرب نقطة فوري وادفع المبلغ باستخدام الكود أعلاه. الكود صالح
          لمرة واحدة فقط ويُحتسب من تاريخ إصداره.
        </p>
      </div>
    </div>
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

/* ─── helpers ───────────────────────────────────────────────────────── */

function DemoNotice(): JSX.Element {
  return (
    <span
      role="note"
      className="inline-flex items-start gap-2 rounded-md border border-dashed border-gold-300 bg-gold-50 px-3 py-2 text-2xs text-gold-700"
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
