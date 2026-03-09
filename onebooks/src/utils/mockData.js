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
