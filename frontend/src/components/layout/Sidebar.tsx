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
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useSidebarStore } from '../../store/sidebarStore';
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
  const { resolvedTheme, toggleTheme } = useThemeStore();
  const { isCollapsed, toggleCollapsed } = useSidebarStore();
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
    <aside
      className={clsx(
        'h-screen flex flex-col bg-surface border-r border-border flex-shrink-0 transition-all duration-300 ease-in-out select-none relative',
        isCollapsed ? 'w-[68px]' : 'w-[230px]'
      )}
    >
      {/* Subtle gradient overlay for depth */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-[rgba(212,175,90,0.015)]" />

      {/* Header Logo & Collapse Button */}
      <div
        className={clsx(
          'flex items-center transition-all duration-300 relative z-10',
          isCollapsed ? 'px-2 py-4 flex-col gap-3 justify-center' : 'px-5 py-5 justify-between'
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full bg-gold/10 border border-gold-border flex items-center justify-center overflow-hidden p-0.5 flex-shrink-0 shadow-sm">
            <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover rounded-full" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0 overflow-hidden">
              <span className="text-sm font-bold text-text tracking-tight leading-none truncate">Bighrissen</span>
              <span className="text-[10px] font-semibold text-gold uppercase tracking-[0.15em] mt-0.5">Phone</span>
            </div>
          )}
        </div>

        <button
          onClick={toggleCollapsed}
          type="button"
          className="p-1.5 rounded-lg text-text-muted hover:text-gold hover:bg-gold/10 transition-colors flex-shrink-0 cursor-pointer"
          title={isCollapsed ? 'Agrandir la barre latérale' : 'Réduire la barre latérale'}
        >
          {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Divider */}
      <div className={clsx('h-px bg-border relative z-10', isCollapsed ? 'mx-2' : 'mx-5')} />

      {/* Main Nav Items */}
      <nav className={clsx('flex-1 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden relative z-10', isCollapsed ? 'px-1.5' : 'px-3')}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              title={isCollapsed ? item.label : undefined}
              className={clsx(
                'flex items-center rounded-[var(--radius-md)] text-[12.5px] font-medium transition-all duration-200 group relative',
                isCollapsed ? 'justify-center w-11 h-10 mx-auto' : 'gap-2.5 px-3 py-[9px]',
                isActive
                  ? 'bg-gold/10 text-gold border border-gold-border/50 shadow-[0_0_16px_rgba(212,175,90,0.06)] font-semibold'
                  : 'text-text-secondary hover:text-text hover:bg-surface-hover border border-transparent'
              )}
            >
              <Icon
                className={clsx(
                  'w-[17px] h-[17px] flex-shrink-0 transition-all duration-200',
                  isActive ? 'text-gold' : 'text-text-muted group-hover:text-text-secondary'
                )}
              />
              {!isCollapsed && <span className="truncate">{item.label}</span>}
              {/* Active indicator bar */}
              {isActive && !isCollapsed && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-gold rounded-r-full" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Nav Section */}
      <div className={clsx('pb-4 space-y-1.5 relative z-10', isCollapsed ? 'px-1.5' : 'px-3')}>
        <div className={clsx('mb-2 h-px bg-border', isCollapsed ? 'mx-1' : 'mx-2')} />

        {/* Settings */}
        {bottomItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              title={isCollapsed ? item.label : undefined}
              className={clsx(
                'flex items-center rounded-[var(--radius-md)] text-[12.5px] font-medium transition-all duration-200 group',
                isCollapsed ? 'justify-center w-11 h-10 mx-auto' : 'gap-2.5 px-3 py-[9px]',
                isActive
                  ? 'bg-gold/10 text-gold border border-gold-border/50 font-semibold'
                  : 'text-text-secondary hover:text-text hover:bg-surface-hover border border-transparent'
              )}
            >
              <Icon
                className={clsx(
                  'w-[17px] h-[17px] flex-shrink-0 transition-all duration-200',
                  isActive ? 'text-gold' : 'text-text-muted group-hover:text-text-secondary'
                )}
              />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}

        {/* Quick Theme Switcher */}
        {!isCollapsed ? (
          <div className="mt-1.5 mx-1 px-3 py-2 rounded-[var(--radius-md)] bg-surface-alt/50 border border-border/80 flex items-center justify-between text-xs transition-colors">
            <div className="flex items-center gap-2">
              {resolvedTheme === 'dark' ? (
                <Moon className="w-3.5 h-3.5 text-gold flex-shrink-0" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-gold flex-shrink-0" />
              )}
              <span className="text-[11px] font-medium text-text-secondary">
                {resolvedTheme === 'dark' ? 'Mode Sombre' : 'Mode Clair'}
              </span>
            </div>
            <button
              onClick={toggleTheme}
              type="button"
              className="p-1 rounded-md text-text-muted hover:text-gold hover:bg-gold/10 transition-colors cursor-pointer"
              title={resolvedTheme === 'dark' ? 'Passer en Mode Clair' : 'Passer en Mode Sombre'}
            >
              {resolvedTheme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>
        ) : (
          <div className="mt-1 flex justify-center">
            <button
              onClick={toggleTheme}
              type="button"
              className="w-10 h-10 rounded-[var(--radius-md)] bg-surface-alt/70 border border-border flex items-center justify-center text-gold hover:bg-gold/10 transition-colors cursor-pointer"
              title={resolvedTheme === 'dark' ? 'Passer en Mode Clair' : 'Passer en Mode Sombre'}
            >
              {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        )}

        {/* Operator indicator & Logout */}
        {!isCollapsed ? (
          <div className="mt-1.5 mx-1 p-3 rounded-[var(--radius-md)] bg-surface-alt/30 border border-border/80 flex items-center justify-between group">
            <button
              className="text-left flex-1 hover:opacity-80 transition-opacity min-w-0 cursor-pointer"
              onClick={() => setIsOpModalOpen(true)}
            >
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Operator</p>
              <p className="text-xs font-semibold text-text mt-0.5 truncate">{operator?.display_name || 'Not selected'}</p>
            </button>
            <button
              onClick={handleLogout}
              title="Log out"
              className="p-1.5 rounded-[var(--radius-sm)] text-text-muted hover:text-red-400 hover:bg-danger/10 transition-colors flex-shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="mt-1.5 flex flex-col items-center gap-1 pt-1">
            <button
              onClick={() => setIsOpModalOpen(true)}
              className="w-9 h-9 rounded-full bg-gold/15 border border-gold-border text-gold font-bold text-xs flex items-center justify-center hover:scale-105 transition-transform cursor-pointer shadow-sm"
              title={`Opérateur : ${operator?.display_name || 'Non sélectionné'} (cliquer pour changer)`}
            >
              {operator?.display_name ? operator.display_name.charAt(0).toUpperCase() : 'OP'}
            </button>
            <button
              onClick={handleLogout}
              title="Se déconnecter"
              className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-danger/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
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
