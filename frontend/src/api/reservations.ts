import client from './client';

export interface ReservationPayment {
  id: number;
  amount: string;
  method: 'CASH' | 'BANK_TRANSFER' | 'DEBT';
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'REFUNDED';
  reference?: string | null;
  created_at: string;
  confirmed_at?: string | null;
  created_by_name: string;
}

export interface Reservation {
  id: number;
  reservation_number: string;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
  customer: number;
  customer_name: string;
  customer_phone: string;
  customer_current_debt?: string;
  device: number;
  device_imei: string;
  device_name: string;
  device_brand: string;
  device_model: string;
  device_color: string;
  device_battery?: number;
  device_storage?: string;
  device_status: string;
  transaction: number;
  receipt_id: string;
  reserved_price: string;
  paid_amount: string;
  remaining_balance: string;
  payments: ReservationPayment[];
  reserved_at: string;
  expires_at: string;
  notes?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: number | null;
  cancelled_by_name?: string;
  completed_at?: string | null;
  completed_by?: number | null;
  completed_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ReservationStats {
  active_count: number;
  expiring_soon_count: number;
  completed_count: number;
  cancelled_count: number;
  total_deposits_held: string;
}

export interface CreateReservationPayload {
  customer_id: number;
  device_id: number;
  reserved_price?: number | string;
  duration_days?: number;
  expires_at?: string;
  deposit_amount?: number | string;
  deposit_method?: 'CASH' | 'BANK_TRANSFER' | 'DEBT';
  deposit_reference?: string;
  notes?: string;
}

export interface CompleteReservationPayload {
  payment_amount?: number | string;
  payment_method?: 'CASH' | 'BANK_TRANSFER' | 'DEBT';
  payment_reference?: string;
}

export interface CancelReservationPayload {
  reason?: string;
  refund_deposit?: boolean;
  refund_method?: 'CASH' | 'BANK_TRANSFER';
}

export interface AddPaymentPayload {
  amount: number | string;
  method: 'CASH' | 'BANK_TRANSFER' | 'DEBT';
  reference?: string;
}

export const reservationsApi = {
  getReservations: async (params?: { status?: string; search?: string }) => {
    const res = await client.get<Reservation[]>('/reservations/', { params });
    return res.data;
  },

  getStats: async () => {
    const res = await client.get<ReservationStats>('/reservations/stats/');
    return res.data;
  },

  getDetail: async (id: number) => {
    const res = await client.get<Reservation>(`/reservations/${id}/`);
    return res.data;
  },

  createReservation: async (data: CreateReservationPayload) => {
    const res = await client.post<Reservation>('/reservations/', data);
    return res.data;
  },

  completeReservation: async (id: number, data: CompleteReservationPayload) => {
    const res = await client.post<Reservation>(`/reservations/${id}/complete/`, data);
    return res.data;
  },

  cancelReservation: async (id: number, data: CancelReservationPayload) => {
    const res = await client.post<Reservation>(`/reservations/${id}/cancel/`, data);
    return res.data;
  },

  addPayment: async (id: number, data: AddPaymentPayload) => {
    const res = await client.post<Reservation>(`/reservations/${id}/payments/`, data);
    return res.data;
  },
};
