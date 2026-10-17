import client from './client';

export interface StoreSettings {
  id: number;
  store_name: string;
  phone_number: string;
  address: string;
  currency: string;
  receipt_prefix: string;
  receipt_footer_message: string;
  owner_email?: string;
  daily_digest_enabled?: boolean;
  daily_digest_time?: string;
  default_device_warranty_months: number;
  default_accessory_warranty_months: number;
  default_reservation_months: number;
  updated_by?: number;
  updated_by_name?: string;
  updated_at?: string;
}

export interface Operator {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  display_name: string;
  role: string;
  is_active: boolean;
  is_pos_account: boolean;
  is_pos_operator: boolean;
  date_joined: string;
  last_login: string | null;
}

export interface CreateOperatorPayload {
  username: string;
  first_name: string;
  last_name?: string;
  role?: string;
  password?: string;
}

export interface UpdateOperatorPayload {
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
  password?: string;
}

export const settingsApi = {
  getSettings: async () => {
    const { data } = await client.get<StoreSettings>('/settings/');
    return data;
  },

  updateSettings: async (settings: Partial<StoreSettings>) => {
    const { data } = await client.patch<StoreSettings>('/settings/', settings);
    return data;
  },

  getOperators: async () => {
    const { data } = await client.get<Operator[]>('/auth/operators/manage/');
    return data;
  },

  createOperator: async (payload: CreateOperatorPayload) => {
    const { data } = await client.post<Operator>('/auth/operators/create/', payload);
    return data;
  },

  updateOperator: async (id: number, payload: UpdateOperatorPayload) => {
    const { data } = await client.patch<Operator>(`/auth/operators/${id}/`, payload);
    return data;
  },
};
