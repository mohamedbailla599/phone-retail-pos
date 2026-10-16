import { useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotificationStore } from '../../store/notificationStore';
import NotificationDrawer from './NotificationDrawer';

interface NotificationBellProps {
  isCollapsed?: boolean;
}

export default function NotificationBell({ isCollapsed = false }: NotificationBellProps) {
  const { unreadCount, toggleOpen, fetchNotifications } = useNotificationStore();

  // Periodic polling every 60 seconds to keep notification badge fresh
  useEffect(() => {
    fetchNotifications(true);
    const interval = setInterval(() => {
      fetchNotifications(true);
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  return (
    <>
      {isCollapsed ? (
        <button
          type="button"
          onClick={toggleOpen}
          className="relative w-10 h-10 rounded-[var(--radius-md)] bg-surface-alt/70 border border-border flex items-center justify-center text-text hover:text-gold hover:bg-gold/10 transition-colors cursor-pointer group"
          title={`Notifications (${unreadCount} non lues)`}
        >
          <Bell className={`w-4 h-4 transition-transform ${unreadCount > 0 ? 'text-gold animate-bounce' : ''}`} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-danger text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-surface shadow-sm">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={toggleOpen}
          className="w-full flex items-center justify-between px-3 py-2 rounded-[var(--radius-md)] text-xs font-semibold bg-surface-alt/70 hover:bg-gold/10 border border-border text-text hover:text-gold transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Bell className={`w-4 h-4 transition-colors ${unreadCount > 0 ? 'text-gold' : 'text-text-muted group-hover:text-gold'}`} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-danger rounded-full animate-ping" />
              )}
            </div>
            <span>Notifications</span>
          </div>

          {unreadCount > 0 ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-danger text-white shadow-sm">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : (
            <span className="text-[10px] text-text-muted opacity-60">0</span>
          )}
        </button>
      )}

      {/* Slide-over Drawer */}
      <NotificationDrawer />
    </>
  );
}
