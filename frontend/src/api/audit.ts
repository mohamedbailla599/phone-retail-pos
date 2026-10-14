import client from './client';

export interface AuditLog {
  id: number;
  actor: number;
  actor_name: string;
  actor_username: string;
  action: string;
  action_display: string;
  entity_type: string;
  entity_id: number;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  reason: string | null;
  created_at: string;
}

export interface AuditLogStats {
  total_logs: number;
  today_logs: number;
  categories: {
    sales: number;
    payments: number;
    stock: number;
    exchanges: number;
  };
  operators: Array<{
    id: number;
    name: string;
    username: string;
    role: string;
    log_count: number;
  }>;
  action_choices: Array<{
    value: string;
    label: string;
  }>;
}

export interface AuditLogParams {
  page?: number;
  page_size?: number;
  search?: string;
  action?: string;
  actor_id?: number | string;
  start_date?: string;
  end_date?: string;
}

export interface AuditLogResponse {
  count: number;
  total_pages: number;
  current_page: number;
  page_size: number;
  results: AuditLog[];
}

export const auditApi = {
  getLogs: async (params?: AuditLogParams): Promise<AuditLogResponse> => {
    const response = await client.get('/audit-logs/', { params });
    return response.data;
  },

  getStats: async (): Promise<AuditLogStats> => {
    const response = await client.get('/audit-logs/stats/');
    return response.data;
  },
};
