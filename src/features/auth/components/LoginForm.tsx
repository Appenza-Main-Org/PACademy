/**
 * LoginForm — demo login wrapper.
 * Sprint 0 keeps the existing role-pick mechanic; real two-path login
 * (MOIPASS officers vs. NID+SMS applicants) lands in Sprint 9.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import { Button, Input, toast } from '@/shared/components';
import { useLoginMutation } from '../api/auth.queries';
import { RoleSelector } from './RoleSelector';
import type { Role } from '../rbac';

export function LoginForm(): JSX.Element {
  const [role, setRole] = useState<Role>('super_admin');
  const [username, setUsername] = useState('ahmed.fakhry');
  const [password, setPassword] = useState('demo-password');
  const navigate = useNavigate();
  const loginMutation = useLoginMutation();

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    loginMutation.mutate(
      { username, password, role },
      {
        onSuccess: () => {
          toast('مرحباً بك في المنظومة', 'success');
          navigate(role === 'applicant' ? '/applicant' : '/', { replace: true });
        },
        onError: (err) => {
          toast(err.message || 'تعذر تسجيل الدخول', 'danger');
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-5">
      <header>
        <h2 className="font-ar-display text-2xl font-bold text-ink-900">تسجيل الدخول</h2>
        <p className="mt-1 text-sm text-ink-500">
          اختر دورك الوظيفي وأدخل بيانات الدخول للوصول إلى المنظومة.
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-ink-700">الدور الوظيفي</span>
        <RoleSelector value={role} onChange={setRole} />
      </div>

      <Input
        label="اسم المستخدم أو الرقم القومي"
        name="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="أدخل اسم المستخدم"
        required
      />

      <Input
        label="كلمة المرور"
        type="password"
        name="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="••••••••"
        helper="للعرض التجريبي يمكنك الضغط على «تسجيل الدخول» مباشرةً."
        required
      />

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        isLoading={loginMutation.isPending}
        trailingIcon={<ArrowLeft size={18} strokeWidth={1.75} />}
      >
        تسجيل الدخول
      </Button>

      <aside
        role="note"
        className="flex items-start gap-3 rounded-md border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-700"
      >
        <Lock size={18} strokeWidth={1.75} aria-hidden className="mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium">دخول آمن عبر منصة التحقق الرقمي</p>
          <p className="mt-0.5 text-xs text-teal-700/80 leading-normal">
            يتم التحقق من هوية الضباط عبر API منصة التحقق الرقمي للحكومة المصرية.
          </p>
        </div>
      </aside>
    </form>
  );
}
