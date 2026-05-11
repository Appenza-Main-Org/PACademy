/**
 * LookupsHubPage — `/admin/lookups[/:typeCode]`.
 *
 * Left rail lists the 31 lookup types grouped into hierarchical and
 * flat sections. Right panel renders LookupTree when the selected type
 * is hierarchical, LookupGrid otherwise. LookupFormDrawer is mounted
 * for create/edit; LookupGrid owns the soft-delete confirmation modal.
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Layers, List, Network } from 'lucide-react';
import { Badge, Button, PageHeader } from '@/shared/components';
import { cn } from '@/shared/lib/cn';
import { ROUTES } from '@/config/routes';
import { LookupGrid } from '../components/LookupGrid';
import { LookupTree } from '../components/LookupTree';
import { LookupFormDrawer } from '../components/LookupFormDrawer';
import { useLookupTypes } from '../api/lookups.queries';
import { useDeleteLookup } from '../api/lookups.queries';
import {
  HIERARCHICAL_TYPES,
  LOOKUP_TYPE_CODES,
  type LookupItem,
  type LookupType,
  type LookupTypeCode,
} from '../types';

function isTypeCode(value: string | undefined): value is LookupTypeCode {
  return value !== undefined && (LOOKUP_TYPE_CODES as readonly string[]).includes(value);
}

export function LookupsHubPage(): JSX.Element {
  const { typeCode: param } = useParams<{ typeCode?: string }>();
  const navigate = useNavigate();
  const typesQuery = useLookupTypes();
  const deleteMut = useDeleteLookup();

  const selected: LookupTypeCode = isTypeCode(param) ? param : 'RELATIONSHIP_CATEGORY';
  const isTree = HIERARCHICAL_TYPES.has(selected);

  const [editing, setEditing] = useState<LookupItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [defaultParent, setDefaultParent] = useState<string | null>(null);

  const handleEdit = (item: LookupItem): void => {
    setEditing(item);
    setDefaultParent(null);
    setDrawerOpen(true);
  };

  const handleCreate = (parentId: string | null = null): void => {
    setEditing(null);
    setDefaultParent(parentId);
    setDrawerOpen(true);
  };

  const handleDelete = (item: LookupItem): void => {
    deleteMut.mutate({ id: item.id, typeCode: item.lookupTypeCode });
  };

  const types = typesQuery.data ?? [];
  const hierarchical = types.filter((t) => t.isHierarchical);
  const flat = types.filter((t) => !t.isHierarchical);

  const activeType = types.find((t) => t.code === selected);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="الأكواد المرجعية"
        subtitle="إدارة الأكواد المرجعية للمنظومة — صلات القرابة، الاختبارات، اللجان، الجغرافيا، التنبيهات."
        breadcrumbs={[
          { label: 'الإدارة', href: ROUTES.admin.dashboard },
          { label: 'الأكواد المرجعية' },
        ]}
        actions={
          <Button
            variant="ghost"
            leadingIcon={<Network size={16} />}
            onClick={() => navigate(ROUTES.admin.adminLookupsMappings('categoryCommittees'))}
          >
            جداول الارتباط
          </Button>
        }
      />

      <div className="grid grid-cols-12 gap-4">
        {/* Left rail */}
        <aside className="col-span-12 md:col-span-3 xl:col-span-3">
          <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface p-3">
            <TypeGroup
              icon={<Layers size={14} />}
              label="هرمية"
              types={hierarchical}
              selected={selected}
              onSelect={(t) => navigate(ROUTES.admin.adminLookupsType(t))}
            />
            <TypeGroup
              icon={<List size={14} />}
              label="مسطّحة"
              types={flat}
              selected={selected}
              onSelect={(t) => navigate(ROUTES.admin.adminLookupsType(t))}
            />
          </div>
        </aside>

        {/* Right panel */}
        <section className="col-span-12 md:col-span-9 xl:col-span-9">
          <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-ar-display text-lg font-bold text-ink-900">
                  {activeType?.nameAr ?? selected}
                </h2>
                <p className="font-mono text-2xs text-ink-500">{selected}</p>
              </div>
              <Badge tone={isTree ? 'info' : 'neutral'}>
                {isTree ? 'هرمية' : 'مسطّحة'}
              </Badge>
            </div>
            {isTree ? (
              <LookupTree
                typeCode={selected}
                onEdit={handleEdit}
                onCreate={handleCreate}
                onDelete={handleDelete}
              />
            ) : (
              <LookupGrid
                typeCode={selected}
                onEdit={handleEdit}
                onCreate={() => handleCreate(null)}
              />
            )}
          </div>
        </section>
      </div>

      <LookupFormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        editing={editing}
        typeCode={selected}
        defaultParentId={defaultParent}
      />
    </div>
  );
}

/* ─── Left-rail group ────────────────────────────────────────────────── */

interface TypeGroupProps {
  icon: JSX.Element;
  label: string;
  types: LookupType[];
  selected: LookupTypeCode;
  onSelect: (code: LookupTypeCode) => void;
}

function TypeGroup({ icon, label, types, selected, onSelect }: TypeGroupProps): JSX.Element {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 px-1.5 text-2xs font-medium uppercase tracking-wide text-ink-500">
        {icon}
        <span>{label}</span>
        <span className="ms-auto font-mono">{types.length}</span>
      </div>
      <ul className="flex flex-col gap-0.5">
        {types.map((t) => {
          const active = t.code === selected;
          return (
            <li key={t.code}>
              <button
                type="button"
                onClick={() => onSelect(t.code)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-start text-sm',
                  'transition-colors duration-fast ease-standard',
                  active
                    ? 'bg-accent-50 text-accent-700 font-medium'
                    : 'text-ink-700 hover:bg-ink-50 hover:text-ink-900',
                )}
              >
                <span className="min-w-0 flex-1 truncate font-ar">{t.nameAr}</span>
                <ChevronLeft
                  size={14}
                  className={cn(
                    'shrink-0 rtl:-scale-x-100',
                    active ? 'text-accent-600' : 'text-ink-300',
                  )}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
