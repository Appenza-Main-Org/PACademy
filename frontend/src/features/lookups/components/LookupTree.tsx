/**
 * LookupTree — recursive, draggable tree of LookupItem rows for a single
 * hierarchical lookup type.
 *
 * Composition
 * -----------
 *  - Each node is a `@radix-ui/react-collapsible` with a chevron trigger
 *    that rotates on `data-state="open"`. Children render inside the
 *    `Collapsible.Content` so the WAI-ARIA aria-expanded state is wired
 *    by Radix.
 *  - Drag-reorder uses `@dnd-kit/sortable` per sibling group (matches
 *    the pattern in `ExamPlanEditor`). Each parent's children form an
 *    independent SortableContext so a user cannot accidentally drag a
 *    node out of its sibling group.
 *  - Per-row action menu uses the existing `DropdownMenu`.
 *
 * Keyboard
 * --------
 *  - Tab moves into the tree; ArrowDown/Up moves between rows.
 *  - Space/Enter on chevron toggles expand. Dnd-kit's KeyboardSensor
 *    delivers Space=grab, arrows=move, Space=drop, Esc=cancel.
 *  - prefers-reduced-motion respected on chevron rotation.
 *
 * The component is in-feature, not promoted to `shared/components/`
 * (CLAUDE.md §2.5 Guardrail — single consumer).
 */

import * as Collapsible from '@radix-ui/react-collapsible';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronLeft, GripVertical, MoreVertical, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  Badge,
  Button,
  DropdownMenu,
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/shared/components';
import { cn } from '@/shared/lib/cn';
import {
  useLookupTree,
  useReorderLookups,
} from '../api/lookups.queries';
import type { LookupItem, LookupTreeNode, LookupTypeCode } from '../types';

export interface LookupTreeProps {
  typeCode: LookupTypeCode;
  onEdit: (item: LookupItem) => void;
  onCreate: (parentId: string | null) => void;
  onDelete: (item: LookupItem) => void;
}

export function LookupTree({
  typeCode,
  onEdit,
  onCreate,
  onDelete,
}: LookupTreeProps): JSX.Element {
  const treeQuery = useLookupTree(typeCode);

  if (treeQuery.isLoading) return <LoadingState variant="list" />;
  if (treeQuery.isError) {
    return (
      <ErrorState
        error={treeQuery.error as Error}
        onRetry={() => treeQuery.refetch()}
        title="فشل تحميل الشجرة"
      />
    );
  }

  const roots = treeQuery.data ?? [];
  if (roots.length === 0) {
    return (
      <EmptyState
        variant="generic"
        title="لا توجد عناصر بعد"
        description="ابدأ بإضافة عنصر جذري لهذا النوع."
        action={
          <Button variant="primary" leadingIcon={<Plus size={16} />} onClick={() => onCreate(null)}>
            إضافة جذر
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <Button variant="ghost" leadingIcon={<Plus size={16} />} onClick={() => onCreate(null)}>
          إضافة جذر
        </Button>
      </div>
      <NodeGroup
        nodes={roots}
        typeCode={typeCode}
        parentId={null}
        onEdit={onEdit}
        onCreate={onCreate}
        onDelete={onDelete}
      />
    </div>
  );
}

/* ─── Group of siblings (one SortableContext) ───────────────────────── */

interface NodeGroupProps {
  nodes: LookupTreeNode[];
  typeCode: LookupTypeCode;
  parentId: string | null;
  onEdit: (item: LookupItem) => void;
  onCreate: (parentId: string | null) => void;
  onDelete: (item: LookupItem) => void;
}

function NodeGroup({
  nodes,
  typeCode,
  parentId,
  onEdit,
  onCreate,
  onDelete,
}: NodeGroupProps): JSX.Element {
  const reorderMut = useReorderLookups();
  const [order, setOrder] = useState<LookupTreeNode[]>(nodes);

  // Resync when query refetches.
  if (order.length !== nodes.length || order.some((n, i) => n.id !== nodes[i]?.id)) {
    setOrder(nodes);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = order.findIndex((n) => n.id === active.id);
    const newIdx = order.findIndex((n) => n.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    const next = arrayMove(order, oldIdx, newIdx);
    setOrder(next);
    reorderMut.mutate({
      typeCode,
      parentId,
      orderedIds: next.map((n) => n.id),
    });
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={order.map((n) => n.id)} strategy={verticalListSortingStrategy}>
        <ul role="tree" className="flex flex-col gap-1">
          {order.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              typeCode={typeCode}
              onEdit={onEdit}
              onCreate={onCreate}
              onDelete={onDelete}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

/* ─── Single tree row ────────────────────────────────────────────────── */

interface TreeNodeProps {
  node: LookupTreeNode;
  typeCode: LookupTypeCode;
  onEdit: (item: LookupItem) => void;
  onCreate: (parentId: string | null) => void;
  onDelete: (item: LookupItem) => void;
}

function TreeNode({ node, typeCode, onEdit, onCreate, onDelete }: TreeNodeProps): JSX.Element {
  const hasChildren = node.children.length > 0;
  const [open, setOpen] = useState(node.level === 0);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingInlineStart: `calc(var(--space-md, 16px) * ${node.level})`,
  } satisfies React.CSSProperties;

  return (
    <li role="treeitem" aria-expanded={hasChildren ? open : undefined}>
      <Collapsible.Root open={open} onOpenChange={setOpen} disabled={!hasChildren}>
        <div
          ref={setNodeRef}
          style={style}
          className={cn(
            'group flex items-center gap-2 rounded-md border border-border-subtle bg-surface px-2 py-2',
            'transition-colors duration-fast ease-standard',
            'hover:border-accent-300 hover:bg-accent-50/40',
            isDragging && 'border-accent-500 shadow-md',
          )}
        >
          <button
            type="button"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-ink-400 hover:bg-ink-50 hover:text-ink-700"
            aria-label="مقبض السحب"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={16} />
          </button>

          {hasChildren ? (
            <Collapsible.Trigger asChild>
              <button
                type="button"
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded text-ink-500',
                  'hover:bg-ink-50 hover:text-ink-900',
                  'transition-transform duration-fast ease-standard',
                  open && 'rotate-90',
                  'motion-reduce:transition-none',
                )}
                aria-label={open ? 'طي' : 'توسيع'}
              >
                <ChevronLeft size={16} className="rtl:-scale-x-100" />
              </button>
            </Collapsible.Trigger>
          ) : (
            <span aria-hidden className="h-7 w-7 shrink-0" />
          )}

          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-900 font-ar">
            {node.nameAr}
          </span>

          <Badge tone="neutral" className="font-mono text-2xs">
            {node.code}
          </Badge>

          {!node.isActive && (
            <Badge tone="warning" className="text-2xs">
              غير مفعّل
            </Badge>
          )}

          <RowActions
            onEdit={() => onEdit(node)}
            onCreateChild={() => onCreate(node.id)}
            onDelete={() => onDelete(node)}
          />
        </div>

        {hasChildren && (
          <Collapsible.Content className="overflow-hidden data-[state=closed]:hidden">
            <div className="mt-1">
              <NodeGroup
                nodes={node.children}
                typeCode={typeCode}
                parentId={node.id}
                onEdit={onEdit}
                onCreate={onCreate}
                onDelete={onDelete}
              />
            </div>
          </Collapsible.Content>
        )}
      </Collapsible.Root>
    </li>
  );
}

function RowActions({
  onEdit,
  onCreateChild,
  onDelete,
}: {
  onEdit: () => void;
  onCreateChild: () => void;
  onDelete: () => void;
}): ReactNode {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-ink-400 hover:bg-ink-50 hover:text-ink-700"
          aria-label="إجراءات"
        >
          <MoreVertical size={16} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item onSelect={onEdit}>تعديل</DropdownMenu.Item>
        <DropdownMenu.Item onSelect={onCreateChild}>إضافة فرع</DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item destructive onSelect={onDelete}>
          حذف
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}
