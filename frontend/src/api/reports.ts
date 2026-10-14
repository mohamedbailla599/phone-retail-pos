import client from './client';

export interface ZReportSale {
  id: number;
  receipt_id: string;
  customer_name: string;
  customer_phone: string;
  total_amount: string;
  discount_amount: string;
  cash_amount: string;
  transfer_amount: string;
  debt_amount: string;
  items_count: number;
  created_at: string;
  operator: string;
}

export interface ZReportDebtPayment {
  id: number;
  customer_name: string;
  customer_phone: string;
  amount: string;
  payment_method: 'CASH' | 'BANK_TRANSFER' | string;
  notes: string;
  created_at: string;
  operator: string;
}

export interface ZReportTopProduct {
  name: string;
  sku: string;
  quantity: number;
  revenue: string;
  profit: string;
}

export interface ZReportData {
  period: {
    start_date: string;
    end_date: string;
    generated_at: string;
    is_single_day: boolean;
  };
  kpi: {
    total_revenue: string;
    subtotal: string;
    total_discount: string;
    sales_count: number;
    average_basket: string;
    cash_in_drawer: string;
    direct_cash: string;
    debt_cash: string;
    total_bank_transfer: string;
    direct_transfer: string;
    debt_transfer: string;
    total_real_collected: string;
    new_debt_granted: string;
    total_debt_recovered: string;
    total_cogs: string;
    gross_profit: string;
    margin_percent: string;
  };
  breakdown: {
    devices: {
      units: number;
      revenue: string;
      cost: string;
      profit: string;
    };
    accessories: {
      units: number;
      revenue: string;
      cost: string;
      profit: string;
    };
  };
  top_products: ZReportTopProduct[];
  sales: ZReportSale[];
  debt_repayments: ZReportDebtPayment[];
}

export const reportsApi = {
  getZReport: async (startDate?: string, endDate?: string): Promise<ZReportData> => {
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await client.get('/sales/reports/z-report/', { params });
    return response.data;
  },
};
