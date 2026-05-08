import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, X } from 'lucide-react';
import { useStrings } from '@/shared/lib/strings';
import { sessionExpiredBus } from '@/shared/api/client';
import { ROUTES } from '@/config/routes';

/** Shown when the apiClient 401 interceptor fires (session revoked server-side). */
export function SessionExpiredBanner(): JSX.Element | null {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();
  const s = useStrings().sessionExpired;

  useEffect(() => {
    return sessionExpiredBus.subscribe(() => setVisible(true));
  }, []);

  if (!visible) return null;

  const handleLogin = (): void => {
    setVisible(false);
    navigate(ROUTES.staffLogin, { replace: true });
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-4 start-1/2 z-[9999] w-full max-w-sm -translate-x-1/2 rounded-lg border border-terra-200 bg-terra-50 px-4 py-3 shadow-lg"
      dir="rtl"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold text-terra-900">{s.title}</p>
          <p className="mt-0.5 text-xs text-terra-700">{s.description}</p>
        </div>
        <button
          aria-label="إغلاق"
          onClick={() => setVisible(false)}
          className="rounded p-0.5 text-terra-500 hover:bg-terra-100"
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>
      <button
        onClick={handleLogin}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-terra-700 hover:underline"
      >
        <LogIn size={12} />
        {s.login}
      </button>
    </div>
  );
}
