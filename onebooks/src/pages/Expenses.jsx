import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';
import Header from '../components/Header';
import { expenseAPI } from '../services/api';
import { formatCurrency, formatDate } from '../utils/helpers';

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    fetchExpenses();
    fetchCategories();
  }, [search, categoryFilter]);

  const fetchExpenses = async () => {
    try {
      const response = await expenseAPI.getAll({ search, category: categoryFilter });
      setExpenses(response.data.expenses);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await expenseAPI.getCategories();
      setCategories(response.data.categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      try {
        await expenseAPI.delete(id);
        fetchExpenses();
      } catch (error) {
        console.error('Error deleting expense:', error);
      }
    }
  };

  return (
    <div className="page">
      <Header title="Expenses" subtitle="Track and manage your business expenses" />

      <div className="page-content">
        <div className="page-actions">
          <div className="filters">
            <div className="search-box">
              <Search size={20} />
              <input
                type="text"
                placeholder="Search expenses..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select 
              className="form-control" 
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ width: '200px' }}
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary">
            <Plus size={20} />
            Add Expense
          </button>
        </div>

        <div className="card">
          <div className="card-body">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Expense #</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Vendor</th>
                  <th>Amount</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center">Loading...</td>
                  </tr>
                ) : expenses.length > 0 ? (
                  expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td>{formatDate(expense.expense_date)}</td>
                      <td className="font-medium">{expense.expense_number}</td>
                      <td>{expense.description}</td>
                      <td>
                        <span className="badge badge-secondary">
                          {expense.category?.replace(/-/g, ' ')}
                        </span>
                      </td>
                      <td>{expense.vendor_name || '-'}</td>
                      <td>{formatCurrency(expense.amount)}</td>
                      <td className="text-right">
                        <button className="btn-icon" title="Edit">
                          <Edit size={18} />
                        </button>
                        <button 
                          className="btn-icon text-danger" 
                          onClick={() => handleDelete(expense.id)}
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
                      No expenses found
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

export default Expenses;