import client from './client';

export interface DashboardStats {
  today_revenue: string;
  today_sales_count: number;
  today_cash: string;
  today_transfer: string;
  devices_in_stock_count: number;
  devices_in_stock_value: string;
  devices_in_stock_cost: string;
  accessories_in_stock_count: number;
  low_stock_count: number;
  pending_exchanges_count: number;
  approved_exchanges_count: number;
  completed_exchanges_today_count: number;
  recent_sales: Array<{
    id: number;
    receipt_id: string;
    total_amount: string;
    created_at: string;
    customer_name: string;
    customer_phone: string;
    items_count: number;
    payment_methods: string[];
  }>;
  recent_exchanges: Array<{
    id: number;
    exchange_number: string;
    customer_name: string;
    trade_in_product_name: string;
    new_device_name: string;
    difference_amount: string;
    financial_direction: string;
    status: string;
    created_at: string;
  }>;
  low_stock_items: Array<{
    id: number;
    name: string;
    sku: string;
    quantity: number;
    reorder_level: number;
    selling_price: string;
  }>;
}

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const response = await client.get('/sales/dashboard/');
    return response.data;
  },
};
