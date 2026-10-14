import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, User, AlertCircle } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { authApi } from '../api/auth';
import { useAuthStore } from '../store/authStore';


export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, setAuth } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');


  // If already authenticated and have an operator, redirect to where they wanted to go or /pos
  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || '/pos';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const data = await authApi.login({ username, password });
      setAuth(data.user);
      // Let the useEffect handle the redirect
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-login flex items-center justify-center p-6 overflow-auto">
      {/* Subtle geometric decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-[rgba(212,175,90,0.04)] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-[rgba(212,175,90,0.03)] rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] border border-[rgba(212,175,90,0.02)] rounded-full" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-24 h-24 mx-auto mb-5 rounded-full bg-gold/8 border border-gold-border flex items-center justify-center shadow-[0_0_40px_rgba(212,175,90,0.08)] overflow-hidden p-1">
            <img src="/logo.jpg" alt="Bighrissen Phone" className="w-full h-full object-cover rounded-full" />
          </div>
          <h1 className="text-2xl font-bold text-text tracking-tight">Bighrissen Phone</h1>
          <p className="text-xs font-semibold text-gold uppercase tracking-[0.2em] mt-1.5">Point of Sale</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-[var(--radius-md)] bg-danger/10 border border-danger/20 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
            <div className="glass-panel rounded-[var(--radius-xl)] p-6 space-y-4">
              <Input
                label="Username"
                icon={<User className="w-4 h-4" />}
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
              />
              <Input
                label="Password"
                icon={<Lock className="w-4 h-4" />}
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full"
            >
              Enter POS
            </Button>
          </form>


      </div>
    </div>
  );
}
