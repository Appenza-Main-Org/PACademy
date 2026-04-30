import { cn } from '@/shared/lib/cn';
import type { Role } from '../rbac';

interface RoleOption {
  key: Role;
  icon: string;
  label: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  { key: 'super_admin',     icon: '👤', label: 'مدير النظام' },
  { key: 'committee_admin', icon: '📋', label: 'مدير لجنة' },
  { key: 'medical_admin',   icon: '🩺', label: 'القومسيون الطبي' },
  { key: 'investigator',    icon: '🔍', label: 'إدارة التحريات' },
  { key: 'board_admin',     icon: '⚖️', label: 'الهيئة' },
  { key: 'exams_admin',     icon: '📝', label: 'الاختبارات' },
  { key: 'biometric_user',  icon: '🛡️', label: 'بوابة الأمن' },
  { key: 'applicant',       icon: '🎓', label: 'متقدم' },
];

interface RoleSelectorProps {
  value: Role;
  onChange: (role: Role) => void;
}

export function RoleSelector({ value, onChange }: RoleSelectorProps): JSX.Element {
  return (
    <div className="login-roles">
      {ROLE_OPTIONS.map((r) => (
        <button
          key={r.key}
          type="button"
          className={cn('login-role', value === r.key && 'selected')}
          onClick={() => onChange(r.key)}
          aria-pressed={value === r.key}
        >
          <div className="login-role-icon">{r.icon}</div>
          <div className="login-role-label">{r.label}</div>
        </button>
      ))}
    </div>
  );
}
