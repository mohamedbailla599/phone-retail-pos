import client from './client';

export interface Customer {
  id: number;
  full_name: string;
  phone_number: string;
  notes?: string;
  address?: string;
  current_debt: string;
  credit_limit: string;
  total_spent: string;
  transactions_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface CustomerDebtPayment {
  id: number;
  amount: string;
  payment_method: string;
  notes: string;
  operator_name: string;
  created_at: string;
}

export interface CustomerDetail extends Customer {
  debt_payments: CustomerDebtPayment[];
  recent_transactions: Array<{
    id: number;
    receipt_id: string;
    transaction_type: string;
    status: string;
    total_amount: string;
    created_at: string;
  }>;
}

export interface CustomerStats {
  total_debt: string;
  customers_with_debt_count: number;
  total_customers_count: number;
  repayments_month: string;
}

export const customersApi = {
  getCustomers: async (params?: string | { search?: string; has_debt?: boolean }) => {
    const queryParams = typeof params === 'string' ? { search: params } : params;
    const res = await client.get<Customer[]>('/customers/', { params: queryParams });
    return res.data;
  },

  getCustomer: async (id: number) => {
    const res = await client.get<CustomerDetail>(`/customers/${id}/`);
    return res.data;
  },

  getCustomerStats: async () => {
    const res = await client.get<CustomerStats>('/customers/stats/');
    return res.data;
  },

  createCustomer: async (data: {
    full_name: string;
    phone_number: string;
    address?: string;
    notes?: string;
    credit_limit?: string;
  }) => {
    const res = await client.post<Customer>('/customers/', data);
    return res.data;
  },

  updateCustomer: async (id: number, data: Partial<Customer>) => {
    const res = await client.put<Customer>(`/customers/${id}/`, data);
    return res.data;
  },

  recordDebtPayment: async (
    id: number,
    data: {
      amount: string;
      payment_method?: string;
      notes?: string;
    }
  ) => {
    const res = await client.post<{
      message: string;
      payment: CustomerDebtPayment;
      customer: Customer;
    }>(`/customers/${id}/debt-payments/`, data);
    return res.data;
  },
};

export const customerApi = customersApi;
