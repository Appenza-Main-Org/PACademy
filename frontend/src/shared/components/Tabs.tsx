/**
 * Tabs — horizontal tablist with bottom-edge active indicator.
 *
 * Built on `@radix-ui/react-tabs`. For `/admin/reference-data` (8 sub-tabs),
 * case-file detail panes, and any other "switch the visible panel" surface.
 *
 * Behaviour
 * ---------
 *  • arrow keys move focus through tabs (Radix Tabs default)
 *  • activation is automatic on focus (`activationMode="automatic"`)
 *  • Home/End jump to first/last
 *  • RTL-safe — Radix flips the arrow-key axis when `dir="rtl"`
 *  • controlled (`value` / `onValueChange`) or uncontrolled (`defaultValue`)
 *
 * Visual
 * ------
 *  • tablist: bottom border subtle; tabs sit on the line
 *  • inactive tab: text-ink-500
 *  • hover tab: text-ink-700, soft ink-50 wash
 *  • active tab: text-ink-900 + 2px bottom border in `var(--brand-primary)`
 *    (the bottom edge is the active indicator per the brief)
 *  • focus-visible: shadow-[var(--ring)]
 *
 * Composition
 * -----------
 *   <Tabs defaultValue="categories">
 *     <Tabs.List>
 *       <Tabs.Tab value="categories">الفئات</Tabs.Tab>
 *       <Tabs.Tab value="cycles">الدورات</Tabs.Tab>
 *     </Tabs.List>
 *     <Tabs.Panel value="categories">...</Tabs.Panel>
 *     <Tabs.Panel value="cycles">...</Tabs.Panel>
 *   </Tabs>
 */

import * as RadixTabs from '@radix-ui/react-tabs';
import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef, ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

interface TabsRootProps {
  children: ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (next: string) => void;
  /** `automatic` (default) selects on focus; `manual` requires Enter/Space. */
  activationMode?: 'automatic' | 'manual';
  className?: string;
}

function TabsRoot({
  children,
  value,
  defaultValue,
  onValueChange,
  activationMode = 'automatic',
  className,
}: TabsRootProps): JSX.Element {
  return (
    <RadixTabs.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      activationMode={activationMode}
      dir="rtl"
      className={cn('flex flex-col gap-4', className)}
    >
      {children}
    </RadixTabs.Root>
  );
}

const TabsList = forwardRef<
  ElementRef<typeof RadixTabs.List>,
  ComponentPropsWithoutRef<typeof RadixTabs.List>
>(({ className, ...rest }, ref) => (
  <RadixTabs.List
    ref={ref}
    className={cn(
      'flex flex-wrap items-end gap-1 border-b border-border-subtle',
      'overflow-x-auto',
      className,
    )}
    {...rest}
  />
));
TabsList.displayName = 'Tabs.List';

interface TabsTabProps extends ComponentPropsWithoutRef<typeof RadixTabs.Trigger> {
  children: ReactNode;
  /** Optional badge (e.g. count) rendered at the end-edge. */
  badge?: ReactNode;
}

const TabsTab = forwardRef<ElementRef<typeof RadixTabs.Trigger>, TabsTabProps>(
  ({ children, badge, className, ...rest }, ref) => (
    <RadixTabs.Trigger
      ref={ref}
      className={cn(
        'inline-flex items-center gap-2 px-4 pb-3 pt-2 text-sm font-medium',
        'border-b-2 border-transparent -mb-px',
        'transition-colors duration-fast ease-standard',
        'text-ink-500 hover:text-ink-700 hover:bg-ink-50/60',
        'data-[state=active]:text-ink-900 data-[state=active]:border-[var(--brand-primary)]',
        'focus-visible:shadow-[var(--ring)] focus-visible:outline-none focus-visible:rounded-sm',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'whitespace-nowrap font-ar',
        className,
      )}
      {...rest}
    >
      <span>{children}</span>
      {badge && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-ink-100 px-1.5 text-2xs text-ink-700">
          {badge}
        </span>
      )}
    </RadixTabs.Trigger>
  ),
);
TabsTab.displayName = 'Tabs.Tab';

const TabsPanel = forwardRef<
  ElementRef<typeof RadixTabs.Content>,
  ComponentPropsWithoutRef<typeof RadixTabs.Content>
>(({ className, ...rest }, ref) => (
  <RadixTabs.Content
    ref={ref}
    className={cn('focus-visible:outline-none', className)}
    {...rest}
  />
));
TabsPanel.displayName = 'Tabs.Panel';

interface TabsComponent {
  (props: TabsRootProps): JSX.Element;
  List: typeof TabsList;
  Tab: typeof TabsTab;
  Panel: typeof TabsPanel;
}

const Tabs = TabsRoot as TabsComponent;
Tabs.List = TabsList;
Tabs.Tab = TabsTab;
Tabs.Panel = TabsPanel;

export { Tabs };
