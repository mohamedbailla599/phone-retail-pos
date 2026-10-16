import { useNavigate } from 'react-router-dom';
import {
  X,
  Bell,
  Package,
  Coins,
  Bookmark,
  CheckCheck,
  RefreshCw,
  CheckCircle2,
  Trash2,
  ArrowRight,
  AlertTriangle,
  Info,
  Clock,
} from 'lucide-react';
import { useNotificationStore } from '../../store/notificationStore';
import type { NotificationCategory, NotificationSeverity } from '../../api/notifications';

export default function NotificationDrawer() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    byCategory,
    isLoading,
    isScanning,
    isOpen,
    filterCategory,
    setOpen,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    scanNow,
    setFilterCategory,
  } = useNotificationStore();

  if (!isOpen) return null;

  const filteredNotifications = notifications.filter((n) => {
    if (filterCategory === 'ALL') return true;
    return n.category === filterCategory;
  });

  const handleActionClick = (actionUrl?: string | null, id?: number) => {
    if (id) {
      markAsRead(id);
    }
    if (actionUrl) {
      navigate(actionUrl);
      setOpen(false);
    }
  };

  const getCategoryIcon = (category: NotificationCategory) => {
    switch (category) {
      case 'STOCK':
        return <Package className="w-4 h-4 text-amber-400" />;
      case 'DEBT':
        return <Coins className="w-4 h-4 text-red-400" />;
      case 'RESERVATION':
        return <Bookmark className="w-4 h-4 text-gold" />;
      default:
        return <Bell className="w-4 h-4 text-blue-400" />;
    }
  };

  const getSeverityBadge = (severity: NotificationSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/15 border border-red-500/30 text-red-400 flex items-center gap-1">
            <AlertTriangle className="w-2.5 h-2.5" />
            Critique
          </span>
        );
      case 'WARNING':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            Alerte
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center gap-1">
            <Info className="w-2.5 h-2.5" />
            Info
          </span>
        );
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMinutes < 1) return "À l'instant";
      if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;
      if (diffHours < 24) return `Il y a ${diffHours} h`;
      if (diffDays === 1) return 'Hier';
      return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 z-[150] overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-fadeIn"
        onClick={() => setOpen(false)}
      />

      {/* Slide-over panel */}
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-surface border-l border-border shadow-2xl flex flex-col animate-slideInRight">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-border bg-surface-alt flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gold/15 border border-gold-border flex items-center justify-center text-gold shadow-sm">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-text leading-tight">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-danger text-white">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-muted mt-0.5">Alertes stock, dettes et réservations</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={scanNow}
                disabled={isScanning}
                title="Scanner les alertes maintenant"
                className="p-2 rounded-lg text-text-muted hover:text-gold hover:bg-gold/10 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin text-gold' : ''}`} />
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  title="Tout marquer comme lu"
                  className="p-2 rounded-lg text-text-muted hover:text-gold hover:bg-gold/10 transition-colors cursor-pointer"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => clearAllNotifications(filterCategory === 'ALL' ? undefined : filterCategory)}
                  className="group relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/25 transition-all duration-200 cursor-pointer"
                  title="Clear all"
                >
                  <Trash2 className="w-4 h-4 text-text-muted group-hover:text-red-400 transition-colors flex-shrink-0" strokeWidth={2.5} />
                  <span className="text-[11px] font-bold text-red-400 max-w-0 opacity-0 group-hover:max-w-20 group-hover:opacity-100 overflow-hidden whitespace-nowrap transition-all duration-200 ease-out">
                    Clear all
                  </span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="px-4 py-2.5 bg-surface-elevated/40 border-b border-border flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setFilterCategory('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                filterCategory === 'ALL'
                  ? 'bg-gold text-black shadow-sm'
                  : 'bg-surface-alt hover:bg-surface-hover text-text-muted hover:text-text'
              }`}
            >
              Tous
              <span className="text-[10px] opacity-80">({notifications.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterCategory('STOCK')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                filterCategory === 'STOCK'
                  ? 'bg-gold text-black shadow-sm'
                  : 'bg-surface-alt hover:bg-surface-hover text-text-muted hover:text-text'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              Stock
              {byCategory.STOCK > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-black">
                  {byCategory.STOCK}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setFilterCategory('DEBT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                filterCategory === 'DEBT'
                  ? 'bg-gold text-black shadow-sm'
                  : 'bg-surface-alt hover:bg-surface-hover text-text-muted hover:text-text'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              Dettes
              {byCategory.DEBT > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-red-500 text-white">
                  {byCategory.DEBT}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setFilterCategory('RESERVATION')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                filterCategory === 'RESERVATION'
                  ? 'bg-gold text-black shadow-sm'
                  : 'bg-surface-alt hover:bg-surface-hover text-text-muted hover:text-text'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              Réservations
              {byCategory.RESERVATION > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-gold text-black">
                  {byCategory.RESERVATION}
                </span>
              )}
            </button>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isLoading && notifications.length === 0 ? (
              <div className="py-16 text-center text-text-muted flex flex-col items-center gap-3">
                <RefreshCw className="w-8 h-8 text-gold animate-spin" />
                <p className="text-xs">Actualisation des alertes en cours...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="py-20 text-center flex flex-col items-center justify-center p-6 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-base font-bold text-text">Tout est sous contrôle !</h4>
                <p className="text-xs text-text-muted max-w-xs leading-relaxed">
                  {filterCategory === 'ALL'
                    ? 'Aucune alerte critique pour le moment. Vos stocks, créances clients et réservations sont à jour.'
                    : `Aucune notification dans la catégorie ${filterCategory.toLowerCase()}.`}
                </p>
                <button
                  type="button"
                  onClick={scanNow}
                  className="mt-2 px-3.5 py-1.5 bg-surface-alt hover:bg-surface-hover border border-border rounded-lg text-xs font-semibold text-text flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                  Vérifier maintenant
                </button>
              </div>
            ) : (
              filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    notification.is_read
                      ? 'bg-surface-alt/40 border-border/60 opacity-75'
                      : 'bg-surface-alt border-gold-border/40 shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-surface border border-border flex items-center justify-center flex-shrink-0">
                        {getCategoryIcon(notification.category)}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {getSeverityBadge(notification.severity)}
                        <span className="text-[11px] text-text-muted">
                          {formatRelativeTime(notification.created_at)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {!notification.is_read && (
                        <button
                          type="button"
                          onClick={() => markAsRead(notification.id)}
                          title="Marquer comme lu"
                          className="p-1 rounded text-text-muted hover:text-gold hover:bg-gold/10 transition-colors cursor-pointer"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteNotification(notification.id)}
                        title="Supprimer la notification"
                        className="p-1 rounded text-text-muted hover:text-red-400 hover:bg-danger/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h5 className="text-xs font-bold text-text mt-2 leading-tight">
                    {notification.title}
                  </h5>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    {notification.message}
                  </p>

                  {notification.action_url && (
                    <div className="mt-3 pt-2 border-t border-border/40 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleActionClick(notification.action_url, notification.id)}
                        className="px-2.5 py-1 bg-gold/15 hover:bg-gold/25 border border-gold-border text-gold rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <span>Consulter</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {filteredNotifications.length > 0 && (
            <div className="p-3 bg-surface border-t border-border flex items-center justify-between text-xs text-text-muted">
              <span>{filteredNotifications.length} alerte(s) listée(s)</span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="font-semibold text-gold hover:underline cursor-pointer"
                >
                  Tout marquer comme lu
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
