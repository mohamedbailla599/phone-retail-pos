import { create } from 'zustand';
import {
  notificationsApi,
  type NotificationItem,
  type NotificationCategory,
} from '../api/notifications';

interface NotificationStore {
  notifications: NotificationItem[];
  unreadCount: number;
  byCategory: {
    STOCK: number;
    DEBT: number;
    RESERVATION: number;
    SYSTEM: number;
  };
  isLoading: boolean;
  isScanning: boolean;
  isOpen: boolean;
  filterCategory: NotificationCategory | 'ALL';
  lastFetchedAt: number | null;

  fetchNotifications: (silent?: boolean) => Promise<void>;
  markAsRead: (id: number) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: number) => Promise<void>;
  scanNow: () => Promise<void>;
  setOpen: (isOpen: boolean) => void;
  toggleOpen: () => void;
  setFilterCategory: (category: NotificationCategory | 'ALL') => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  byCategory: {
    STOCK: 0,
    DEBT: 0,
    RESERVATION: 0,
    SYSTEM: 0,
  },
  isLoading: false,
  isScanning: false,
  isOpen: false,
  filterCategory: 'ALL',
  lastFetchedAt: null,

  fetchNotifications: async (silent = false) => {
    if (!silent) set({ isLoading: true });
    try {
      const data = await notificationsApi.getNotifications();
      set({
        notifications: data.results,
        unreadCount: data.unread_count,
        byCategory: data.by_category,
        isLoading: false,
        lastFetchedAt: Date.now(),
      });
    } catch (err) {
      console.error('Failed to fetch notifications', err);
      set({ isLoading: false });
    }
  },

  markAsRead: async (id: number) => {
    // Optimistic update
    const prevNotifications = get().notifications;
    const item = prevNotifications.find((n) => n.id === id);
    if (!item || item.is_read) return;

    set({
      notifications: prevNotifications.map((n) =>
        n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
      ),
      unreadCount: Math.max(0, get().unreadCount - 1),
      byCategory: {
        ...get().byCategory,
        [item.category]: Math.max(0, (get().byCategory[item.category] || 1) - 1),
      },
    });

    try {
      await notificationsApi.markRead(id);
    } catch (err) {
      console.error('Failed to mark notification as read', err);
      // Revert if error
      set({ notifications: prevNotifications });
    }
  },

  markAllAsRead: async () => {
    const prevNotifications = get().notifications;
    const prevUnreadCount = get().unreadCount;

    set({
      notifications: prevNotifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
      byCategory: { STOCK: 0, DEBT: 0, RESERVATION: 0, SYSTEM: 0 },
    });

    try {
      await notificationsApi.markAllRead();
    } catch (err) {
      console.error('Failed to mark all notifications as read', err);
      set({ notifications: prevNotifications, unreadCount: prevUnreadCount });
    }
  },

  deleteNotification: async (id: number) => {
    const prev = get().notifications;
    const target = prev.find((n) => n.id === id);
    if (!target) return;

    const wasUnread = !target.is_read;
    set({
      notifications: prev.filter((n) => n.id !== id),
      unreadCount: wasUnread ? Math.max(0, get().unreadCount - 1) : get().unreadCount,
      byCategory: wasUnread
        ? {
            ...get().byCategory,
            [target.category]: Math.max(0, (get().byCategory[target.category] || 1) - 1),
          }
        : get().byCategory,
    });

    try {
      await notificationsApi.deleteNotification(id);
    } catch (err) {
      console.error('Failed to delete notification', err);
      set({ notifications: prev });
    }
  },

  scanNow: async () => {
    set({ isScanning: true });
    try {
      await notificationsApi.scan();
      await get().fetchNotifications(true);
    } catch (err) {
      console.error('Failed to trigger notification scan', err);
    } finally {
      set({ isScanning: false });
    }
  },

  setOpen: (isOpen) => set({ isOpen }),
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
  setFilterCategory: (category) => set({ filterCategory: category }),
}));
