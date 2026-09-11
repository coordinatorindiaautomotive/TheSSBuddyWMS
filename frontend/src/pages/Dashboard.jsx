import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
  Truck,
  PackageCheck,
  Clock,
  CheckCircle2,
  TrendingUp,
  Activity,
  ClipboardList,
  Receipt,
  Route,
  Building2,
  RefreshCw,
  Radio,
  ArrowRight
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export default function Dashboard() {
  const { activeWarehouse } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [activeWarehouse]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/dashboard/stats');
      setData(res.data);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card-enterprise p-4 h-24 bg-slate-100"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 card-enterprise h-72 bg-slate-100"></div>
          <div className="card-enterprise h-72 bg-slate-100"></div>
        </div>
      </div>
    );
  }

  const { kpis, routeBreakdown, recentActivity, chartData } = data || {};

  const statCards = [
    {
      title: 'Total Pick Tickets',
      value: kpis?.totalPickTickets || 0,
      subtext: 'Created in system',
      icon: ClipboardList
    },
    {
      title: 'Pending Picking',
      value: kpis?.pendingPicking || 0,
      subtext: 'Awaiting floor pick',
      icon: Clock
    },
    {
      title: 'Pending Billing',
      value: kpis?.pendingBilling || 0,
      subtext: 'Picked & awaiting invoice',
      icon: Receipt
    },
    {
      title: 'Dispatched Orders',
      value: kpis?.dispatchedOrders || 0,
      subtext: 'Manifested & departed',
      icon: Truck
    },
    {
      title: 'Total Billed Value',
      value: `₹${(kpis?.totalBilledAmount || 0).toLocaleString('en-IN')}`,
      subtext: 'Invoice revenue',
      icon: TrendingUp
    },
    {
      title: 'Fleet & Logistics',
      value: `${kpis?.activeDrivers || 0} / ${kpis?.totalVehicles || 0}`,
      subtext: 'Drivers & Vehicles',
      icon: Building2
    }
  ];

  return (
    <div className="space-y-5">
      {/* Live Dispatch Control LED Quick Access Banner */}
      <div className="bg-linear-to-r from-[#003366] to-[#004c8f] rounded-2xl p-4 sm:p-5 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-4 border-[#ed1c24]">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
            <Radio className="w-6 h-6 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black tracking-tight">
                Live Dispatch Control Room (LED)
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/30 text-emerald-300 border border-emerald-400/40">
                LIVE
              </span>
            </div>
            <p className="text-xs text-blue-100 mt-0.5">
              Real-time monitoring of today’s route dispatches, Pick Ticket stages, aging, delays, and route performance.
            </p>
          </div>
        </div>

        <Link
          to="/led"
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition-all self-start sm:self-auto shrink-0"
        >
          <span>Launch LED Monitor</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* 6 Executive KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              className="card-enterprise p-3.5 space-y-2 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {card.title}
                </span>
                <div className="p-1.5 rounded-lg bg-slate-100 text-[#004C8F]">
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{card.value}</h3>
                <p className="text-[11px] text-slate-400 font-medium">{card.subtext}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Analytics Chart & Route Summary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Fulfillment Pipeline Trends Chart */}
        <div className="lg:col-span-2 card-enterprise p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#003366] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#004C8F]" />
                Daily Order Fulfillment &amp; Dispatch Trend
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Tickets created vs billed invoices vs dispatched shipments
              </p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#004C8F" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#004C8F" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorDispatched" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#059669" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="day" stroke="#64748B" fontSize={11} fontWeight={600} />
                <YAxis stroke="#64748B" fontSize={11} fontWeight={600} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#003366',
                    border: '1px solid #004C8F',
                    borderRadius: '8px',
                    color: '#FFF',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                />
                <Area type="monotone" dataKey="tickets" stroke="#004C8F" strokeWidth={2} fillOpacity={1} fill="url(#colorTickets)" name="Tickets Created" />
                <Area type="monotone" dataKey="dispatched" stroke="#059669" strokeWidth={2} fillOpacity={1} fill="url(#colorDispatched)" name="Dispatched" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Route-Wise Volume Summary Card */}
        <div className="card-enterprise flex flex-col overflow-hidden">
          <div className="card-header-enterprise">
            <div className="flex items-center gap-2">
              <Route className="w-4 h-4 text-slate-200" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Route-Wise Dispatch Volume
              </h3>
            </div>
            <span className="text-[10px] bg-white/15 text-white font-semibold px-2 py-0.5 rounded">
              Live Routes
            </span>
          </div>

          <div className="p-4 flex-1 overflow-y-auto max-h-72 divide-y divide-slate-100">
            {(!routeBreakdown || routeBreakdown.length === 0) ? (
              <div className="py-12 text-center text-xs text-slate-400 font-medium">No route data available</div>
            ) : (
              routeBreakdown.map((r, idx) => (
                <div key={idx} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-800">
                    <span className="truncate max-w-[150px]">{r.route || 'Direct Route'}</span>
                    <span className="font-bold text-[#004C8F]">{r.total_tickets} Tickets</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                    <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-semibold border border-emerald-200">{r.dispatched_tickets} Dispatched</span>
                    <span>&bull;</span>
                    <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-semibold border border-amber-200">{r.pending_tickets} Pending</span>
                    <span>&bull;</span>
                    <span>{r.total_qty} Units</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Live Operations Feed Table */}
      <div className="card-enterprise overflow-hidden">
        <div className="card-header-enterprise">
          <div className="flex items-center gap-2.5">
            <Activity className="w-4 h-4 text-emerald-400" />
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Live Operational Trajectory Log
              </h3>
            </div>
          </div>
          <span className="text-[11px] text-slate-300 font-medium">Real-time status tracking</span>
        </div>

        <div className="table-responsive-wrapper max-h-[420px]">
          <table className="table-enterprise">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="whitespace-nowrap">Ticket No</th>
                <th className="whitespace-nowrap">Entry Date &amp; Time</th>
                <th className="whitespace-nowrap min-w-[180px]">Party Name</th>
                <th className="whitespace-nowrap">Route</th>
                <th className="text-right whitespace-nowrap">Pick Qty</th>
                <th className="whitespace-nowrap">Bill No</th>
                <th className="text-right whitespace-nowrap">Invoice Amount</th>
                <th className="text-center whitespace-nowrap">Dispatch Status</th>
              </tr>
            </thead>
            <tbody>
              {(!recentActivity || recentActivity.length === 0) ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 font-medium">
                    No active operations logged.
                  </td>
                </tr>
              ) : (
                recentActivity.map((r, idx) => (
                  <tr key={idx}>
                    <td className="whitespace-nowrap">
                      <span className="font-mono font-bold text-[#004C8F] text-xs whitespace-nowrap">
                        {r.ticket_no}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="text-xs text-slate-600 font-medium whitespace-nowrap">
                        {r.ticket_date} {r.ticket_time}
                      </span>
                    </td>
                    <td>
                      <div className="font-semibold text-slate-800 text-xs">{r.party_name}</div>
                      <span className="text-[11px] font-mono text-slate-400">({r.party_code})</span>
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="text-xs text-slate-700 font-medium">{r.route}</span>
                    </td>
                    <td className="text-right font-medium text-xs text-slate-800 whitespace-nowrap">
                      {r.qty_in_pick_ticket}
                    </td>
                    <td className="whitespace-nowrap">
                      <span className="font-mono text-xs text-slate-700 font-medium whitespace-nowrap">
                        {r.bill_no || 'Pending Billing'}
                      </span>
                    </td>
                    <td className="text-right font-bold text-xs text-emerald-700 whitespace-nowrap">
                      {r.invoice_amount ? `₹${Number(r.invoice_amount).toLocaleString('en-IN')}` : '₹0'}
                    </td>
                    <td className="text-center whitespace-nowrap">
                      <span
                        className={`badge-status whitespace-nowrap ${
                          r.dispatch_status === 'Dispatched' || r.dispatch_status === 'Delivered'
                            ? 'badge-success'
                            : 'badge-warning'
                        }`}
                      >
                        {r.dispatch_status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

