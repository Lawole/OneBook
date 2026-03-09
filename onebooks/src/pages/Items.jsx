import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import Header from '../components/Header';
import { itemAPI } from '../services/api';
import { formatCurrency } from '../utils/helpers';

const Items = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchItems();
  }, [search]); // eslint-disable-next-line react-hooks/exhaustive-deps

  const fetchItems = async () => {
    try {
      const response = await itemAPI.getAll({ search });
      setItems(response.data.items);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await itemAPI.delete(id);
        fetchItems();
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    }
  };

  return (
    <div className="page">
      <Header title="Items" subtitle="Manage your product and service catalog" />

      <div className="page-content">
        <div className="page-actions">
          <div className="search-box">
            <Search size={20} />
            <input
              type="text"
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn-primary">
            <Plus size={20} />
            Add Item
          </button>
        </div>

        <div className="card">
          <div className="card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Unit Price</th>
                  <th>Qty on Hand</th>
                  <th>Reorder Level</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center">Loading...</td>
                  </tr>
                ) : items.length > 0 ? (
                  items.map((item) => (
                    <tr key={item.id}>
                      <td className="font-medium">{item.name}</td>
                      <td>{item.sku || '-'}</td>
                      <td>{item.category || '-'}</td>
                      <td>{formatCurrency(item.unit_price)}</td>
                      <td>
                        <span className={item.quantity_on_hand <= item.reorder_level ? 'text-danger' : ''}>
                          {item.quantity_on_hand}
                        </span>
                      </td>
                      <td>{item.reorder_level}</td>
                      <td className="text-right">
                        <button className="btn-icon" title="Edit">
                          <Edit size={18} />
                        </button>
                        <button 
                          className="btn-icon text-danger" 
                          onClick={() => handleDelete(item.id)}
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="text-center text-muted">
                      No items found
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

export default Items;