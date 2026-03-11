export const mockCustomers = [
  { id: 1, name: 'John Doe', email: 'john@example.com', company_name: 'Acme Corp', phone: '555-0101', total_invoiced: 15000 },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', company_name: 'Tech Solutions', phone: '555-0102', total_invoiced: 28000 },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', company_name: 'Global Inc', phone: '555-0103', total_invoiced: 12500 },
];

export const mockInvoices = [
  { id: 1, invoice_number: 'INV-0001', customer_name: 'John Doe', invoice_date: '2026-03-01', due_date: '2026-03-31', total_amount: 5250, status: 'sent' },
  { id: 2, invoice_number: 'INV-0002', customer_name: 'Jane Smith', invoice_date: '2026-03-05', due_date: '2026-04-05', total_amount: 3800, status: 'paid' },
  { id: 3, invoice_number: 'INV-0003', customer_name: 'Bob Johnson', invoice_date: '2026-02-15', due_date: '2026-03-15', total_amount: 7650, status: 'overdue' },
];

export const mockItems = [
  { id: 1, name: 'Web Design Service', sku: 'SRV-001', category: 'Services', unit_price: 150, quantity_on_hand: 0, reorder_level: 0 },
  { id: 2, name: 'Consulting Hour', sku: 'SRV-002', category: 'Services', unit_price: 200, quantity_on_hand: 0, reorder_level: 0 },
  { id: 3, name: 'Software License', sku: 'PRD-001', category: 'Products', unit_price: 499, quantity_on_hand: 50, reorder_level: 10 },
];

export const mockVendors = [
  { id: 1, name: 'Office Supply Co', email: 'sales@officesupply.com', company_name: 'Office Supply Co', phone: '555-0201' },
  { id: 2, name: 'Tech Hardware Ltd', email: 'info@techhw.com', company_name: 'Tech Hardware', phone: '555-0202' },
];

export const mockExpenses = [
  { id: 1, expense_date: '2026-03-06', expense_number: 'EXP-0001', description: 'Office Supplies', category: 'office-supplies', amount: 450, vendor_name: 'Office Supply Co' },
  { id: 2, expense_date: '2026-03-04', expense_number: 'EXP-0002', description: 'Software Subscription', category: 'software', amount: 299, vendor_name: null },
];

export const mockCategories = [
  { value: 'cost-of-sales', label: 'Cost of Sales' },
  { value: 'office-supplies', label: 'Office Supplies' },
  { value: 'software', label: 'Software' },
  { value: 'travel', label: 'Travel' },
  { value: 'marketing', label: 'Marketing' },
];

// ── Reports ───────────────────────────────────────────────────────────────────

export const mockSalesByCustomer = [
  { customer_name: 'Acme Corp',       invoice_count: 8,  total_sales: 42500, paid: 38000, outstanding: 4500  },
  { customer_name: 'Tech Solutions',  invoice_count: 12, total_sales: 67200, paid: 67200, outstanding: 0     },
  { customer_name: 'Global Inc',      invoice_count: 5,  total_sales: 23100, paid: 15450, outstanding: 7650  },
  { customer_name: 'Bright Futures',  invoice_count: 3,  total_sales: 9800,  paid: 9800,  outstanding: 0     },
  { customer_name: 'Summit Partners', invoice_count: 7,  total_sales: 31500, paid: 28000, outstanding: 3500  },
];

export const mockSalesByItem = [
  { item_name: 'Web Design Service', qty_sold: 45,  total_revenue: 67500, avg_price: 1500 },
  { item_name: 'Consulting Hour',    qty_sold: 210, total_revenue: 42000, avg_price: 200  },
  { item_name: 'Software License',   qty_sold: 38,  total_revenue: 18962, avg_price: 499  },
  { item_name: 'SEO Package',        qty_sold: 12,  total_revenue: 14400, avg_price: 1200 },
  { item_name: 'Support Retainer',   qty_sold: 24,  total_revenue: 28800, avg_price: 1200 },
];

export const mockTrialBalance = {
  accounts: [
    { code: '1001', name: 'Cash & Bank',          type: 'Asset',     debit: 85000,  credit: 0      },
    { code: '1100', name: 'Accounts Receivable',  type: 'Asset',     debit: 38500,  credit: 0      },
    { code: '1200', name: 'Inventory',            type: 'Asset',     debit: 12400,  credit: 0      },
    { code: '1500', name: 'Equipment',            type: 'Asset',     debit: 45000,  credit: 0      },
    { code: '2001', name: 'Accounts Payable',     type: 'Liability', debit: 0,      credit: 18900  },
    { code: '2100', name: 'Accrued Expenses',     type: 'Liability', debit: 0,      credit: 5200   },
    { code: '3001', name: 'Owner Equity',         type: 'Equity',    debit: 0,      credit: 90000  },
    { code: '3100', name: 'Retained Earnings',    type: 'Equity',    debit: 0,      credit: 45000  },
    { code: '4001', name: 'Sales Revenue',        type: 'Revenue',   debit: 0,      credit: 125000 },
    { code: '5001', name: 'Cost of Goods Sold',   type: 'Expense',   debit: 38200,  credit: 0      },
    { code: '5100', name: 'Salaries Expense',     type: 'Expense',   debit: 28000,  credit: 0      },
    { code: '5200', name: 'Office Supplies',      type: 'Expense',   debit: 4500,   credit: 0      },
    { code: '5300', name: 'Software & Tech',      type: 'Expense',   debit: 3600,   credit: 0      },
    { code: '5400', name: 'Marketing',            type: 'Expense',   debit: 7200,   credit: 0      },
    { code: '5500', name: 'Rent',                 type: 'Expense',   debit: 18000,  credit: 0      },
    { code: '5600', name: 'Utilities',            type: 'Expense',   debit: 2700,   credit: 0      },
  ],
  totals: { debit: 283100, credit: 284100 },
};

// ── Accountant ────────────────────────────────────────────────────────────────

export const mockChartOfAccounts = [
  { id: 1,  code: '1000', name: 'Cash',                     type: 'Asset',     category: 'Current Asset',       balance: 85000  },
  { id: 2,  code: '1010', name: 'Petty Cash',               type: 'Asset',     category: 'Current Asset',       balance: 500    },
  { id: 3,  code: '1100', name: 'Accounts Receivable',      type: 'Asset',     category: 'Current Asset',       balance: 38500  },
  { id: 4,  code: '1200', name: 'Inventory',                type: 'Asset',     category: 'Current Asset',       balance: 12400  },
  { id: 5,  code: '1300', name: 'Prepaid Expenses',         type: 'Asset',     category: 'Current Asset',       balance: 3200   },
  { id: 6,  code: '1500', name: 'Equipment',                type: 'Asset',     category: 'Fixed Asset',         balance: 45000  },
  { id: 7,  code: '1510', name: 'Accumulated Depreciation', type: 'Asset',     category: 'Fixed Asset',         balance: -9000  },
  { id: 8,  code: '2000', name: 'Accounts Payable',         type: 'Liability', category: 'Current Liability',   balance: 18900  },
  { id: 9,  code: '2100', name: 'Accrued Expenses',         type: 'Liability', category: 'Current Liability',   balance: 5200   },
  { id: 10, code: '2200', name: 'Sales Tax Payable',        type: 'Liability', category: 'Current Liability',   balance: 3100   },
  { id: 11, code: '2300', name: 'Deferred Revenue',         type: 'Liability', category: 'Current Liability',   balance: 7500   },
  { id: 12, code: '2500', name: 'Long-term Loan',           type: 'Liability', category: 'Long-term Liability', balance: 50000  },
  { id: 13, code: '3000', name: "Owner's Capital",          type: 'Equity',    category: 'Equity',              balance: 90000  },
  { id: 14, code: '3100', name: 'Retained Earnings',        type: 'Equity',    category: 'Equity',              balance: 45000  },
  { id: 15, code: '3200', name: 'Drawings',                 type: 'Equity',    category: 'Equity',              balance: -12000 },
  { id: 16, code: '4000', name: 'Sales Revenue',            type: 'Revenue',   category: 'Operating Revenue',   balance: 125000 },
  { id: 17, code: '4100', name: 'Service Revenue',          type: 'Revenue',   category: 'Operating Revenue',   balance: 48000  },
  { id: 18, code: '4900', name: 'Other Income',             type: 'Revenue',   category: 'Other Revenue',       balance: 2500   },
  { id: 19, code: '5000', name: 'Cost of Goods Sold',       type: 'Expense',   category: 'Cost of Sales',       balance: 38200  },
  { id: 20, code: '5100', name: 'Salaries & Wages',         type: 'Expense',   category: 'Operating Expense',   balance: 28000  },
  { id: 21, code: '5200', name: 'Office Supplies',          type: 'Expense',   category: 'Operating Expense',   balance: 4500   },
  { id: 22, code: '5300', name: 'Software & Subscriptions', type: 'Expense',   category: 'Operating Expense',   balance: 3600   },
  { id: 23, code: '5400', name: 'Marketing & Advertising',  type: 'Expense',   category: 'Operating Expense',   balance: 7200   },
  { id: 24, code: '5500', name: 'Rent',                     type: 'Expense',   category: 'Operating Expense',   balance: 18000  },
  { id: 25, code: '5600', name: 'Utilities',                type: 'Expense',   category: 'Operating Expense',   balance: 2700   },
  { id: 26, code: '5700', name: 'Depreciation Expense',     type: 'Expense',   category: 'Operating Expense',   balance: 9000   },
  { id: 27, code: '5800', name: 'Bank Charges',             type: 'Expense',   category: 'Operating Expense',   balance: 850    },
  { id: 28, code: '5900', name: 'Travel & Entertainment',   type: 'Expense',   category: 'Operating Expense',   balance: 3200   },
];

export const mockJournals = [
  {
    id: 1, reference: 'JNL-0001', date: '2026-03-01',
    description: 'Accrual - March Rent', status: 'posted',
    lines: [
      { account_code: '5500', account_name: 'Rent',             type: 'debit',  amount: 3000 },
      { account_code: '2100', account_name: 'Accrued Expenses', type: 'credit', amount: 3000 },
    ],
  },
  {
    id: 2, reference: 'JNL-0002', date: '2026-03-05',
    description: 'Depreciation - Equipment Q1', status: 'draft',
    lines: [
      { account_code: '5700', account_name: 'Depreciation Expense', type: 'debit',  amount: 1500 },
      { account_code: '1510', account_name: 'Equipment',            type: 'credit', amount: 1500 },
    ],
  },
  {
    id: 3, reference: 'JNL-0003', date: '2026-03-10',
    description: 'Prepaid Insurance Adjustment', status: 'draft',
    lines: [
      { account_code: '5200', account_name: 'Office Supplies',  type: 'debit',  amount: 800 },
      { account_code: '1300', account_name: 'Prepaid Expenses', type: 'credit', amount: 800 },
    ],
  },
];

export const mockBudgets = [
  {
    id: 1, fiscal_year: 2026, name: 'FY2026 Operating Budget', status: 'active',
    lines: [
      {
        account_code: '4000', account_name: 'Sales Revenue', category: 'Revenue',
        monthly: [50000,52000,55000,53000,58000,60000,62000,65000,67000,70000,72000,75000],
        annual_total: 739000, actual_to_date: 157000,
      },
      {
        account_code: '4100', account_name: 'Service Revenue', category: 'Revenue',
        monthly: [18000,18000,20000,20000,22000,22000,22000,24000,24000,24000,26000,26000],
        annual_total: 246000, actual_to_date: 56000,
      },
      {
        account_code: '5100', account_name: 'Salaries & Wages', category: 'Expense',
        monthly: [22000,22000,22000,22000,22000,22000,22000,22000,22000,22000,22000,22000],
        annual_total: 264000, actual_to_date: 66000,
      },
      {
        account_code: '5500', account_name: 'Rent', category: 'Expense',
        monthly: [3000,3000,3000,3000,3000,3000,3000,3000,3000,3000,3000,3000],
        annual_total: 36000, actual_to_date: 9000,
      },
    ],
  },
];

export const mockFxAdjustments = [
  {
    id: 1, date: '2026-03-01', from_currency: 'USD', to_currency: 'NGN',
    exchange_rate: 1580.50, affected_accounts: ['1000', '1100'],
    adjustment_amount: 24500, notes: 'Q1 revaluation of USD-denominated receivables',
  },
  {
    id: 2, date: '2026-02-01', from_currency: 'EUR', to_currency: 'NGN',
    exchange_rate: 1720.30, affected_accounts: ['2000'],
    adjustment_amount: -8200, notes: 'EUR payable revaluation Feb 2026',
  },
];
