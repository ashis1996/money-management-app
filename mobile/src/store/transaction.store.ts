import { create } from 'zustand';
import { Transaction } from '@/types';
import { transactionsApi } from '@/services/api';

interface TransactionState {
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;

  // Actions
  fetchTransactions: (params?: { from?: string; to?: string; category?: string }) => Promise<void>;
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (id: string, data: Partial<Transaction>) => void;
  removeTransaction: (id: string) => void;
  clearTransactions: () => void;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  isLoading: false,
  error: null,
  hasMore: true,

  fetchTransactions: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const response = await transactionsApi.getAll(params);
      set({
        transactions: response.data || [],
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Failed to fetch transactions',
        isLoading: false,
      });
    }
  },

  addTransaction: (transaction: Transaction) => {
    set((state) => ({
      transactions: [transaction, ...state.transactions],
    }));
  },

  updateTransaction: (id: string, data: Partial<Transaction>) => {
    set((state) => ({
      transactions: state.transactions.map((t) =>
        t.id === id ? { ...t, ...data } : t
      ),
    }));
  },

  removeTransaction: (id: string) => {
    set((state) => ({
      transactions: state.transactions.filter((t) => t.id !== id),
    }));
  },

  clearTransactions: () => {
    set({ transactions: [], hasMore: true });
  },
}));
