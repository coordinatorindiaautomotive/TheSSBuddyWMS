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
  Undo2,
  Boxes,
  AlertCircle,
  Sparkles,
  FileText,
  Box
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
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStats();
  }, [activeWarehouse]);

  const fetchStats = async () => {
    setRefreshing(true);
    try {
      const res = await axios.get('/api/dashboard/stats');
      setData(res.data);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 card-enterprise h-80 bg-slate-100"></div>
          <div className="lg:col-span-3 card-enterprise h-80 bg-slate-100"></div>
          <div className="lg:col-span-4 card-enterprise h-80 bg-slate-100"></div>
        </div>
      </div>
    );
  }

  const { kpis, routeBreakdown, recentActivity, chartData, todaySnapshot } = data || {};

  const todayDateStr = todaySnapshot?.dateFormatted || new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const statCards = [
    {
      title: 'Total Pick Tickets',
      value: kpis?.totalPickTickets || 0,
      subtext: 'Created in system',
      icon: ClipboardList,
      link: '/pick-tickets'
    },
    {
      title: 'Pending Picking',
      value: kpis?.pendingPicking || 0,
      subtext: 'Awaiting floor pick',
      icon: Clock,
      link: '/pick-tickets'
    },
    {
      title: 'Pending Billing',
      value: kpis?.pendingBilling || 0,
      subtext: 'Picked & awaiting invoice',
      icon: Receipt,
      link: '/billing'
    },
    {
      title: 'Dispatched Orders',
      value: kpis?.dispatchedOrders || 0,
      subtext: 'Manifested & departed',
      icon: Truck,
      link: '/dispatch'
    },
    {
      title: 'Total Billed Value',
      value: `₹${(kpis?.totalBilledAmount || 0).toLocaleString('en-IN')}`,
      subtext: 'Invoice revenue',
      icon: TrendingUp,
      link: '/billing'
    },
    {
      title: 'Fleet & Logistics',
      value: `${kpis?.activeDrivers || 0} / ${kpis?.totalVehicles || 0}`,
      subtext: 'Drivers & Vehicles',
      icon: Building2,
      link: '/masters'
    }
  ];

  const inventoryKpis = [
    {
      title: 'Return Today',
      value: todaySnapshot?.returns?.count ?? (kpis?.returnsToday || 0),
      subtext: 'Materials returned today',
      icon: Undo2,
      badgeBg: 'bg-rose-50 text-rose-600',
      link: '/return/register'
    },
    {
      title: 'Pending DMS',
      value: todaySnapshot?.returns?.dmsPending ?? (kpis?.pendingDmsReturns || 0),
      subtext: 'Awaiting STR allocation',
      icon: AlertCircle,
      badgeBg: 'bg-amber-50 text-amber-600',
      link: '/return/dms-pending'
    },
    {
      title: 'Arrange Today',
      value: todaySnapshot?.arranges?.count ?? (kpis?.arrangesToday || 0),
      subtext: 'Floor STI requisitions',
      icon: Boxes,
      badgeBg: 'bg-blue-50 text-[#004C8F]',
      link: '/arrange/register'
    },
    {
      title: 'Pending Pick Ticket',
      value: todaySnapshot?.arranges?.pending ?? (kpis?.pendingPickTicketArranges || 0),
      subtext: 'Requisitions to convert',
      icon: Sparkles,
      badgeBg: 'bg-indigo-50 text-indigo-600',
      link: '/arrange/register'
    },
    {
      title: 'Arrange -> Converted',
      value: todaySnapshot?.arranges?.converted ?? (kpis?.arrangeBillingConverted || 0),
      subtext: 'Fulfillment completed',
      icon: CheckCircle2,
      badgeBg: 'bg-emerald-50 text-emerald-600',
      link: '/arrange/reports'
    }
  ];

  // Today's Snapshot Sub-Items exactly as in the user's reference mockup
  const snapshotItems = [
    {
      label: 'New Tickets',
      value: todaySnapshot?.pickTickets?.count ?? (kpis?.totalPickTickets || 0),
      icon: FileText,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50 border-blue-100',
      link: '/pick-tickets'
    },
    {
      label: 'In Picking',
      value: todaySnapshot?.pickTickets?.pending ?? (kpis?.pendingPicking || 0),
      icon: Box,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50 border-amber-100',
      link: '/pick-tickets'
    },
    {
      label: 'Dispatched',
      value: todaySnapshot?.pickTickets?.dispatched ?? (kpis?.dispatchedOrders || 0),
      icon: Truck,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50 border-emerald-100',
      link: '/dispatch'
    },
    {
      label: 'Pending Billing',
      value: kpis?.pendingBilling || 0,
      icon: Receipt,
      iconColor: 'text-purple-600',
      iconBg: 'bg-purple-50 border-purple-100',
      link: '/billing'
    }
  ];

  return (
    <div className="space-y-5">
      {/* 6 Executive KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <Link
              to={card.link}
              key={idx}
              className="card-enterprise p-3.5 space-y-2 hover:border-[#003366] hover:shadow-md transition-all cursor-pointer block group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider group-hover:text-[#003366]">
                  {card.title}
                </span>
                <div className="p-1.5 rounded-lg bg-slate-100 text-[#004C8F] group-hover:bg-[#003366] group-hover:text-white transition-colors">
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{card.value}</h3>
                <p className="text-[11px] text-slate-400 font-medium">{card.subtext}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Inventory & Floor Operations KPI Ribbon */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#003366]"></span>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#003366]">
              Inventory &amp; Floor Operations Pulse
            </h4>
          </div>
          <span className="text-[11px] text-slate-400 font-semibold">Live Return &amp; Arrange Metrics</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {inventoryKpis.map((card, idx) => {
            const Icon = card.icon;
            return (
              <Link
                to={card.link}
                key={idx}
                className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/70 hover:bg-white hover:border-[#003366] hover:shadow-xs transition-all block group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
                    {card.title}
                  </span>
                  <div className={`p-1.5 rounded-lg ${card.badgeBg}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-base font-black text-slate-900 group-hover:text-[#003366]">
                  {card.value}
                </div>
                <div className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                  {card.subtext}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── 3-COLUMN CENTER GRID: CHART | TODAY'S SNAPSHOT | ROUTE SUMMARY ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        
        {/* 1. Daily Order Fulfillment & Dispatch Trend Chart */}
        <div className="lg:col-span-12 xl:col-span-5 card-enterprise p-5 space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#003366] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#004C8F]" />
                Daily Order Fulfillment &amp; Dispatch Trend
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Tickets created vs dispatched shipments
              </p>
            </div>
            <button
              onClick={fetchStats}
              disabled={refreshing}
              className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#004C8F]' : ''}`} />
            </button>
          </div>

          <div className="h-60 w-full">
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

        {/* 2. TODAY'S SNAPSHOT CARD (Exact Design as Mockup) */}
        <div className="lg:col-span-6 xl:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-col justify-between space-y-3">
          {/* Header */}
          <div className="border-b border-slate-100 pb-2">
            <h3 className="text-sm font-black text-[#003366] tracking-tight">
              Today's Snapshot
            </h3>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">
              {todayDateStr}
            </p>
          </div>

          {/* 4 Pastel Sub-Cards */}
          <div className="space-y-2.5 flex-1 flex flex-col justify-between">
            {snapshotItems.map((item, idx) => {
              const Icon = item.icon;
              return (
                <Link
                  to={item.link}
                  key={idx}
                  className="p-3 rounded-xl border border-slate-200/80 bg-white hover:border-[#003366] hover:shadow-xs transition-all flex items-center gap-3.5 group cursor-pointer"
                >
                  <div className={`w-10 h-10 rounded-xl ${item.iconBg} border flex items-center justify-center ${item.iconColor} shrink-0`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 group-hover:text-[#003366] transition-colors">
                      {item.label}
                    </div>
                    <div className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                      {item.value}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* 3. Route-Wise Dispatch Volume Card */}
        <div className="lg:col-span-6 xl:col-span-4 card-enterprise flex flex-col overflow-hidden">
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
