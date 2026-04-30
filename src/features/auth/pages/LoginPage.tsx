import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { LoginArtPanel } from '../components/LoginArtPanel';
import { LoginForm } from '../components/LoginForm';

export function LoginPage(): JSX.Element {
  const user = useAuthStore((s) => s.user);
  if (user) return <Navigate to={user.role === 'applicant' ? '/applicant' : '/'} replace />;

  return (
    <div className="login-shell page-enter">
      <LoginArtPanel />
      <div className="login-form-side">
        <LoginForm />
      </div>
    </div>
  );
}
