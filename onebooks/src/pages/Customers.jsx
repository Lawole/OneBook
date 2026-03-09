import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import Header from '../components/Header';
import { customerAPI } from '../services/api';
import { formatCurrency } from '../utils/helpers';
import { mockCustomers } from '../utils/mockData';
import { useAuth } from '../context/AuthContext';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { isDemoMode } = useAuth();

  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const fetchCustomers = async () => {
    if (isDemoMode) {
      // Use mock data in demo mode
      const filtered = mockCustomers.filter(c => 
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase())
      );
      setCustomers(filtered);
      setLoading(false);
      return;
    }

    try {
      const response = await customerAPI.getAll({ search });
      setCustomers(response.data.customers);
    } catch (error) {
      console.error('Error fetching customers:', error);
      setCustomers(mockCustomers);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (isDemoMode) {
      alert('Demo mode: Changes won\'t be saved');
      setCustomers(customers.filter(c => c.id !== id));
      return;
    }

    if (window.confirm('Are you sure you want to delete this customer?')) {
      try {
        await customerAPI.delete(id);
        fetchCustomers();
      } catch (error) {
        console.error('Error deleting customer:', error);
      }
    }
  };

  return (
    <div className="page">
      <Header 
        title="Customers" 
        subtitle={isDemoMode ? "Demo Mode - Sample data shown" : "Manage your customer database"}
      />

      <div className="page-content">
        {isDemoMode && (
          <div className="alert alert-info" style={{ marginBottom: '25px' }}>
            💡 <strong>Demo Mode:</strong> Changes won't be saved. Connect database for full functionality.
          </div>
        )}

        <div className="page-actions">
          <div className="search-box">
            <Search size={20} />
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={() => alert('Demo mode: Feature coming soon')}>
            <Plus size={20} />
            Add Customer
          </button>
        </div>

        <div className="card">
          <div className="card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Company</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Total Invoiced</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="text-center">Loading...</td>
                  </tr>
                ) : customers.length > 0 ? (
                  customers.map((customer) => (
                    <tr key={customer.id}>
                      <td className="font-medium">{customer.name}</td>
                      <td>{customer.company_name || '-'}</td>
                      <td>{customer.email}</td>
                      <td>{customer.phone || '-'}</td>
                      <td>{formatCurrency(customer.total_invoiced || 0)}</td>
                      <td className="text-right">
                        <button className="btn-icon" title="Edit">
                          <Edit size={18} />
                        </button>
                        <button 
                          className="btn-icon text-danger" 
                          onClick={() => handleDelete(customer.id)}
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center text-muted">
                      No customers found
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

export default Customers;