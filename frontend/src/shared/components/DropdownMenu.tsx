/**
 * DropdownMenu — anchored menu of items.
 *
 * Built on `@radix-ui/react-dropdown-menu`. For the user menu in the AppShell
 * header, DataTable per-row actions, and any "kebab → list of choices"
 * affordance. Use `Popover` instead when the surface contains a form or
 * non-menu content; `DropdownMenu` carries the WAI-ARIA menu role with
 * arrow-key navigation, type-ahead, and roving tabindex.
 *
 * Behaviour
 * ---------
 *  • arrow keys move focus through items
 *  • type-ahead jumps to items whose label starts with the typed letter(s)
 *  • Esc closes; outside-click closes
 *  • RTL-safe (Radix Popper)
 *
 * Variants
 * --------
 *  • `Item.disabled`   — non-interactive grey
 *  • `Item.destructive` — terracotta tone for delete-type actions
 *  • `Item.shortcut`   — right-aligned (logical end) muted shortcut hint
 *
 * Composition
 * -----------
 *   <DropdownMenu>
 *     <DropdownMenu.Trigger asChild>
 *       <Button variant="ghost" size="icon" aria-label="إجراءات"><MoreHorizontal/></Button>
 *     </DropdownMenu.Trigger>
 *     <DropdownMenu.Content>
 *       <DropdownMenu.Item onSelect={openEdit}>تعديل</DropdownMenu.Item>
 *       <DropdownMenu.Separator/>
 *       <DropdownMenu.Item destructive onSelect={openDelete}>حذف</DropdownMenu.Item>
 *     </DropdownMenu.Content>
 *   </DropdownMenu>
 */

import * as RadixMenu from '@radix-ui/react-dropdown-menu';
import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, ElementRef, ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

interface MenuRootProps {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
  defaultOpen?: boolean;
  modal?: boolean;
  dir?: 'ltr' | 'rtl';
}

function MenuRoot({ children, dir = 'rtl', ...rest }: MenuRootProps): JSX.Element {
  return <RadixMenu.Root dir={dir} {...rest}>{children}</RadixMenu.Root>;
}

const MenuTrigger = RadixMenu.Trigger;

type MenuContentProps = ComponentPropsWithoutRef<typeof RadixMenu.Content>;

const MenuContent = forwardRef<ElementRef<typeof RadixMenu.Content>, MenuContentProps>(
  ({ className, align = 'end', sideOffset = 6, ...rest }, ref) => (
    <RadixMenu.Portal>
      <RadixMenu.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-dropdown min-w-44 max-w-72',
          'rounded-lg border border-border-subtle bg-surface-elevated shadow-md',
          'p-1 outline-none font-ar',
          className,
        )}
        style={{ animation: 'pageEnter var(--duration-fast) var(--ease-standard)' }}
        {...rest}
      />
    </RadixMenu.Portal>
  ),
);
MenuContent.displayName = 'DropdownMenu.Content';

interface MenuItemProps extends Omit<ComponentPropsWithoutRef<typeof RadixMenu.Item>, 'children'> {
  children: ReactNode;
  /** Render the item with destructive (terracotta) tone. */
  destructive?: boolean;
  /** Optional leading icon (16px). */
  leadingIcon?: ReactNode;
  /** Optional trailing keyboard shortcut hint. */
  shortcut?: ReactNode;
}

const MenuItem = forwardRef<ElementRef<typeof RadixMenu.Item>, MenuItemProps>(
  ({ children, destructive, leadingIcon, shortcut, className, disabled, ...rest }, ref) => (
    <RadixMenu.Item
      ref={ref}
      disabled={disabled}
      className={cn(
        'group flex select-none items-center gap-2 rounded-md px-3 py-2 text-sm outline-none cursor-pointer',
        'transition-colors duration-fast ease-standard',
        destructive
          ? 'text-terra-600 data-[highlighted]:bg-terra-50 data-[highlighted]:text-terra-700'
          : 'text-ink-700 data-[highlighted]:bg-ink-50 data-[highlighted]:text-ink-900',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[disabled]:pointer-events-none',
        className,
      )}
      {...rest}
    >
      {leadingIcon && <span className="flex h-4 w-4 items-center justify-center">{leadingIcon}</span>}
      <span className="flex-1 min-w-0 truncate">{children}</span>
      {shortcut && <span className="ms-auto text-2xs text-ink-400 font-mono">{shortcut}</span>}
    </RadixMenu.Item>
  ),
);
MenuItem.displayName = 'DropdownMenu.Item';

const MenuSeparator = forwardRef<
  ElementRef<typeof RadixMenu.Separator>,
  ComponentPropsWithoutRef<typeof RadixMenu.Separator>
>(({ className, ...rest }, ref) => (
  <RadixMenu.Separator
    ref={ref}
    className={cn('my-1 h-px bg-border-subtle', className)}
    {...rest}
  />
));
MenuSeparator.displayName = 'DropdownMenu.Separator';

interface MenuLabelProps extends ComponentPropsWithoutRef<typeof RadixMenu.Label> {
  children: ReactNode;
}

const MenuLabel = forwardRef<ElementRef<typeof RadixMenu.Label>, MenuLabelProps>(
  ({ className, children, ...rest }, ref) => (
    <RadixMenu.Label
      ref={ref}
      className={cn('px-3 py-1.5 text-2xs font-medium uppercase tracking-wide text-ink-400', className)}
      {...rest}
    >
      {children}
    </RadixMenu.Label>
  ),
);
MenuLabel.displayName = 'DropdownMenu.Label';

interface MenuComponent {
  (props: MenuRootProps): JSX.Element;
  Trigger: typeof MenuTrigger;
  Content: typeof MenuContent;
  Item: typeof MenuItem;
  Separator: typeof MenuSeparator;
  Label: typeof MenuLabel;
}

const DropdownMenu = MenuRoot as MenuComponent;
DropdownMenu.Trigger = MenuTrigger;
DropdownMenu.Content = MenuContent;
DropdownMenu.Item = MenuItem;
DropdownMenu.Separator = MenuSeparator;
DropdownMenu.Label = MenuLabel;

export { DropdownMenu };
