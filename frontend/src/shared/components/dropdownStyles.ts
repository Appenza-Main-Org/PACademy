import { cn } from '@/shared/lib/cn';

interface DropdownTriggerClassNameOptions {
  invalid?: boolean;
  multiline?: boolean;
  className?: string;
}

interface DropdownOptionClassNameOptions {
  active?: boolean;
  selected?: boolean;
  disabled?: boolean;
  className?: string;
}

export function dropdownTriggerClassName({
  invalid,
  multiline,
  className,
}: DropdownTriggerClassNameOptions = {}): string {
  return cn(
    'group relative inline-flex w-full items-center rounded-md border border-solid',
    'bg-surface-card text-start text-sm text-ink-900 font-ar',
    'transition-colors duration-fast ease-standard',
    multiline ? 'min-h-9 ps-3 pe-9 py-1.5' : 'h-9 ps-3 pe-9',
    invalid
      ? 'border-terra-500 focus-visible:border-terra-500 focus-visible:shadow-focus-terra data-[state=open]:border-terra-500 data-[state=open]:shadow-focus-terra'
      : 'border-border-default hover:border-border-strong focus-visible:border-teal-500 focus-visible:shadow-focus-teal data-[state=open]:border-teal-500 data-[state=open]:shadow-focus-teal',
    'focus-visible:outline-none',
    'disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400 disabled:hover:border-border-default',
    className,
  );
}

export function dropdownChevronClassName(className?: string): string {
  return cn(
    'pointer-events-none absolute end-3 inset-y-0 my-auto h-4 w-4 text-ink-400',
    'transition-transform duration-fast ease-standard',
    'group-data-[state=open]:rotate-180',
    'motion-reduce:transition-none',
    className,
  );
}

export function dropdownContentClassName(className?: string): string {
  return cn(
    'rounded-lg border border-border-subtle bg-surface-elevated shadow-md',
    'flex flex-col overflow-hidden outline-none font-ar',
    className,
  );
}

export function dropdownSearchInputClassName(className?: string): string {
  return cn(
    'h-9 w-full rounded-md border border-border-default bg-surface-card ps-9 pe-3 text-sm font-ar',
    'focus-visible:border-teal-500 focus-visible:shadow-focus-teal focus-visible:outline-none',
    className,
  );
}

export function dropdownOptionClassName({
  active,
  selected,
  disabled,
  className,
}: DropdownOptionClassNameOptions = {}): string {
  return cn(
    'flex min-h-9 cursor-pointer select-none items-center gap-2 rounded-md px-3 py-1.5 text-sm',
    'transition-colors duration-fast ease-standard',
    active && 'bg-[var(--accent-50)]',
    selected ? 'font-medium text-ink-900' : 'text-ink-700',
    disabled && 'cursor-not-allowed opacity-50',
    className,
  );
}

export function dropdownChipClassName(className?: string): string {
  return cn(
    'inline-flex items-center gap-1 rounded-md bg-[var(--accent-50)] px-2.5 py-1 text-xs font-medium text-[var(--accent-700)]',
    className,
  );
}
