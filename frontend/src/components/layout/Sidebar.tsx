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
  UserCheck,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { useSidebarStore } from '../../store/sidebarStore';
import { authApi } from '../../api/auth';
import { useState } from 'react';
import OperatorSelectionModal from '../ui/OperatorSelectionModal';
import NotificationBell from '../notifications/NotificationBell';

interface NavSection {
  title: string;
  items: {
    icon: typeof LayoutDashboard;
    label: string;
    path: string;
    badge?: string;
  }[];
}

const navSections: NavSection[] = [
  {
    title: 'Ventes & Caisse',
    items: [
      { icon: LayoutDashboard, label: 'Tableau de bord', path: '/dashboard' },
      { icon: ShoppingCart, label: 'Caisse (POS)', path: '/pos' },
      { icon: Users, label: 'Clients & Dettes', path: '/customers' },
      { icon: Bookmark, label: 'Réservations', path: '/reservations' },
    ],
  },
  {
    title: 'Stock & Matériel',
    items: [
      { icon: Smartphone, label: 'Appareils', path: '/devices' },
      { icon: Package, label: 'Accessoires', path: '/accessories' },
      { icon: ArrowLeftRight, label: 'Échanges', path: '/exchanges' },
      { icon: RotateCcw, label: 'Retours & Avoirs', path: '/returns' },
    ],
  },
  {
    title: 'Atelier & SAV',
    items: [
      { icon: Wrench, label: 'Réparations', path: '/repairs' },
    ],
  },
  {
    title: 'Pilotage & Système',
    items: [
      { icon: BarChart3, label: 'Rapports (Ticket Z)', path: '/reports' },
      { icon: ShieldCheck, label: "Journal d'audit", path: '/audit-logs' },
      { icon: Settings, label: 'Paramètres', path: '/settings' },
    ],
  },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { operator, user, clearAuth } = useAuthStore();
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

  const isItemActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <aside
      className={clsx(
        'h-screen flex flex-col bg-surface border-r border-border flex-shrink-0 transition-all duration-250 ease-in-out select-none relative z-30',
        isCollapsed ? 'w-[70px]' : 'w-[240px]'
      )}
    >
      {/* Subtle ambient lighting */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-transparent to-gold/3" />

      {/* Header Logo & Collapse Button */}
      <div
        className={clsx(
          'h-[72px] flex items-center border-b border-border/80 relative z-10 flex-shrink-0',
          isCollapsed ? 'px-2 justify-center' : 'px-5 justify-between'
        )}
      >
        <Link to="/dashboard" className="flex items-center gap-3 min-w-0 group">
          <div className="w-10 h-10 rounded-full bg-gold/10 border border-gold-border flex items-center justify-center overflow-hidden p-0.5 flex-shrink-0 shadow-xs transition-transform group-hover:scale-105">
            <img src="/logo.jpg" alt="Bighrissen Phone Logo" className="w-full h-full object-cover rounded-full" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0 overflow-hidden">
              <span className="text-sm font-bold text-text tracking-tight leading-none truncate">
                Bighrissen
              </span>
              <span className="text-[10px] font-bold text-gold uppercase tracking-[0.16em] mt-1">
                Phone POS
              </span>
            </div>
          )}
        </Link>

        <button
          onClick={toggleCollapsed}
          type="button"
          className={clsx(
            'p-1.5 rounded-lg text-text-muted hover:text-gold hover:bg-gold/10 transition-colors flex-shrink-0 cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-gold/50',
            isCollapsed && 'hidden'
          )}
          title="Réduire la barre latérale"
          aria-label="Réduire la barre latérale"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Collapsed expand toggle button */}
      {isCollapsed && (
        <div className="pt-2 flex justify-center relative z-10">
          <button
            onClick={toggleCollapsed}
            type="button"
            className="p-1.5 rounded-lg text-text-muted hover:text-gold hover:bg-gold/10 transition-colors cursor-pointer"
            title="Agrandir la barre latérale"
            aria-label="Agrandir la barre latérale"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quick Notifications Access */}
      <div className={clsx('pt-2 pb-1 relative z-10', isCollapsed ? 'px-1.5 flex justify-center' : 'px-3.5')}>
        <NotificationBell isCollapsed={isCollapsed} />
      </div>

      {/* Main Nav Items with Grouped Sections */}
      <nav className={clsx('flex-1 py-2 overflow-y-auto overflow-x-hidden relative z-10 space-y-4', isCollapsed ? 'px-1.5' : 'px-3')}>
        {navSections.map((section, sIndex) => (
          <div key={section.title} className="space-y-1">
            {!isCollapsed ? (
              <div className="px-3 pt-1 pb-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">
                  {section.title}
                </span>
              </div>
            ) : sIndex > 0 ? (
              <div className="mx-2 my-2 h-px bg-border/60" />
            ) : null}

            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = isItemActive(item.path);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={isCollapsed ? item.label : undefined}
                    className={clsx(
                      'flex items-center rounded-[var(--radius-md)] text-[13px] font-medium transition-all duration-150 group relative select-none',
                      isCollapsed ? 'justify-center w-11 h-10 mx-auto' : 'gap-2.5 px-3 py-2',
                      isActive
                        ? 'bg-gold/12 text-gold font-semibold border border-gold-border/40 shadow-xs'
                        : 'text-text-secondary hover:text-text hover:bg-surface-elevated/70 border border-transparent'
                    )}
                  >
                    <Icon
                      className={clsx(
                        'w-[18px] h-[18px] flex-shrink-0 transition-colors',
                        isActive ? 'text-gold' : 'text-text-muted group-hover:text-text-secondary'
                      )}
                    />
                    {!isCollapsed && (
                      <span className="truncate flex-1">
                        {item.label}
                      </span>
                    )}

                    {/* Active accent pill */}
                    {isActive && !isCollapsed && (
                      <div className="w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0 shadow-[0_0_8px_var(--theme-gold)]" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Nav & User/Operator Section */}
      <div className={clsx('p-3 border-t border-border/80 bg-surface/80 backdrop-blur-xs relative z-10 space-y-2', isCollapsed && 'px-1.5 py-3')}>
        {/* Theme Switcher */}
        {!isCollapsed ? (
          <div className="px-2.5 py-1.5 rounded-[var(--radius-md)] bg-surface-alt/60 border border-border/70 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-text-secondary text-[11px] font-medium">
              {resolvedTheme === 'dark' ? (
                <Moon className="w-3.5 h-3.5 text-gold" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-gold" />
              )}
              <span>{resolvedTheme === 'dark' ? 'Mode Sombre' : 'Mode Clair'}</span>
            </div>
            <button
              onClick={toggleTheme}
              type="button"
              className="p-1 rounded-md text-text-muted hover:text-gold hover:bg-gold/10 transition-colors cursor-pointer"
              title={resolvedTheme === 'dark' ? 'Basculer en Mode Clair' : 'Basculer en Mode Sombre'}
            >
              {resolvedTheme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={toggleTheme}
              type="button"
              className="w-9 h-9 rounded-lg bg-surface-alt border border-border flex items-center justify-center text-gold hover:bg-gold/10 transition-colors cursor-pointer"
              title={resolvedTheme === 'dark' ? 'Basculer en Mode Clair' : 'Basculer en Mode Sombre'}
            >
              {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        )}

        {/* Operator Profile Block */}
        {!isCollapsed ? (
          <div className="p-2 rounded-[var(--radius-md)] bg-surface-elevated/80 border border-border flex items-center justify-between gap-2 shadow-xs">
            <button
              type="button"
              onClick={() => setIsOpModalOpen(true)}
              className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-85 transition-opacity cursor-pointer flex-1"
              title="Changer d'opérateur de caisse"
            >
              <div className="w-8 h-8 rounded-full bg-gold/15 border border-gold-border/60 text-gold font-bold text-xs flex items-center justify-center flex-shrink-0">
                {operator?.display_name ? operator.display_name.charAt(0).toUpperCase() : (user?.username?.charAt(0).toUpperCase() || 'U')}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-text truncate">
                  {operator?.display_name || user?.display_name || user?.username || 'Opérateur'}
                </div>
                <div className="text-[10px] text-text-muted flex items-center gap-1">
                  <UserCheck className="w-3 h-3 text-emerald-500" />
                  <span>En session</span>
                </div>
              </div>
            </button>

            <button
              onClick={handleLogout}
              type="button"
              title="Se déconnecter"
              className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-danger/10 transition-colors flex-shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setIsOpModalOpen(true)}
              className="w-9 h-9 rounded-full bg-gold/15 border border-gold-border text-gold font-bold text-xs flex items-center justify-center hover:scale-105 transition-transform cursor-pointer shadow-xs"
              title={`Opérateur: ${operator?.display_name || user?.username || 'N/A'} (cliquer pour changer)`}
            >
              {operator?.display_name ? operator.display_name.charAt(0).toUpperCase() : (user?.username?.charAt(0).toUpperCase() || 'U')}
            </button>
            <button
              onClick={handleLogout}
              type="button"
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
        title="Sélectionner l'Opérateur"
        description="Choisir le profil effectuant les opérations de caisse."
      />
    </aside>
  );
}
