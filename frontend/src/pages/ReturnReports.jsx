import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import {
  BarChart3,
  Undo2,
  TrendingUp,
  Download,
  Calendar,
  Building2,
  Layers,
  Coins,
  PieChart as PieIcon,
  RefreshCw
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

export default function ReturnReports() {
  const toast = useToast();
  const { activeWarehouse } = useAuth();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchReports();
  }, [activeWarehouse]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/returns/reports');
      setData(res.data);
    } catch (err) {
      toast.show('Failed to fetch return analytics.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const { summary, reasonBreakdown, topParties, topParts, trendData } = data || {};

  const safeTopParties = Array.isArray(topParties) ? topParties : [];
  const safeTopParts = Array.isArray(topParts) ? topParts : [];
  const safeReasonBreakdown = Array.isArray(reasonBreakdown) ? reasonBreakdown : [];
  const safeTrendData = Array.isArray(trendData) ? trendData : [];

  const exportReportCSV = () => {
    if (safeTopParties.length === 0) {
      toast.show('No report data to export.', 'warning');
      return;
    }
    const headers = ['Party Code', 'Party Name', 'Returns Count', 'Total Units', 'Total Value (INR)'];
    const rows = safeTopParties.map((p) => [
      `"${p.party_code || ''}"`,
      `"${(p.party_name || '').replace(/"/g, '""')}"`,
      p.return_count || 0,
      p.total_qty || 0,
      p.total_value || 0
    ]);
    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Return_Analytics_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    toast.show('Analytics report exported!', 'success');
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#004C8F] flex items-center justify-center font-bold shadow-sm">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-[#003366] tracking-tight">
              Material Return Analytics &amp; Audit Report
            </h2>
            <p className="text-xs text-slate-500 font-semibold">
              Return trends, reason distribution, top return parties and part velocity
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportReportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export Audit CSV
          </button>
          <Link
            to="/return/register"
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#003366] hover:bg-[#004c8f] shadow-md border-r-4 border-[#ed1c24] transition-all cursor-pointer"
          >
            Return Register
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Returns</span>
          <div className="text-xl font-black text-[#003366]">{summary?.totalReturns || 0}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Value</span>
          <div className="text-xl font-black text-emerald-700">₹{(summary?.totalValue || 0).toLocaleString('en-IN')}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Units</span>
          <div className="text-xl font-black text-indigo-700">{summary?.totalQty || 0} Units</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending DMS</span>
          <div className="text-xl font-black text-amber-600">{summary?.dmsPending || 0}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">DMS Received</span>
          <div className="text-xl font-black text-emerald-600">{summary?.dmsReceived || 0}</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Trend Area Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#003366] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#004C8F]" />
              Daily Return Value Trend
            </h3>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={safeTrendData}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ed1c24" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ed1c24" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="date" stroke="#64748B" fontSize={10} />
                <YAxis stroke="#64748B" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#003366',
                    border: '1px solid #004C8F',
                    borderRadius: '8px',
                    color: '#FFF',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}
                />
                <Area type="monotone" dataKey="total_value" stroke="#ed1c24" strokeWidth={2} fillOpacity={1} fill="url(#colorVal)" name="Return Value (₹)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Reasons Bar Chart */}
        <div className="bg-[#white] rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#003366] flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-amber-600" />
              Returns Breakdown by Reason
            </h3>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={safeReasonBreakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis type="number" stroke="#64748B" fontSize={10} />
                <YAxis dataKey="reason" type="category" stroke="#64748B" fontSize={10} width={120} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#003366',
                    border: '1px solid #004C8F',
                    borderRadius: '8px',
                    color: '#FFF',
                    fontSize: '11px',
                    fontWeight: 'bold'
                  }}
                />
                <Bar dataKey="count" fill="#004C8F" radius={[0, 4, 4, 0]} name="Return Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Return Parties Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-[#003366] uppercase tracking-wider">
            Top 10 Parties by Return Value
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold">
                <tr>
                  <th className="p-2.5">Party Name</th>
                  <th className="p-2.5 text-center">Returns</th>
                  <th className="p-2.5 text-right">Units</th>
                  <th className="p-2.5 text-right">Total Value (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {safeTopParties.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-2.5">
                      <div className="font-bold text-slate-800">{p.party_name}</div>
                      <span className="text-[10px] font-mono text-slate-400">{p.party_code}</span>
                    </td>
                    <td className="p-2.5 text-center font-bold text-slate-700">{p.return_count}</td>
                    <td className="p-2.5 text-right font-semibold text-slate-800">{p.total_qty}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                      ₹{Number(p.total_value || 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Return Parts Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-[#003366] uppercase tracking-wider">
            Top 10 Returned Parts by Frequency
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold">
                <tr>
                  <th className="p-2.5">Part Code &amp; Name</th>
                  <th className="p-2.5 text-center">Times Returned</th>
                  <th className="p-2.5 text-right">Total Qty</th>
                  <th className="p-2.5 text-right">Total Value (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {safeTopParts.map((pt, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-2.5">
                      <div className="font-mono font-bold text-[#003366]">{pt.part_no}</div>
                      <span className="text-[10px] text-slate-500">{pt.part_name}</span>
                    </td>
                    <td className="p-2.5 text-center font-bold text-slate-700">{pt.frequency}</td>
                    <td className="p-2.5 text-right font-semibold text-slate-800">{pt.total_qty}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-emerald-700">
                      ₹{Number(pt.total_value || 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
