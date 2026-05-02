/**
 * Stage 6 — payment (KARASA §2.2 stage 6).
 * Two methods: Fawry (24h code) or card (gateway redirect). Auto-verify
 * after demo wait, show printable receipt.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Receipt, Smartphone } from 'lucide-react';
import { Badge, Button, Card, Modal, PrintLayout, toast } from '@/shared/components';
import { applicantPortalService } from '../api/applicantPortal.service';

const APPLICANT_ID = 'APP-2026000';
const FEE = 1500;

export function Stage6PaymentPage(): JSX.Element {
  const navigate = useNavigate();
  const [method, setMethod] = useState<'fawry' | 'card'>('fawry');
  const [refNumber, setRefNumber] = useState<string | null>(null);
  const [fawryCode, setFawryCode] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  const initiate = async (): Promise<void> => {
    const r = await applicantPortalService.initiatePayment(APPLICANT_ID, method, FEE);
    setRefNumber(r.refNumber);
    setFawryCode(r.fawryCode ?? null);
    if (method === 'card') toast('تم توجيهك إلى بوابة الدفع (محاكاة)', 'info');
  };

  const verify = async (): Promise<void> => {
    if (!refNumber) return;
    const r = await applicantPortalService.verifyPayment(refNumber);
    if (r.status === 'success') {
      setPaid(true);
      toast('تم تأكيد عملية الدفع', 'success');
    } else toast('فشل التحقق من الدفع', 'danger');
  };

  return (
    <Card>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-ar-display text-xl font-bold text-ink-900">سداد رسوم التقديم</h2>
          <p className="mt-1 text-sm text-ink-500">
            رسم التقديم: <span className="font-numeric tnum font-bold">{FEE.toLocaleString('en-US')}</span> جنيه
          </p>
        </div>
        {paid && <Badge tone="success">تم الدفع</Badge>}
      </div>

      <div className="mb-5 grid gap-3 md:grid-cols-2">
        <MethodCard
          active={method === 'fawry'}
          onClick={() => setMethod('fawry')}
          icon={<Smartphone size={20} strokeWidth={1.75} />}
          title="فوري"
          subtitle="رمز سداد ساري لمدة 24 ساعة"
        />
        <MethodCard
          active={method === 'card'}
          onClick={() => setMethod('card')}
          icon={<CreditCard size={20} strokeWidth={1.75} />}
          title="بطاقة ائتمانية"
          subtitle="توجيه فوري إلى بوابة الدفع"
        />
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

      <Modal open={showReceipt} onClose={() => setShowReceipt(false)} title="إيصال الدفع" size="md">
        <Modal.Body>
          <PrintLayout
            title="إيصال سداد رسوم التقديم"
            reportId={refNumber ?? ''}
            generatedAt={new Date().toLocaleString('ar-EG')}
          >
            <table className="w-full text-sm">
              <tbody>
                <tr><td className="py-1 text-ink-500">رقم المتقدم</td><td className="py-1 font-mono" dir="ltr">{APPLICANT_ID}</td></tr>
                <tr><td className="py-1 text-ink-500">طريقة الدفع</td><td className="py-1">{method === 'fawry' ? 'فوري' : 'بطاقة ائتمانية'}</td></tr>
                <tr><td className="py-1 text-ink-500">رقم المرجع</td><td className="py-1 font-mono" dir="ltr">{refNumber}</td></tr>
                <tr><td className="py-1 text-ink-500">المبلغ</td><td className="py-1 font-numeric tnum">{FEE.toLocaleString('en-US')} جنيه</td></tr>
              </tbody>
            </table>
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

function MethodCard({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'flex items-start gap-3 rounded-lg border p-4 text-start transition-colors duration-fast ease-standard ' +
        (active
          ? 'border-teal-500 bg-teal-50 shadow-focus-teal'
          : 'border-border-default hover:bg-ink-50')
      }
    >
      <span
        className={
          'inline-flex h-10 w-10 items-center justify-center rounded-md ' +
          (active ? 'bg-teal-500 text-white' : 'bg-ink-100 text-ink-700')
        }
      >
        {icon}
      </span>
      <div>
        <p className="text-sm font-medium text-ink-900">{title}</p>
        <p className="mt-0.5 text-2xs text-ink-500">{subtitle}</p>
      </div>
    </button>
  );
}
