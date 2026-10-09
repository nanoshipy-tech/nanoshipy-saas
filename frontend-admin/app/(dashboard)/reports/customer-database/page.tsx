'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import { Users, Download, RefreshCw, Search, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CustomerDatabaseReportPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/platform/reports/customer-database');
      if (res.data?.success) {
        setData(res.data.data || []);
      }
    } catch {
      toast.error('Failed to load Customer Database report');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await apiClient.get('/platform/reports/customer-database?format=csv', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `customer_database_${new Date().toISOString().substring(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Customer Database report downloaded!');
    } catch {
      toast.error('Failed to export CSV');
    }
  };

  const filtered = data.filter((row) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (row.company_name || '').toLowerCase().includes(term) ||
      (row.contact_email || '').toLowerCase().includes(term) ||
      (row.contact_name || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#E8DEF2] shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-[#14121F] flex items-center gap-3 font-heading">
            <Users className="w-6 h-6 text-[#5B069A]" /> Customer Database Report
          </h1>
          <p className="text-xs text-[#534F66] font-medium mt-1">
            Comprehensive tenant registry including contact details, incorporation dates, revenue, and active integrations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchReport}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#E8DEF2] hover:bg-[#F6EFFF] text-[#14121F] font-bold text-xs transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-bold text-xs shadow-md transition-all"
            style={{ background: 'linear-gradient(135deg, #5B069A 0%, #8410DC 100%)' }}
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#E8DEF2] rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#7E7994]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Company, Contact or Email..."
            className="w-full bg-[#F8F7FD] border border-[#E8DEF2] rounded-xl pl-9 pr-4 py-2 text-xs text-[#14121F] font-medium focus:outline-none focus:border-[#5B069A]"
          />
        </div>
        <div className="text-xs font-bold text-[#534F66]">
          Total Registered Tenants: <span className="text-[#14121F] font-extrabold">{filtered.length}</span>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-[#E8DEF2] rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-[#534F66] text-xs font-semibold">Loading Customer Database...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-[#534F66] text-xs font-semibold">No tenants found matching criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#F2ECF7] text-[#534F66] bg-[#F8F7FD] font-bold">
                  <th className="py-3.5 px-4 font-bold">Company Name</th>
                  <th className="py-3.5 px-4 font-bold">Contact Person</th>
                  <th className="py-3.5 px-4 font-bold">Pickup Locations</th>
                  <th className="py-3.5 px-4 font-bold">Incorporation Date</th>
                  <th className="py-3.5 px-4 font-bold">Total Invoiced Revenue</th>
                  <th className="py-3.5 px-4 font-bold">Connected Integrations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F2ECF7] text-[#14121F] font-medium">
                {filtered.map((row) => (
                  <tr key={row.tenant_id} className="hover:bg-[#F6EFFF]/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-[#14121F] flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-[#5B069A]" />
                      {row.company_name} ({row.subdomain})
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-[#14121F]">{row.contact_name}</p>
                      <p className="text-[10px] text-[#7E7994]">{row.contact_email}</p>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[#14121F]">
                      {row.pickup_address_count} location(s)
                    </td>
                    <td className="py-3.5 px-4 text-[#534F66] font-mono">
                      {row.incorporation_date}
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-[#16a34a]">
                      ₹{row.total_revenue_inr}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[#5B069A]">
                      {row.connected_integrations}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
