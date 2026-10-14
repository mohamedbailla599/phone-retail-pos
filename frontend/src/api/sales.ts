import client from './client';

export interface CatalogItem {
  id: number;
  name: string;
  sub: string;
  price: string;
  type: 'device' | 'accessory';
  stock_count: number;
}

export interface Transaction {
  id: number;
  receipt_id: string;
  customer_id: number | null;
  customer_name?: string;
  customer_phone?: string;
  transaction_type: string;
  status: string;
  total_amount: string;
  created_at: string;
}

export const posApi = {
  getTransactions: async (params?: { customer_id?: number; status?: string; transaction_type?: string; search?: string }): Promise<Transaction[]> => {
    const response = await client.get('/sales/', { params });
    return response.data;
  },

  getCatalog: async (): Promise<CatalogItem[]> => {
    const response = await client.get('/sales/pos-catalog/');
    return response.data;
  },

  createDraftSale: async (): Promise<{ id: number; receipt_id: string }> => {
    const response = await client.post('/sales/', {});
    return response.data;
  },

  getTransaction: async (transactionId: string | number): Promise<any> => {
    const response = await client.get(`/sales/${transactionId}/`);
    return response.data;
  },

  addItemToSale: async (transactionId: string | number, productId: number): Promise<any> => {
    const response = await client.post(`/sales/${transactionId}/items/`, { product_id: productId });
    return response.data;
  },

  removeItem: async (transactionId: string | number, itemId: number, quantity?: number): Promise<any> => {
    const url = quantity ? `/sales/${transactionId}/items/${itemId}/?quantity=${quantity}` : `/sales/${transactionId}/items/${itemId}/`;
    const response = await client.delete(url);
    return response.data;
  },

  setDiscount: async (transactionId: string | number, discountAmount: number | string): Promise<any> => {
    const response = await client.post(`/sales/${transactionId}/discount/`, { discount_amount: discountAmount });
    return response.data;
  },

  checkout: async (transactionId: string | number): Promise<any> => {
    const response = await client.post(`/sales/${transactionId}/checkout/`, {});
    return response.data;
  },

  cancelCheckout: async (transactionId: string | number): Promise<any> => {
    const response = await client.post(`/sales/${transactionId}/cancel-checkout/`, {});
    return response.data;
  },

  cancelSale: async (transactionId: string | number): Promise<any> => {
    const response = await client.post(`/sales/${transactionId}/cancel/`, {});
    return response.data;
  },

  assignCustomer: async (transactionId: string | number, customerId: number | null): Promise<any> => {
    const response = await client.post(`/sales/${transactionId}/customer/`, { customer_id: customerId });
    return response.data;
  },

  addPayment: async (
    transactionId: string | number,
    amount: string,
    method: 'CASH' | 'BANK_TRANSFER' | 'DEBT'
  ): Promise<any> => {
    const response = await client.post(`/sales/${transactionId}/payments/`, { amount, method });
    return response.data;
  },

  completeSale: async (transactionId: string | number): Promise<any> => {
    const response = await client.post(`/sales/${transactionId}/complete/`, {});
    return response.data;
  },

  confirmPayment: async (transactionId: string | number, paymentId: string | number): Promise<any> => {
    const response = await client.post(`/sales/${transactionId}/payments/${paymentId}/confirm/`, {});
    return response.data;
  },

  rejectPayment: async (transactionId: string | number, paymentId: string | number): Promise<any> => {
    const response = await client.post(`/sales/${transactionId}/payments/${paymentId}/reject/`, {});
    return response.data;
  },
};
