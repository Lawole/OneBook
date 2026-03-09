import React, { useState } from 'react';
import { Download, Calendar } from 'lucide-react';
import Header from '../components/Header';
import { reportAPI } from '../services/api';
import { downloadFile } from '../utils/helpers';

const Reports = () => {
  const [reportType, setReportType] = useState('profit-loss');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleExport = async (format) => {
    setLoading(true);
    try {
      let response;
      const filename = `${reportType}_${new Date().toISOString().split('T')[0]}.${format}`;
      
      if (reportType === 'profit-loss') {
        response = await reportAPI.exportProfitLoss(format);
      } else if (reportType === 'balance-sheet') {
        response = await reportAPI.exportBalanceSheet(format);
      } else if (reportType === 'cash-flow') {
        response = await reportAPI.exportCashFlow(format);
      }
      
      downloadFile(response.data, filename);
    } catch (error) {
      console.error('Error exporting report:', error);
      alert('Failed to export report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <Header title="Reports" subtitle="Generate and export financial reports" />

      <div className="page-content">
        <div className="card">
          <div className="card-header">
            <h3>Report Generator</h3>
          </div>
          <div className="card-body">
            <div className="report-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Report Type</label>
                  <select 
                    className="form-control"
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                  >
                    <option value="profit-loss">Profit & Loss Statement</option>
                    <option value="balance-sheet">Balance Sheet</option>
                    <option value="cash-flow">Cash Flow Statement</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Start Date</label>
                  <div className="input-with-icon">
                    <Calendar size={18} />
                    <input
                      type="date"
                      className="form-control"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>End Date</label>
                  <div className="input-with-icon">
                    <Calendar size={18} />
                    <input
                      type="date"
                      className="form-control"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="export-buttons">
                <button 
                  className="btn btn-primary"
                  onClick={() => handleExport('excel')}
                  disabled={loading}
                >
                  <Download size={20} />
                  Export to Excel
                </button>
                <button 
                  className="btn btn-outline"
                  onClick={() => handleExport('csv')}
                  disabled={loading}
                >
                  <Download size={20} />
                  Export to CSV
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="reports-grid">
          <div className="report-card">
            <h4>Profit & Loss Statement</h4>
            <p>View your income and expenses over a period to understand profitability.</p>
          </div>

          <div className="report-card">
            <h4>Balance Sheet</h4>
            <p>See your company's assets, liabilities, and equity at a specific point in time.</p>
          </div>

          <div className="report-card">
            <h4>Cash Flow Statement</h4>
            <p>Track the flow of cash in and out of your business.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;