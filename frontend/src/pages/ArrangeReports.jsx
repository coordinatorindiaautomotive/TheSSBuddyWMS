import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import {
  BarChart3,
  Boxes,
  TrendingUp,
  Download,
  Calendar,
  Layers,
  Sparkles,
  ClipboardList,
  CheckCircle2,
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

export default function ArrangeReports() {
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
      const res = await axios.get('/api/arranges/reports');
      setData(res.data);
    } catch (err) {
      toast.show('Failed to fetch arrange analytics.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const { summary, arrangeForBreakdown, teamBreakdown, trendData } = data || {};

  const safeTeamBreakdown = Array.isArray(teamBreakdown) ? teamBreakdown : [];
  const safeArrangeForBreakdown = Array.isArray(arrangeForBreakdown) ? arrangeForBreakdown : [];
  const safeTrendData = Array.isArray(trendData) ? trendData : [];

  const exportReportCSV = () => {
    if (safeTeamBreakdown.length === 0) {
      toast.show('No data to export.', 'warning');
      return;
    }
    const headers = ['Team Name', 'Total Arranges', 'Total Units', 'Converted to Pick Ticket'];
    const rows = safeTeamBreakdown.map((t) => [
      `"${(t.team_name || '').replace(/"/g, '""')}"`,
      t.arrange_count || 0,
      t.total_qty || 0,
      t.converted_to_pt || 0
    ]);
    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Arrange_Fulfillment_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    toast.show('Report downloaded successfully!', 'success');
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#004C8F] flex items-center justify-center font-bold shadow-sm">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-[#003366] tracking-tight">
              Arrange Fulfillment &amp; Velocity Report
            </h2>
            <p className="text-xs text-slate-500 font-semibold">
              Track STI requisition rates, pick ticket conversion velocity &amp; team performance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportReportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export CSV
          </button>
          <Link
            to="/arrange/register"
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#003366] hover:bg-[#004c8f] shadow-md border-r-4 border-[#ed1c24] transition-all cursor-pointer"
          >
            Arrange Register
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Requisitions</span>
          <div className="text-xl font-black text-[#003366]">{summary?.totalArranges || 0}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Units Arranged</span>
          <div className="text-xl font-black text-indigo-700">{summary?.totalQty || 0} Units</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Converted to Pick Tickets</span>
          <div className="text-xl font-black text-emerald-600">{summary?.pickTicketGenerated || 0}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Pick Tickets</span>
          <div className="text-xl font-black text-amber-600">{summary?.pendingPickTicket || 0}</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Trend Area Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#003366] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#004C8F]" />
              Daily Arrangement Activity Trend
            </h3>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={safeTrendData}>
                <defs>
                  <linearGradient id="colorArr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#004C8F" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#004C8F" stopOpacity={0}/>
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
                <Area type="monotone" dataKey="total_qty" stroke="#004C8F" strokeWidth={2} fillOpacity={1} fill="url(#colorArr)" name="Units Arranged" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Team Performance Chart */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#003366] flex items-center gap-2">
              <Boxes className="w-4 h-4 text-emerald-600" />
              Team Requisition &amp; Conversion Breakdown
            </h3>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={safeTeamBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="team_name" stroke="#64748B" fontSize={10} />
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
                <Legend />
                <Bar dataKey="arrange_count" fill="#004C8F" name="Arrangements" radius={[4, 4, 0, 0]} />
                <Bar dataKey="converted_to_pt" fill="#059669" name="Converted to PT" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
