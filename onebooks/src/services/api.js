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
  login: (companyName) => api.post('/auth/login', { company_name: companyName }),
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
  getAll: (params) => {
    if (isDemoMode()) {
      return Promise.reject(new Error('Demo mode'));
    }
    return api.get('/expenses', { params });
  },
  create: (data) => api.post('/expenses', data),
  update: (id, data) => api.put(`/expenses/${id}`, data),
  delete: (id) => api.delete(`/expenses/${id}`),
  getCategories: () => {
    if (isDemoMode()) {
      return Promise.reject(new Error('Demo mode'));
    }
    return api.get('/expenses/categories/list');
  },
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
  exportProfitLoss: (format) => api.get(`/reports/profit-loss/export?format=${format}`, { responseType: 'blob' }),
  exportBalanceSheet: (format) => api.get(`/reports/balance-sheet/export?format=${format}`, { responseType: 'blob' }),
  exportCashFlow: (format) => api.get(`/reports/cash-flow/export?format=${format}`, { responseType: 'blob' }),
};

export default api;