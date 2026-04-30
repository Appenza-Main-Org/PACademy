import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import { Button, toast } from '@/shared/components';
import { Input } from '@/shared/components/Input';
import { useLoginMutation } from '../api/auth.queries';
import { RoleSelector } from './RoleSelector';
import type { Role } from '../rbac';

export function LoginForm(): JSX.Element {
  const [role, setRole] = useState<Role>('super_admin');
  const [username, setUsername] = useState('ahmed.fakhry');
  const [password, setPassword] = useState('demo-password');
  const navigate = useNavigate();
  const loginMutation = useLoginMutation();

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
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
    <form className="login-form" onSubmit={handleSubmit}>
      <h2>تسجيل الدخول</h2>
      <p>اختر دورك الوظيفي وأدخل بيانات الدخول للوصول إلى المنظومة.</p>

      <div className="field mb-4">
        <span className="field-label">الدور الوظيفي</span>
        <RoleSelector value={role} onChange={setRole} />
      </div>

      <div className="mb-4">
        <Input
          label="اسم المستخدم أو الرقم القومي"
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="أدخل اسم المستخدم"
        />
      </div>

      <div className="mb-5">
        <Input
          label="كلمة المرور"
          type="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          help="للعرض التجريبي، يمكنك الضغط على «تسجيل الدخول» مباشرة."
        />
      </div>

      <Button type="submit" variant="primary" size="lg" fullWidth isLoading={loginMutation.isPending} trailingIcon={<ArrowLeft size={18} />}>
        تسجيل الدخول
      </Button>

      <div className="alert alert-info mt-5">
        <span className="alert-icon">
          <Lock size={18} />
        </span>
        <div className="alert-body">
          <div className="alert-title">دخول آمن عبر منصة التحقق الرقمي</div>
          <div>يتم التحقق من هوية الضباط عبر API منصة التحقق الرقمي للحكومة المصرية.</div>
        </div>
      </div>
    </form>
  );
}
