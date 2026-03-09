import React, { useState, useEffect } from 'react';
import { Plus, Search, Download, Eye } from 'lucide-react';
import Header from '../components/Header';
import { invoiceAPI } from '../services/api';
import { formatCurrency, formatDate, downloadFile } from '../utils/helpers';

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchInvoices();
  }, [search, statusFilter]); // eslint-disable-next-line react-hooks/exhaustive-deps

  const fetchInvoices = async () => {
    try {
      const response = await invoiceAPI.getAll({ search, status: statusFilter });
      setInvoices(response.data.invoices);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (id, invoiceNumber) => {
    try {
      const response = await invoiceAPI.downloadPDF(id);
      downloadFile(response.data, `invoice_${invoiceNumber}.pdf`);
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft: 'badge badge-secondary',
      sent: 'badge badge-info',
      paid: 'badge badge-success',
      overdue: 'badge badge-danger',
    };
    return badges[status] || 'badge';
  };

  return (
    <div className="page">
      <Header title="Invoices" subtitle="Manage your sales invoices" />

      <div className="page-content">
        <div className="page-actions">
          <div className="filters">
            <div className="search-box">
              <Search size={20} />
              <input
                type="text"
                placeholder="Search invoices..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select 
              className="form-control" 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: '150px' }}
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <button className="btn btn-primary">
            <Plus size={20} />
            New Invoice
          </button>
        </div>

        <div className="card">
          <div className="card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Due Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center">Loading...</td>
                  </tr>
                ) : invoices.length > 0 ? (
                  invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="font-medium">{invoice.invoice_number}</td>
                      <td>{invoice.customer_name}</td>
                      <td>{formatDate(invoice.invoice_date)}</td>
                      <td>{formatDate(invoice.due_date)}</td>
                      <td>{formatCurrency(invoice.total_amount)}</td>
                      <td>
                        <span className={getStatusBadge(invoice.status)}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="text-right">
                        <button className="btn-icon" title="View">
                          <Eye size={18} />
                        </button>
                        <button 
                          className="btn-icon" 
                          onClick={() => handleDownloadPDF(invoice.id, invoice.invoice_number)}
                          title="Download PDF"
                        >
                          <Download size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="text-center text-muted">
                      No invoices found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Invoices;