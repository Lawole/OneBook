import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Check if in demo mode
const isDemoMode = () => {
  return localStorage.getItem('demoMode') === 'true';
};

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors - but not in demo mode
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isDemoMode()) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      localStorage.removeItem('demoMode');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (companyName, email, password, currency) => api.post('/auth/register', { company_name: companyName, email, password, base_currency: currency }),
};

export const dashboardAPI = {
  getStats: () => {
    if (isDemoMode()) {
      return Promise.reject(new Error('Demo mode'));
    }
    return api.get('/dashboard/stats');
  },
  getMonthlyTrend: () => {
    if (isDemoMode()) {
      return Promise.reject(new Error('Demo mode'));
    }
    return api.get('/dashboard/monthly-trend');
  },
};

export const customerAPI = {
  getAll: (params) => {
    if (isDemoMode()) {
      return Promise.reject(new Error('Demo mode'));
    }
    return api.get('/customers', { params });
  },
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
};

export const invoiceAPI = {
  getAll: (params) => {
    if (isDemoMode()) {
      return Promise.reject(new Error('Demo mode'));
    }
    return api.get('/invoices', { params });
  },
  create: (data) => api.post('/invoices', data),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  delete: (id) => api.delete(`/invoices/${id}`),
  downloadPDF: (id) => api.get(`/invoices/${id}/pdf`, { responseType: 'blob' }),
  sendEmail: (id) => api.post(`/invoices/${id}/send`),
};

export const itemAPI = {
  getAll: (params) => {
    if (isDemoMode()) {
      return Promise.reject(new Error('Demo mode'));
    }
    return api.get('/items', { params });
  },
  create: (data) => api.post('/items', data),
  update: (id, data) => api.put(`/items/${id}`, data),
  delete: (id) => api.delete(`/items/${id}`),
};

export const expenseAPI = {
  getAll: (params) => api.get('/expenses', { params }),
  create: (data) => api.post('/expenses', data),
  update: (id, data) => api.put(`/expenses/${id}`, data),
  delete: (id) => api.delete(`/expenses/${id}`),
  getCategories: () => api.get('/expenses/categories/list'),
};

export const vendorAPI = {
  getAll: (params) => {
    if (isDemoMode()) {
      return Promise.reject(new Error('Demo mode'));
    }
    return api.get('/vendors', { params });
  },
  create: (data) => api.post('/vendors', data),
  update: (id, data) => api.put(`/vendors/${id}`, data),
  delete: (id) => api.delete(`/vendors/${id}`),
};

export const reportAPI = {
  getProfitLoss: (params) => api.get('/reports/profit-loss', { params }),
  getBalanceSheet: () => api.get('/reports/balance-sheet'),
  getCashFlow: (params) => api.get('/reports/cash-flow', { params }),
  getSalesByCustomer: (params) => {
    if (isDemoMode()) return Promise.reject(new Error('Demo mode'));
    return api.get('/reports/sales-by-customer', { params });
  },
  getSalesByItem: (params) => {
    if (isDemoMode()) return Promise.reject(new Error('Demo mode'));
    return api.get('/reports/sales-by-item', { params });
  },
  getTrialBalance: (params) => {
    if (isDemoMode()) return Promise.reject(new Error('Demo mode'));
    return api.get('/reports/trial-balance', { params });
  },
  exportProfitLoss: (format, params) => api.get('/reports/profit-loss/export', { params: { format, ...params }, responseType: 'blob' }),
  exportBalanceSheet: (format) => api.get('/reports/balance-sheet/export', { params: { format }, responseType: 'blob' }),
  exportCashFlow: (format, params) => api.get('/reports/cash-flow/export', { params: { format, ...params }, responseType: 'blob' }),
};

export const accountAPI = {
  getAll: () => {
    if (isDemoMode()) return Promise.reject(new Error('Demo mode'));
    return api.get('/accountant/accounts');
  },
  create: (data) => api.post('/accountant/accounts', data),
  update: (id, data) => api.put(`/accountant/accounts/${id}`, data),
  delete: (id) => api.delete(`/accountant/accounts/${id}`),
};

export const journalAPI = {
  getAll: () => {
    if (isDemoMode()) return Promise.reject(new Error('Demo mode'));
    return api.get('/accountant/journals');
  },
  create: (data) => api.post('/accountant/journals', data),
  update: (id, data) => api.put(`/accountant/journals/${id}`, data),
  post: (id) => api.post(`/accountant/journals/${id}/post`),
  delete: (id) => api.delete(`/accountant/journals/${id}`),
};

export const budgetAPI = {
  getAll: () => {
    if (isDemoMode()) return Promise.reject(new Error('Demo mode'));
    return api.get('/accountant/budgets');
  },
  create: (data) => api.post('/accountant/budgets', data),
  update: (id, data) => api.put(`/accountant/budgets/${id}`, data),
  delete: (id) => api.delete(`/accountant/budgets/${id}`),
};

export const fxAPI = {
  getAll: () => {
    if (isDemoMode()) return Promise.reject(new Error('Demo mode'));
    return api.get('/accountant/fx-adjustments');
  },
  create: (data) => api.post('/accountant/fx-adjustments', data),
  update: (id, data) => api.put(`/accountant/fx-adjustments/${id}`, data),
  delete: (id) => api.delete(`/accountant/fx-adjustments/${id}`),
};

export const bulkAPI = {
  getRecords: (type, params) => {
    if (isDemoMode()) return Promise.reject(new Error('Demo mode'));
    return api.get(`/accountant/${type}`, { params });
  },
  applyBulk: (type, ids, action, value) => api.post('/accountant/bulk-apply', { type, ids, action, value }),
};

export const creditNoteAPI = {
  getAll: (params) => api.get('/credit-notes', { params }),
  create: (data) => api.post('/credit-notes', data),
  delete: (id) => api.delete(`/credit-notes/${id}`),
  downloadPDF: (id) => api.get(`/credit-notes/${id}/pdf`, { responseType: 'blob' }),
};

export const uploadAPI = {
  avatar: (file, type, entityId) => {
    const form = new FormData();
    form.append('avatar', file);
    form.append('type', type);
    if (entityId) form.append('id', entityId);
    return api.post('/upload/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

export const bankingAPI = {
  getAccounts: () => api.get('/banking/accounts'),
  createAccount: (data) => api.post('/banking/accounts', data),
  updateAccount: (id, data) => api.put(`/banking/accounts/${id}`, data),
  deleteAccount: (id) => api.delete(`/banking/accounts/${id}`),
  importStatement: (accountId, file) => {
    const form = new FormData();
    form.append('statement', file);
    return api.post(`/banking/accounts/${accountId}/import`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  getTransactions: (params) => api.get('/banking/transactions', { params }),
  updateTransaction: (id, data) => api.put(`/banking/transactions/${id}`, data),
  deleteTransaction: (id) => api.delete(`/banking/transactions/${id}`),
  getMatchSuggestions: (id) => api.get(`/banking/match-suggestions/${id}`),
};

export default api;