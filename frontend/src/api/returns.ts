import client from './client';

export interface ReturnItem {
  id: number;
  transaction_item: number;
  product_name: string;
  sku: string;
  is_device: boolean;
  identifier: string;
  quantity: number;
  unit_refund_amount: string;
  line_total: string;
}

export type ReturnStatus = 'REQUESTED' | 'APPROVED' | 'RESTOCKED' | 'REJECTED' | 'REFUNDED';

export interface ReturnRecord {
  id: number;
  return_number: string;
  transaction: number;
  receipt_id: string;
  customer: number | null;
  customer_name: string;
  customer_phone: string;
  status: ReturnStatus;
  reason: string;
  total_amount: string;
  created_at: string;
  completed_at: string | null;
  created_by: number;
  created_by_name: string;
  approved_by: number | null;
  approved_by_name: string;
  items: ReturnItem[];
}

export interface CreateReturnPayload {
  transaction_id: number;
  transaction_item_id: number;
  quantity: number;
  reason?: string;
}

export type RefundMethod = 'CASH' | 'BANK_TRANSFER';
export type RefundStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

export interface RefundPaymentAllocation {
  id: number;
  payment: number;
  amount: string;
  allocated_at: string;
}

export interface RefundRecord {
  id: number;
  refund_number: string;
  customer: number | null;
  customer_name: string;
  customer_phone: string;
  source_type: 'RETURN' | 'EXCHANGE' | 'RESERVATION' | 'OVERPAYMENT' | 'WARRANTY';
  source_id: number;
  source_label: string;
  amount: string;
  method: RefundMethod;
  status: RefundStatus;
  reference?: string | null;
  reason: string;
  notes?: string | null;
  requested_at: string;
  requested_by: number;
  requested_by_name: string;
  approved_at?: string | null;
  approved_by?: number | null;
  approved_by_name: string;
  completed_at?: string | null;
  completed_by?: number | null;
  completed_by_name: string;
  rejected_at?: string | null;
  rejected_by?: number | null;
  rejected_by_name: string;
  allocations: RefundPaymentAllocation[];
}

export interface CreateRefundPayload {
  customer_id: number;
  source_type: string;
  source_id: number;
  amount: number | string;
  method: RefundMethod;
  reason?: string;
  reference?: string;
  notes?: string;
}

export const returnsApi = {
  // Returns endpoints
  getReturns: async (): Promise<ReturnRecord[]> => {
    const response = await client.get<ReturnRecord[]>('/returns/');
    return response.data;
  },

  getReturn: async (id: number): Promise<ReturnRecord> => {
    const response = await client.get<ReturnRecord>(`/returns/${id}/`);
    return response.data;
  },

  createReturn: async (payload: CreateReturnPayload): Promise<ReturnRecord> => {
    const response = await client.post<ReturnRecord>('/returns/create/', payload);
    return response.data;
  },

  approveReturn: async (id: number): Promise<ReturnRecord> => {
    const response = await client.post<ReturnRecord>(`/returns/${id}/approve/`);
    return response.data;
  },

  restockReturn: async (id: number, reason?: string): Promise<ReturnRecord> => {
    const response = await client.post<ReturnRecord>(`/returns/${id}/process-device/`, { reason });
    return response.data;
  },

  rejectReturn: async (id: number, reason?: string): Promise<ReturnRecord> => {
    const response = await client.post<ReturnRecord>(`/returns/${id}/reject/`, { reason });
    return response.data;
  },

  // Refunds endpoints
  getRefunds: async (): Promise<RefundRecord[]> => {
    const response = await client.get<RefundRecord[]>('/refunds/');
    return response.data;
  },

  getRefund: async (id: number): Promise<RefundRecord> => {
    const response = await client.get<RefundRecord>(`/refunds/${id}/`);
    return response.data;
  },

  createRefund: async (payload: CreateRefundPayload): Promise<RefundRecord> => {
    const response = await client.post<RefundRecord>('/refunds/create/', payload);
    return response.data;
  },

  approveRefund: async (id: number): Promise<RefundRecord> => {
    const response = await client.post<RefundRecord>(`/refunds/${id}/approve/`);
    return response.data;
  },

  completeRefund: async (id: number): Promise<RefundRecord> => {
    const response = await client.post<RefundRecord>(`/refunds/${id}/complete/`);
    return response.data;
  },

  rejectRefund: async (id: number, reason?: string): Promise<RefundRecord> => {
    const response = await client.post<RefundRecord>(`/refunds/${id}/reject/`, { reason });
    return response.data;
  },
};
