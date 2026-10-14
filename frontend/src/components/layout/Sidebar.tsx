import { clsx } from 'clsx';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Smartphone,
  Package,
  ArrowLeftRight,
  RotateCcw,
  Bookmark,
  Wrench,
  BarChart3,
  Users,
  Settings,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api/auth';
import { useState } from 'react';
import OperatorSelectionModal from '../ui/OperatorSelectionModal';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: ShoppingCart, label: 'Point of Sale', path: '/pos' },
  { icon: Users, label: 'Customers & Debts', path: '/customers' },
  { icon: Smartphone, label: 'Devices', path: '/devices' },
  { icon: Bookmark, label: 'Reservations', path: '/reservations' },
  { icon: Package, label: 'Accessories', path: '/accessories' },
  { icon: ArrowLeftRight, label: 'Exchanges', path: '/exchanges' },
  { icon: RotateCcw, label: 'Returns & Refunds', path: '/returns' },
  { icon: Wrench, label: 'Repairs', path: '/repairs' },
  { icon: BarChart3, label: 'Reports', path: '/reports' },
  { icon: ShieldCheck, label: 'Audit Logs', path: '/audit-logs' },
];

const bottomItems = [
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { operator, clearAuth } = useAuthStore();
  const [isOpModalOpen, setIsOpModalOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await authApi.logout();
      clearAuth();
      navigate('/login');
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  return (
    <aside className="w-[220px] h-screen flex flex-col bg-surface border-r border-border flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold-border flex items-center justify-center overflow-hidden p-0.5">
          <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover rounded-full" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold text-text tracking-tight leading-none">Bighrissen</span>
          <span className="text-[10px] font-semibold text-gold uppercase tracking-[0.15em] mt-0.5">Phone</span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 h-px bg-border" />

      {/* Main Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-[13px] font-medium transition-smooth group',
                isActive
                  ? 'bg-gold/8 text-text border border-gold-border/50 shadow-[0_0_12px_rgba(212,175,90,0.06)]'
                  : 'text-text-secondary hover:text-text hover:bg-[rgba(255,255,255,0.04)] border border-transparent',
              )}
            >
              <Icon
                className={clsx(
                  'w-[18px] h-[18px] flex-shrink-0 transition-smooth',
                  isActive ? 'text-gold' : 'text-text-muted group-hover:text-text-secondary',
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Nav */}
      <div className="px-3 pb-4 space-y-0.5">
        <div className="mx-1 mb-3 h-px bg-border" />
        {bottomItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-[13px] font-medium transition-smooth group',
                isActive
                  ? 'bg-gold/8 text-text border border-gold-border/50'
                  : 'text-text-secondary hover:text-text hover:bg-[rgba(255,255,255,0.04)] border border-transparent',
              )}
            >
              <Icon
                className={clsx(
                  'w-[18px] h-[18px] flex-shrink-0 transition-smooth',
                  isActive ? 'text-gold' : 'text-text-muted group-hover:text-text-secondary',
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* Operator indicator & Logout */}
        <div className="mt-3 mx-1 p-3 rounded-[var(--radius-md)] bg-[rgba(255,255,255,0.02)] border border-border flex items-center justify-between group">
          <button 
            className="text-left flex-1 hover:opacity-80 transition-opacity"
            onClick={() => setIsOpModalOpen(true)}
          >
            <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Operator</p>
            <p className="text-xs font-semibold text-text mt-0.5">{operator?.display_name || 'Not selected'}</p>
          </button>
          <button 
            onClick={handleLogout}
            title="Log out"
            className="p-1.5 rounded-[var(--radius-sm)] text-text-muted hover:text-red-400 hover:bg-danger/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <OperatorSelectionModal
        isOpen={isOpModalOpen}
        onClose={() => setIsOpModalOpen(false)}
        onSelect={() => setIsOpModalOpen(false)}
        title="Select Operator"
        description="Switch the current operating context."
      />
    </aside>
  );
}
