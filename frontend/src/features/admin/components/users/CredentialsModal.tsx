/**
 * CredentialsModal — one-time reveal of an account's MOI sign-in credentials.
 *
 * Shown right after a user is created or their password is reset. The plaintext
 * password is returned by the backend only once and is never retrievable again,
 * so this dialog makes it copyable and warns the admin to deliver it securely.
 */

import { useState } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';
import { Button, Modal, toast } from '@/shared/components';

interface CredentialsModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  username: string;
  password: string;
  /** When set, the primary footer button navigates onward instead of closing. */
  onDone?: () => void;
  doneLabel?: string;
}

export function CredentialsModal({
  open,
  onClose,
  title,
  username,
  password,
  onDone,
  doneLabel,
}: CredentialsModalProps): JSX.Element {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm" closeOnBackdrop={false}>
      <Modal.Body>
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-md border border-dashed border-gold-300 bg-gold-50 px-4 py-3 text-2xs leading-relaxed text-gold-700">
            <KeyRound size={16} className="mt-0.5 flex-shrink-0" />
            <p>
              هذه هي بيانات الدخول لمرة واحدة. لن تظهر كلمة المرور مرة أخرى — انسخها
              وسلّمها للمستخدم عبر قناة آمنة. يُنصح بتغييرها عند أول تسجيل دخول.
            </p>
          </div>

          <CredentialRow label="اسم المستخدم" value={username} />
          <CredentialRow label="كلمة المرور المؤقتة" value={password} mono />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" onClick={onDone ?? onClose}>
          {doneLabel ?? 'تم'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

function CredentialRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}): JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast('تم النسخ', 'success');
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast('تعذّر النسخ', 'danger');
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink-700">{label}</span>
      <div className="flex items-center gap-2">
        <code
          dir="ltr"
          className={`flex-1 rounded-md border border-ink-200 bg-ink-50 px-3 py-2 text-sm text-ink-900 ${mono ? 'font-mono tracking-wide' : ''}`}
        >
          {value}
        </code>
        <Button variant="ghost" size="sm" onClick={handleCopy} aria-label={`نسخ ${label}`}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </Button>
      </div>
    </div>
  );
}
