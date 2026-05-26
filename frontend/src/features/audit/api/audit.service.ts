/**
 * Audit API.
 *
 * INTEGRATION CONTRACT:
 *   GET /api/audit
 *   GET /api/audit/:id
 *   GET /api/audit/:id/diff
 *   GET /api/audit/actions
 *   GET /api/audit/entity-types
 *   GET /api/audit/modules
 *   GET /api/audit/roles
 *   GET /api/audit/users
 *   GET /api/audit/export?format=csv
 */

import { apiClient } from '@/shared/lib/api-client';
import type { AuditAction, AuditColor, AuditDiff, AuditEntry, AuditModule } from '@/shared/types/domain';

export interface AuditFilters {
  action?: AuditAction | 'all';
  userId?: string | 'all';
  role?: string | 'all';
  module?: AuditModule | 'all';
  entity?: string | 'all';
  entityType?: string | 'all';
  entityId?: string;
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
}

export interface AuditActionOption {
  action: AuditAction;
  label: string;
  color: AuditColor;
}

const MODULE_LABELS: Record<string, string> = {
  admin: 'الإدارة',
  admissions: 'القبول',
  admissionSetup: 'إعداد التقديم',
  'admissionSetup.applicationSettings': 'إعدادات التقديم',
  applicants: 'المتقدمون',
  auth: 'الدخول والصلاحيات',
  categories: 'فئات القبول',
  committeeInstances: 'لجان الاختبارات',
  committees: 'اللجان',
  cycles: 'دورات القبول',
  exams: 'الاختبارات',
  grades: 'درجات الثانوية العامة والأزهرية',
  lookups: 'الأكواد المرجعية',
  notifications: 'الإشعارات',
  payments: 'المدفوعات',
  roles: 'الأدوار والصلاحيات',
  settings: 'الإعدادات العامة',
  users: 'مستخدمو المنظومة',
  workflows: 'مسارات العمل',
};

const ACTION_LABELS: Record<string, { label: string; color: AuditColor }> = {
  activate: { label: 'تفعيل', color: 'success' },
  bulk_restore: { label: 'استعادة جماعية', color: 'success' },
  bulk_soft_delete: { label: 'إيقاف جماعي', color: 'warning' },
  create: { label: 'إنشاء سجل', color: 'success' },
  delete: { label: 'حذف', color: 'danger' },
  export: { label: 'تصدير', color: 'info' },
  login: { label: 'تسجيل دخول', color: 'success' },
  restore: { label: 'استعادة', color: 'success' },
  soft_delete: { label: 'إيقاف', color: 'warning' },
  transition: { label: 'تغيير حالة', color: 'info' },
  update: { label: 'تحديث سجل', color: 'info' },
  upsert: { label: 'حفظ وتحديث', color: 'info' },
  'applicants.upsert': { label: 'حفظ متقدم', color: 'info' },
  'committeeInstances.create': { label: 'إنشاء لجنة', color: 'success' },
  'grades.update': { label: 'تحديث درجة', color: 'info' },
};

function tailAfterDot(value: string): string {
  const dotIndex = value.lastIndexOf('.');
  return dotIndex === -1 ? value : value.slice(dotIndex + 1);
}

function splitAuditDetails(details: string): { rawOperation: string; subject: string } {
  const [rawOperation = '', subject = ''] = details.split('·').map((part) => part.trim());
  return { rawOperation, subject };
}

function admissionSetupCycleId(value: string): string | null {
  const match = value.match(/(CYC-[A-Za-z0-9-]+)/);
  return match?.[1] ?? null;
}

function moduleBase(value: string | undefined): string {
  if (!value) return '';
  if (value.startsWith('admissionSetup.applicationSettings')) return 'admissionSetup.applicationSettings';
  if (value.startsWith('admissionSetup')) return 'admissionSetup';
  return value.split('.')[0] ?? value;
}

export function auditModuleLabel(value: string | undefined): string {
  const base = moduleBase(value);
  return MODULE_LABELS[base] ?? value ?? 'غير محدد';
}

export function auditEntityLabel(value: string | undefined): string {
  const base = moduleBase(value);
  return MODULE_LABELS[base] ?? value ?? 'غير محدد';
}

function actionMeta(action: string, fallbackLabel: string, fallbackColor: AuditColor): { label: string; color: AuditColor } {
  return ACTION_LABELS[action]
    ?? ACTION_LABELS[tailAfterDot(action)]
    ?? { label: fallbackLabel && fallbackLabel !== action ? fallbackLabel : action, color: fallbackColor };
}

function readableDetails(entry: AuditEntry): string {
  const { subject } = splitAuditDetails(entry.details);
  const action = String(entry.action);
  const baseModule = moduleBase(entry.module);
  const cycleId = admissionSetupCycleId(entry.entityId) ?? admissionSetupCycleId(entry.module ?? '') ?? admissionSetupCycleId(entry.details);
  const subjectText = subject && subject !== entry.entityId && subject !== entry.entity ? subject : '';

  if (baseModule === 'admissionSetup.applicationSettings') {
    return cycleId
      ? `حفظ إعدادات التقديم العامة للدورة ${cycleId}`
      : 'حفظ إعدادات التقديم العامة';
  }

  if (entry.entity === 'cycles' || entry.entityType === 'cycles') {
    if (action === 'activate') return `تفعيل دورة قبول${subjectText ? `: ${subjectText}` : ''}`;
    if (action === 'transition') return `تغيير حالة دورة قبول${subjectText ? `: ${subjectText}` : ''}`;
    if (action === 'create') return `إنشاء دورة قبول${subjectText ? `: ${subjectText}` : ''}`;
    return `${actionMeta(action, entry.actionLabel, entry.actionColor).label} دورة قبول${subjectText ? `: ${subjectText}` : ''}`;
  }

  if (baseModule === 'applicants') {
    return subjectText
      ? `حفظ بيانات المتقدم: ${subjectText}`
      : `حفظ بيانات المتقدم رقم ${entry.entityId}`;
  }

  if (baseModule === 'grades') {
    return subjectText
      ? `تحديث درجة الطالب: ${subjectText}`
      : `تحديث درجة الطالب برقم جلوس ${entry.entityId}`;
  }

  if (baseModule === 'committeeInstances') {
    return `إنشاء لجنة اختبار${subjectText ? `: ${subjectText}` : ` برقم ${entry.entityId}`}`;
  }

  if (entry.module === 'auth' || action === 'login') {
    return entry.details;
  }

  return subjectText
    ? `${actionMeta(action, entry.actionLabel, entry.actionColor).label} في ${auditModuleLabel(entry.module)}: ${subjectText}`
    : entry.details;
}

function normalizeAuditEntry(entry: AuditEntry): AuditEntry {
  const meta = actionMeta(String(entry.action), entry.actionLabel, entry.actionColor);
  const normalizedModule = moduleBase(entry.module);
  return {
    ...entry,
    actionLabel: meta.label,
    actionColor: meta.color,
    module: (MODULE_LABELS[normalizedModule] ? normalizedModule : entry.module) as AuditModule | undefined,
    entity: auditEntityLabel(entry.entity),
    entityType: auditEntityLabel(entry.entityType),
    details: readableDetails(entry),
  };
}

export const auditService = {
  async list(filters: AuditFilters = {}): Promise<AuditEntry[]> {
    const rows = await apiClient.get<AuditEntry[]>('/api/audit', { query: filters });
    return rows.map(normalizeAuditEntry);
  },

  async getById(id: string): Promise<AuditEntry | null> {
    const row = await apiClient.get<AuditEntry | null>(`/api/audit/${encodeURIComponent(id)}`);
    return row ? normalizeAuditEntry(row) : row;
  },

  async getDiff(id: string): Promise<AuditDiff> {
    return apiClient.get(`/api/audit/${encodeURIComponent(id)}/diff`);
  },

  async getEntityTypes(): Promise<string[]> {
    return apiClient.get('/api/audit/entity-types');
  },

  async getActions(): Promise<AuditActionOption[]> {
    const rows = await apiClient.get<AuditActionOption[]>('/api/audit/actions');
    return rows.map((row) => {
      const meta = actionMeta(String(row.action), row.label, row.color);
      return { ...row, label: meta.label, color: meta.color };
    });
  },

  async getModules(): Promise<AuditModule[]> {
    const rows = await apiClient.get<AuditModule[]>('/api/audit/modules');
    return [...new Set(rows.map((row) => moduleBase(row) as AuditModule))];
  },

  async getRoles(): Promise<string[]> {
    return apiClient.get('/api/audit/roles');
  },

  async getUsers(): Promise<{ id: string; name: string }[]> {
    return apiClient.get('/api/audit/users');
  },

  async exportCsv(filters: AuditFilters = {}): Promise<Blob> {
    return apiClient.blob('/api/audit/export', { query: { ...filters, format: 'csv' } });
  },
};
