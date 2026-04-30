import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  help?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, help, error, className, id, ...rest }, ref) => {
    const inputId = id ?? `field-${rest.name ?? Math.random().toString(36).slice(2, 7)}`;
    return (
      <div className="field">
        {label && (
          <label htmlFor={inputId} className="field-label">
            {label}
          </label>
        )}
        <input ref={ref} id={inputId} className={cn('input', className)} {...rest} />
        {error ? (
          <span className="field-error">{error}</span>
        ) : help ? (
          <span className="field-help">{help}</span>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';
