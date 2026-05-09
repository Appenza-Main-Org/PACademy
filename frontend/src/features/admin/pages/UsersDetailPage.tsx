/**
 * UsersDetailPage — read-only user view + edit-in-place PATCH + deactivate (spec 003, T177).
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Pencil, ShieldOff } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Drawer,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Select,
  toast,
} from '@/shared/components';
import { CenteredShell } from '@/app/layouts/CenteredShell';
import { ROLE_DEFINITIONS, ROLES, type Role } from '@/features/auth';
import { date as fmtDate } from '@/shared/lib/format';
import { ROUTES } from '@/config/routes';
import { useUser, useUserUpdate, useUserDeactivate } from '../api/users.queries';
import type { UpdateSystemUserRequest } from '@/shared/types/domain';

const ROLE_OPTIONS = ROLES.map((r) => ({ value: r, label: ROLE_DEFINITIONS[r].labelAr }));

export function UsersDetailPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: user, isLoading } = useUser(id ?? null);
  const updateMut = useUserUpdate();
  const deactivateMut = useUserDeactivate();

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  if (isLoading) {
    return (
      <CenteredShell>
        <LoadingState variant="detail" />
      </CenteredShell>
    );
  }

  if (!user) {
    return (
      <CenteredShell>
        <p className="text-ink-500 text-sm p-8">المستخدم غير موجود.</p>
      </CenteredShell>
    );
  }

  const roleDef = ROLE_DEFINITIONS[user.role as Role];

  return (
    <CenteredShell>
      <PageHeader
        title={user.fullName}
        subtitle={roleDef?.labelAr ?? user.role}
        breadcrumbs={[
          { label: 'مستخدمو المنظومة', href: ROUTES.admin.users },
          { label: user.fullName },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              leadingIcon={<Pencil size={14} strokeWidth={1.75} />}
              onClick={() => setEditOpen(true)}
            >
              تعديل
            </Button>
            {user.isActive && (
              <Button
                variant="danger"
                leadingIcon={<ShieldOff size={14} strokeWidth={1.75} />}
                onClick={() => setConfirmDeactivate(true)}
              >
                تعطيل
              </Button>
            )}
          </div>
        }
      />

      {/* Status banner */}
      {!user.isActive && (
        <div className="mb-4 rounded-md border border-dashed border-gold-300 bg-gold-50 px-4 py-2 text-sm text-gold-700">
          هذا الحساب معطّل — لا يمكن للمستخدم تسجيل الدخول.
        </div>
      )}

      {/* Detail cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <div className="flex items-center gap-4 p-4">
            <Avatar name={user.fullName} size="lg" />
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-ink-900">{user.fullName}</span>
              <span className="font-mono text-sm text-ink-500" dir="ltr">{user.nationalId}</span>
              <Badge tone={user.isActive ? 'success' : 'neutral'}>
                {user.isActive ? 'نشط' : 'معطّل'}
              </Badge>
            </div>
          </div>
        </Card>

        <Card>
          <dl className="divide-y divide-border-subtle text-sm">
            <DetailRow label="الدور" value={roleDef?.labelAr ?? user.role} />
            <DetailRow label="الوحدة" value={user.unit ?? '—'} />
            <DetailRow label="رقم الهاتف" value={<span dir="ltr">{user.mobile}</span>} />
            <DetailRow label="البريد الإلكتروني" value={<span dir="ltr">{user.email ?? '—'}</span>} />
            <DetailRow
              label="تاريخ الإنشاء"
              value={fmtDate(new Date(user.createdAt).getTime(), 'short')}
            />
          </dl>
        </Card>

        <Card>
          <dl className="divide-y divide-border-subtle text-sm">
            <DetailRow label="الكود الوظيفي" value={<span dir="ltr">{user.officerCode}</span>} />
            <DetailRow
              label="تاريخ إصدار البطاقة"
              value={fmtDate(new Date(user.issueDate).getTime(), 'short')}
            />
            <DetailRow
              label="رقم مصنع البطاقة"
              value={<span dir="ltr">{user.cardFactoryNumber}</span>}
            />
            {user.archivedAt && (
              <DetailRow
                label="تاريخ الأرشفة"
                value={fmtDate(new Date(user.archivedAt).getTime(), 'short')}
              />
            )}
          </dl>
        </Card>

        <Card>
          <div className="p-4">
            <p className="mb-2 text-sm font-medium text-ink-700">التطبيقات المتاحة</p>
            <div className="flex flex-wrap gap-2">
              {(roleDef?.apps ?? []).map((app) => (
                <Badge key={app} tone="info">{app}</Badge>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Edit drawer */}
      <EditDrawer
        open={editOpen}
        user={user}
        onClose={() => setEditOpen(false)}
        onSave={(request) =>
          updateMut.mutate(
            { id: user.id, request },
            {
              onSuccess: () => {
                toast('تم حفظ التعديلات', 'success');
                setEditOpen(false);
              },
              onError: () => toast('فشل حفظ التعديلات', 'danger'),
            },
          )
        }
        isSaving={updateMut.isPending}
      />

      {/* Deactivate confirm modal */}
      <Modal
        open={confirmDeactivate}
        onClose={() => setConfirmDeactivate(false)}
        title="تأكيد تعطيل الحساب"
        size="sm"
      >
        <p className="text-sm text-ink-700">
          هل أنت متأكد من تعطيل حساب <strong>{user.fullName}</strong>؟ سيتم إنهاء جميع جلساته
          الحالية فوراً.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDeactivate(false)}>
            إلغاء
          </Button>
          <Button
            variant="danger"
            isLoading={deactivateMut.isPending}
            onClick={() =>
              deactivateMut.mutate(user.id, {
                onSuccess: () => {
                  toast('تم تعطيل الحساب', 'warning');
                  setConfirmDeactivate(false);
                  navigate(ROUTES.admin.users);
                },
                onError: (err) => {
                  const code = (err as { code?: string }).code;
                  const message = code === 'SUPER_ADMIN_FLOOR_BLOCKED'
                    ? 'يجب أن يبقى مدير نظام رئيسي واحد على الأقل نشطاً.'
                    : 'فشل تعطيل الحساب';
                  toast(message, 'danger');
                  setConfirmDeactivate(false);
                },
              })
            }
          >
            تعطيل
          </Button>
        </div>
      </Modal>
    </CenteredShell>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <dt className="text-ink-500 shrink-0">{label}</dt>
      <dd className="text-ink-900 text-end">{value}</dd>
    </div>
  );
}

interface EditDrawerProps {
  open: boolean;
  user: {
    id: string;
    fullName: string;
    mobile: string;
    email: string | null;
    unit: string | null;
    role: string;
    isActive: boolean;
  };
  onClose: () => void;
  onSave: (request: UpdateSystemUserRequest) => void;
  isSaving: boolean;
}

function EditDrawer({ open, user, onClose, onSave, isSaving }: EditDrawerProps): JSX.Element {
  const [fullName, setFullName] = useState(user.fullName);
  const [mobile, setMobile] = useState(user.mobile);
  const [email, setEmail] = useState(user.email ?? '');
  const [unit, setUnit] = useState(user.unit ?? '');
  const [role, setRole] = useState(user.role);

  return (
    <Drawer open={open} onClose={onClose} title="تعديل بيانات المستخدم" size="sm">
      <Drawer.Body>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSave({
              fullName: fullName !== user.fullName ? fullName : undefined,
              mobile: mobile !== user.mobile ? mobile : undefined,
              email: email !== (user.email ?? '') ? email : undefined,
              unit: unit !== (user.unit ?? '') ? unit : undefined,
              role: role !== user.role ? role : undefined,
            });
          }}
        >
          <Input
            label="الاسم الكامل"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <Input
            label="رقم الهاتف"
            dir="ltr"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
          />
          <Input
            label="البريد الإلكتروني"
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="الوحدة / الإدارة"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
          <Select
            label="الدور الوظيفي"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            options={ROLE_OPTIONS}
          />

          {role !== user.role && (
            <p className="rounded-md border border-dashed border-gold-300 bg-gold-50 px-3 py-2 text-xs text-gold-700">
              تغيير الدور سيؤدي إلى إنهاء جميع جلسات المستخدم الحالية (FR-C06).
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" isLoading={isSaving}>
              حفظ
            </Button>
          </div>
        </form>
      </Drawer.Body>
    </Drawer>
  );
}
