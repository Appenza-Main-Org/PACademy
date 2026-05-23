/**
 * NidLookupField — controlled NID input + lookup button + inline state.
 *
 * Usage:
 *   <NidLookupField
 *     value={nid}
 *     onChange={setNid}
 *     onLookupResult={(data) => fillForm(data)}
 *   />
 *
 * State machine (driven by `useNidLookup`):
 *   idle      — input + button.
 *   pending   — spinner + "جاري التحقق…".
 *   invalid   — terra-500 helper "الرقم القومى غير صحيح".
 *   not_found — terra-500 helper + retry affordance.
 *   found     — calls `onLookupResult(data)` so parent auto-fills.
 *
 * The "format" vs "checksum" distinction is collapsed into a single
 * user-facing message for security (don't reveal which branch failed);
 * the underlying reason is logged to the dev console.
 */

import { useEffect, useId } from 'react';
import { Search } from 'lucide-react';
import { Button, Input } from '@/shared/components';
import { cn } from '@/shared/lib/cn';
import { useNidLookup } from '../../hooks/useNidLookup';
import type { OfficerCandidate } from '../../api/nid-lookup.service';

interface NidLookupFieldProps {
  value: string;
  onChange: (next: string) => void;
  onLookupResult: (result: OfficerCandidate | null) => void;
  onNotFound?: (nationalId: string) => void;
  disabled?: boolean;
  /** Inline error from parent form-validation (e.g. zod required check). */
  externalError?: string;
  className?: string;
}

const HELPER_INVALID = 'الرقم القومى غير صحيح';
const HELPER_NOT_FOUND = 'لم يتم العثور على بيانات لهذا الرقم القومى';

export function NidLookupField({
  value,
  onChange,
  onLookupResult,
  onNotFound,
  disabled,
  externalError,
  className,
}: NidLookupFieldProps): JSX.Element {
  const lookup = useNidLookup();
  const liveRegionId = useId();

  /* When the user edits the NID after a successful lookup, reset the
   * mutation state and clear any auto-filled form fields in the parent. */
  useEffect(() => {
    const trimmed = value.trim();
    const lookedUpNationalId = lookup.data?.status === 'found'
      ? lookup.data.data.nationalId
      : lookup.data?.status === 'not_found'
        ? lookup.data.nationalId
        : null;
    if (lookedUpNationalId && lookedUpNationalId !== trimmed) {
      lookup.reset();
      onLookupResult(null);
    }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [value]);

  const handleLookup = (): void => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (lookup.isPending) return;
    lookup.mutateAsync(trimmed).then(
      (result) => {
        if (result.status === 'found') {
          onLookupResult(result.data);
        } else if (result.status === 'not_found') {
          onLookupResult(null);
          onNotFound?.(result.nationalId);
        } else {
          onLookupResult(null);
          if (result.status === 'invalid' && import.meta.env?.DEV) {
            // eslint-disable-next-line no-console
            console.debug('[NidLookup] invalid →', result.reason);
          }
        }
      },
      () => {
        onLookupResult(null);
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLookup();
    }
  };

  /* Resolve the visible state. `externalError` (from zod) trumps the
   * mutation result so a "required" error never gets masked by stale
   * lookup data. */
  const result = lookup.data;
  let helper: string | undefined;
  let helperTone: 'error' | 'success' | 'info' = 'info';
  let liveMessage = '';

  if (externalError) {
    helper = externalError;
    helperTone = 'error';
    liveMessage = externalError;
  } else if (lookup.isPending) {
    helper = 'جارٍ التحقق…';
    helperTone = 'info';
    liveMessage = 'جارٍ التحقق من الرقم القومى';
  } else if (lookup.error) {
    helper = 'حدث خطأ أثناء التحقق. حاول مرة أخرى.';
    helperTone = 'error';
    liveMessage = helper;
  } else if (result?.status === 'invalid') {
    helper = HELPER_INVALID;
    helperTone = 'error';
    liveMessage = HELPER_INVALID;
  } else if (result?.status === 'not_found') {
    helper = HELPER_NOT_FOUND;
    helperTone = 'error';
    liveMessage = HELPER_NOT_FOUND;
  } else if (result?.status === 'found') {
    helper = 'تم التحقق بنجاح';
    helperTone = 'success';
    liveMessage = 'تم العثور على بيانات الشخص';
  }

  const showRetry = result?.status === 'not_found';
  const showError = helperTone === 'error';
  const showSuccess = helperTone === 'success';

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-end gap-2">
        <Input
          label="الرقم القومى"
          required
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 14))}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          inputMode="numeric"
          autoComplete="off"
          maxLength={14}
          placeholder="14 رقماً"
          dir="ltr"
          aria-describedby={liveRegionId}
          containerClassName="flex-1"
          /* Inline error styling is driven by NidLookupField wrapper, not
           * the Input's own error prop, so the success/info tones aren't
           * blocked by Input's binary error/helper styles. */
          error={showError ? helper : undefined}
          helper={showError ? undefined : helper && !showSuccess ? helper : undefined}
        />
        <Button
          type="button"
          variant="primary"
          size="md"
          leadingIcon={<Search size={14} strokeWidth={1.75} />}
          isLoading={lookup.isPending}
          loadingLabel="جارٍ…"
          disabled={disabled || value.trim().length === 0 || lookup.isPending}
          onClick={handleLookup}
        >
          بحث
        </Button>
      </div>
      {showSuccess && (
        <p className="text-xs font-medium text-teal-700">{helper}</p>
      )}
      {showRetry && (
        <button
          type="button"
          className="self-start text-2xs font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800"
          onClick={() => {
            lookup.reset();
            onLookupResult(null);
          }}
        >
          حاول مرة أخرى
        </button>
      )}
      {/* Polite live region for assistive tech — state changes spoken
          without stealing focus from the input. */}
      <span id={liveRegionId} aria-live="polite" className="sr-only">
        {liveMessage}
      </span>
    </div>
  );
}
