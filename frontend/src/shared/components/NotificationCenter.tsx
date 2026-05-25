/**
 * NotificationCenter — bell icon → drawer with notifications list.
 * Source: Tasks/KARASA_GAPS.md §10.4.B.
 *
 * Behaviour:
 *  - Opening the drawer doesn't auto-mark all as read; clicking an
 *    individual notification marks it read and decrements the bell badge.
 *  - The "وضع كل العناصر كمقروءة" button mass-marks remaining unread.
 *  - State is held in a Zustand store seeded once from MOCK so that
 *    marking a notification read survives route changes (the
 *    `<NotificationCenter />` instance is remounted by each AppShell).
 *  - Notifications with an `href` navigate on click.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, RefreshCw } from 'lucide-react';
import { create } from 'zustand';
import { Drawer } from './Drawer';
import { Button } from './Button';
import { Badge } from './Badge';
import { toast } from './Toast';
import { MOCK } from '@/shared/mock-data';
import type { NotificationItem } from '@/shared/types/domain';
import { date as fmtDate } from '@/shared/lib/format';

interface NotificationsStoreState {
  items: NotificationItem[];
  sync: (items: readonly NotificationItem[]) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const useNotificationsStore = create<NotificationsStoreState>((set) => ({
  items: [],
  sync: (items) =>
    set((state) => {
      const readIds = new Set(state.items.filter((n) => n.read).map((n) => n.id));
      return {
        items: items.map((item) => ({
          ...item,
          read: item.read || readIds.has(item.id),
        })),
      };
    }),
  markRead: (id) =>
    set((state) => ({
      items: state.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
    })),
  markAllRead: () =>
    set((state) => ({ items: state.items.map((n) => ({ ...n, read: true })) })),
}));

interface NotificationCenterProps {
  items?: readonly NotificationItem[];
  isLoading?: boolean;
  isError?: boolean;
}

export function NotificationCenter({
  items: sourceItems,
  isLoading = false,
  isError = false,
}: NotificationCenterProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const items = useNotificationsStore((s) => s.items);
  const sync = useNotificationsStore((s) => s.sync);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);

  useEffect(() => {
    sync(sourceItems ?? MOCK.notifications);
  }, [sourceItems, sync]);

  const unread = items.filter((n) => !n.read).length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="الإشعارات"
        className="relative inline-flex h-9 items-center justify-center gap-2 rounded-md border border-transparent px-2 text-sm font-medium text-ink-700 transition-colors duration-fast ease-standard hover:border-border-subtle hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none lg:px-3"
      >
        <Bell size={18} strokeWidth={1.75} />
        <span className="hidden lg:inline">الإشعارات</span>
        {unread > 0 && (
          <span
            aria-hidden
            className="absolute top-1 inset-inline-end-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-terra-500 px-1 text-2xs font-bold text-white"
          >
            {unread}
          </span>
        )}
      </button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="مركز الإشعارات"
        subtitle={isLoading ? 'جارٍ تحميل الإشعارات' : `${unread} إشعار غير مقروء من ${items.length}`}
        size="sm"
        transparentBackdrop
      >
        <Drawer.Body className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
          {isError && (
            <div className="rounded-md border border-gold-300 bg-gold-50 px-3 py-2 text-xs text-gold-700">
              تعذر تحميل آخر الإشعارات من الخادم. تُعرض آخر قائمة متاحة لحين إعادة المحاولة.
            </div>
          )}
          <div className="flex shrink-0 items-center justify-between">
            <span className="inline-flex items-center gap-1 text-2xs text-ink-500">
              {isLoading && <RefreshCw size={11} strokeWidth={1.75} className="animate-spin" />}
              {items.length} إشعار
            </span>
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<Check size={12} strokeWidth={1.75} />}
              onClick={() => {
                if (unread === 0) {
                  toast('كل الإشعارات مقروءة بالفعل', 'info');
                  return;
                }
                markAllRead();
                toast(`تم وضع ${unread} إشعار كمقروء`, 'success');
              }}
            >
              وضع كل العناصر كمقروءة
            </Button>
          </div>
          <ul
            className="-me-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pe-2"
            style={{ scrollbarGutter: 'stable', overscrollBehavior: 'contain' }}
          >
            {items.map((n) => (
              <NotificationRow
                key={n.id}
                item={n}
                onRead={() => markRead(n.id)}
                onNavigate={() => setOpen(false)}
              />
            ))}
          </ul>
        </Drawer.Body>
      </Drawer>
    </>
  );
}

interface RowProps {
  item: NotificationItem;
  onRead: () => void;
  onNavigate: () => void;
}

function NotificationRow({ item, onRead, onNavigate }: RowProps): JSX.Element {
  const baseClass =
    'flex w-full flex-col gap-1 rounded-md border px-3 py-2 text-start transition-colors duration-fast ease-standard hover:bg-ink-50 focus-visible:shadow-focus-teal focus-visible:outline-none ' +
    (item.read ? 'border-border-subtle bg-surface-card' : 'border-teal-300 bg-teal-50');

  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink-900">{item.title}</p>
        {!item.read && <Badge tone="info" dot>جديد</Badge>}
      </div>
      <p className="text-xs text-ink-700">{item.body}</p>
      <p className="text-2xs text-ink-500">{fmtDate(item.ts, 'rel')}</p>
    </>
  );

  if (item.href) {
    return (
      <li>
        <Link
          to={item.href}
          className={baseClass}
          onClick={() => {
            onRead();
            onNavigate();
          }}
        >
          {inner}
        </Link>
      </li>
    );
  }

  return (
    <li>
      <button type="button" onClick={onRead} className={baseClass}>
        {inner}
      </button>
    </li>
  );
}
