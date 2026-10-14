import client from './client';

export interface Exchange {
  id: number;
  exchange_number: string;
  customer: number | null;
  customer_name: string;
  customer_phone: string;

  trade_in_product: number;
  trade_in_product_name: string;
  trade_in_imei: string;
  trade_in_condition: string;
  trade_in_battery_health: number | null;
  trade_in_device_item: number | null;

  new_device: number;
  new_device_product_name?: string;
  new_device_imei_1: string;
  new_device_serial_number: string;

  trade_in_value: string;
  new_device_price: string;
  difference_amount: string;
  financial_direction: 'CUSTOMER_PAYS' | 'STORE_REFUNDS' | 'EVEN';

  status: 'REQUESTED' | 'UNDER_REVIEW' | 'APPROVED' | 'COMPLETED' | 'REJECTED';
  reason?: string;
  owner_notes?: string;

  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: number | null;
  reviewed_by_name: string | null;
  approved_at: string | null;
  approved_by: number | null;
  approved_by_name: string | null;
  completed_at: string | null;
  completed_by: number | null;
  completed_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateExchangeRequest {
  customer_id?: number | null;
  customer_name: string;
  customer_phone: string;

  trade_in_product_id: number;
  trade_in_imei: string;
  trade_in_condition: string;
  trade_in_battery_health?: number | null;
  trade_in_value: string | number;

  new_device_id: number;
  new_device_price: string | number;
  reason?: string;
}

export const exchangeApi = {
  getExchanges: async (): Promise<Exchange[]> => {
    const response = await client.get('/exchanges/');
    return response.data;
  },

  getExchange: async (exchangeId: string | number): Promise<Exchange> => {
    const response = await client.get(`/exchanges/${exchangeId}/`);
    return response.data;
  },

  createExchange: async (data: CreateExchangeRequest): Promise<Exchange> => {
    const response = await client.post('/exchanges/', data);
    return response.data;
  },

  submitExchange: async (exchangeId: string | number): Promise<Exchange> => {
    const response = await client.post(`/exchanges/${exchangeId}/submit/`);
    return response.data;
  },

  approveExchange: async (exchangeId: string | number, ownerNotes?: string): Promise<Exchange> => {
    const response = await client.post(`/exchanges/${exchangeId}/approve/`, { owner_notes: ownerNotes });
    return response.data;
  },

  rejectExchange: async (exchangeId: string | number, reason?: string): Promise<Exchange> => {
    const response = await client.post(`/exchanges/${exchangeId}/reject/`, { reason });
    return response.data;
  },

  createPayment: async (exchangeId: string | number, data: { amount: string | number; method: 'CASH' | 'BANK_TRANSFER'; reference?: string }): Promise<any> => {
    const response = await client.post(`/exchanges/${exchangeId}/payment/`, data);
    return response.data;
  },

  getPaymentStatus: async (exchangeId: string | number): Promise<{
    exchange_id: number;
    transaction: any;
    confirmed_amount: string;
    fully_paid: boolean;
  }> => {
    const response = await client.get(`/exchanges/${exchangeId}/payment-status/`);
    return response.data;
  },

  createRefund: async (exchangeId: string | number, data: {
    method: 'CASH' | 'BANK_TRANSFER';
    reference?: string;
    reason?: string;
    notes?: string;
  }): Promise<any> => {
    const response = await client.post(`/exchanges/${exchangeId}/refund/`, data);
    return response.data;
  },

  completeRefund: async (refundId: string | number): Promise<any> => {
    const response = await client.post(`/exchanges/refunds/${refundId}/complete/`);
    return response.data;
  },

  completeExchange: async (exchangeId: string | number): Promise<{ exchange: Exchange }> => {
    const response = await client.post(`/exchanges/${exchangeId}/complete/`);
    return response.data;
  },
};
