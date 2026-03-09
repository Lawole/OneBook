import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import Header from '../components/Header';
import { vendorAPI } from '../services/api';

const Vendors = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchVendors = useCallback(async () => {
    try {
      const response = await vendorAPI.getAll({ search });
      setVendors(response.data.vendors);
    } catch (error) {
      console.error('Error fetching vendors:', error);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this vendor?')) {
      try {
        await vendorAPI.delete(id);
        fetchVendors();
      } catch (error) {
        console.error('Error deleting vendor:', error);
      }
    }
  };

  return (
    <div className="page">
      <Header title="Vendors" subtitle="Manage your supplier database" />

      <div className="page-content">
        <div className="page-actions">
          <div className="search-box">
            <Search size={20} />
            <input
              type="text"
              placeholder="Search vendors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-primary">
            <Plus size={20} />
            Add Vendor
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
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="text-center">Loading...</td>
                  </tr>
                ) : vendors.length > 0 ? (
                  vendors.map((vendor) => (
                    <tr key={vendor.id}>
                      <td className="font-medium">{vendor.name}</td>
                      <td>{vendor.company_name || '-'}</td>
                      <td>{vendor.email}</td>
                      <td>{vendor.phone || '-'}</td>
                      <td className="text-right">
                        <button className="btn-icon" title="Edit">
                          <Edit size={18} />
                        </button>
                        <button 
                          className="btn-icon text-danger" 
                          onClick={() => handleDelete(vendor.id)}
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="text-center text-muted">
                      No vendors found
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

export default Vendors;