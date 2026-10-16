import client from './client';

export type NotificationCategory = 'STOCK' | 'DEBT' | 'RESERVATION' | 'SYSTEM';
export type NotificationSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface NotificationItem {
  id: number;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  message: string;
  reference_type?: string | null;
  reference_id?: string | null;
  action_url?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface NotificationsResponse {
  unread_count: number;
  by_category: {
    STOCK: number;
    DEBT: number;
    RESERVATION: number;
    SYSTEM: number;
  };
  results: NotificationItem[];
}

export const notificationsApi = {
  getNotifications: async (params?: { category?: string; is_read?: boolean }): Promise<NotificationsResponse> => {
    const res = await client.get('/notifications/', { params });
    return res.data;
  },

  markRead: async (id: number): Promise<NotificationItem> => {
    const res = await client.post(`/notifications/${id}/mark-read/`);
    return res.data;
  },

  markAllRead: async (): Promise<{ marked_read_count: number; status: string }> => {
    const res = await client.post('/notifications/mark-all-read/');
    return res.data;
  },

  scan: async (): Promise<{ scan_results: any; unread_count: number; status: string }> => {
    const res = await client.post('/notifications/scan/');
    return res.data;
  },

  deleteNotification: async (id: number): Promise<void> => {
    await client.delete(`/notifications/${id}/`);
  },

  clearAll: async (category?: string): Promise<{ deleted_count: number; status: string }> => {
    const res = await client.post('/notifications/clear-all/', {}, { params: category ? { category } : {} });
    return res.data;
  },

  sendDigest: async (payload?: { email?: string; preview_only?: boolean }): Promise<any> => {
    const res = await client.post('/notifications/send-digest/', payload || {});
    return res.data;
  },
};

