import { create } from 'zustand';

export interface CartItem {
  id: number;
  type: 'device' | 'accessory';
  name: string;
  product_id?: number;
  identifier?: string;
  sku?: string;
  price: string;
  quantity?: number;
}

export interface TransactionCustomer {
  id: number;
  full_name: string;
  phone_number: string;
  current_debt: string;
  credit_limit: string;
}

export interface TransactionState {
  id: number;
  receipt_id: string;
  status: string;
  subtotal: string;
  discount_amount: string;
  total_amount: string;
  items: CartItem[];
  confirmed_paid: string;
  pending_payments?: any[];
  confirmed_payments?: any[];
  customer?: TransactionCustomer | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  operator_name?: string;
}

interface PosState {
  transaction: TransactionState | null;
  operator: string | null;
  setTransaction: (t: TransactionState | null) => void;
  setOperator: (op: string) => void;
  clearCart: () => void;
}

import { persist } from 'zustand/middleware';

export const usePosStore = create<PosState>()(
  persist(
    (set) => ({
      transaction: null,
      operator: null,
      setTransaction: (t) => set({ transaction: t }),
      setOperator: (op) => set({ operator: op }),
      clearCart: () => set({ transaction: null }),
    }),
    {
      name: 'pos-storage',
      // Only persist the transaction ID to remain compliant with backend as source of truth
      partialize: (state) => ({ 
        transaction: state.transaction?.id ? { id: state.transaction.id } as TransactionState : null 
      }),
    }
  )
);
