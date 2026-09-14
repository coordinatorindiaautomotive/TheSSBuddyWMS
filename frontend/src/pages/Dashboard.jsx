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
  ArrowRight,
  Undo2,
  Boxes,
  AlertCircle,
  Sparkles,
  Zap,
  Calendar,
  Layers,
  ArrowUpRight,
  CheckCircle,
  ShieldCheck,
  Plus
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
  const [viewMode, setViewMode] = useState('today'); // 'today' | 'all'
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
        <div className="h-14 bg-slate-200 rounded-2xl"></div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card-enterprise p-4 h-28 bg-slate-100"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 card-enterprise h-72 bg-slate-100"></div>
          <div className="card-enterprise h-72 bg-slate-100"></div>
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

  // All-time stat cards
  const allTimeCards = [
    {
      title: 'Total Pick Tickets',
      value: kpis?.totalPickTickets || 0,
      subtext: 'Created across all time',
      icon: ClipboardList,
      link: '/pick-tickets',
      color: 'text-[#004C8F]',
      bg: 'bg-blue-50'
    },
    {
      title: 'Pending Picking',
      value: kpis?.pendingPicking || 0,
      subtext: 'Awaiting floor pick',
      icon: Clock,
      link: '/pick-tickets',
      color: 'text-amber-600',
      bg: 'bg-amber-50'
    },
    {
      title: 'Pending Billing',
      value: kpis?.pendingBilling || 0,
      subtext: 'Picked & awaiting invoice',
      icon: Receipt,
      link: '/billing',
      color: 'text-purple-600',
      bg: 'bg-purple-50'
    },
    {
      title: 'Dispatched Orders',
      value: kpis?.dispatchedOrders || 0,
      subtext: 'Manifested & departed',
      icon: Truck,
      link: '/dispatch',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50'
    },
    {
      title: 'Total Billed Value',
      value: `₹${(kpis?.totalBilledAmount || 0).toLocaleString('en-IN')}`,
      subtext: 'Cumulative invoice turnover',
      icon: TrendingUp,
      link: '/billing',
      color: 'text-indigo-600',
      bg: 'bg-indigo-50'
    },
    {
      title: 'Fleet & Logistics',
      value: `${kpis?.activeDrivers || 0} / ${kpis?.totalVehicles || 0}`,
      subtext: 'Active Drivers & Vehicles',
      icon: Building2,
      link: '/masters',
      color: 'text-cyan-600',
      bg: 'bg-cyan-50'
    }
  ];

  // Inventory & Floor Operations KPIs
  const inventoryKpis = [
    {
      title: 'Return Today',
      value: todaySnapshot?.returns?.count ?? (kpis?.returnsToday || 0),
      subtext: `${todaySnapshot?.returns?.qty || 0} units returned`,
      icon: Undo2,
      badgeBg: 'bg-rose-50 text-rose-600',
      link: '/return/register'
    },
    {
      title: 'Pending DMS',
      value: todaySnapshot?.returns?.dmsPending ?? (kpis?.pendingDmsReturns || 0),
      subtext: 'Awaiting STR verification',
      icon: AlertCircle,
      badgeBg: 'bg-amber-50 text-amber-600',
      link: '/return/dms-pending'
    },
    {
      title: 'Arrange Today',
      value: todaySnapshot?.arranges?.count ?? (kpis?.arrangesToday || 0),
      subtext: `${todaySnapshot?.arranges?.qty || 0} floor units`,
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

  // Today's 6 Core Snapshot Cards
  const todayCards = [
    {
      title: 'Pick Tickets Today',
      value: todaySnapshot?.pickTickets?.count || 0,
      subtext: `${todaySnapshot?.pickTickets?.qty || 0} Units • ${todaySnapshot?.pickTickets?.picked || 0} Picked`,
      highlight: `${todaySnapshot?.pickTickets?.pending || 0} Pending`,
      highlightColor: 'text-amber-600 bg-amber-50 border-amber-200',
      icon: ClipboardList,
      link: '/pick-tickets',
      borderAccent: 'border-l-4 border-l-[#004C8F]'
    },
    {
      title: "Today's Invoices & Revenue",
      value: `₹${(todaySnapshot?.billings?.amount || 0).toLocaleString('en-IN')}`,
      subtext: `${todaySnapshot?.billings?.count || 0} Invoices • ${todaySnapshot?.billings?.qty || 0} Billed Qty`,
      highlight: 'Turnover',
      highlightColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      icon: Receipt,
      link: '/billing',
      borderAccent: 'border-l-4 border-l-emerald-600'
    },
    {
      title: 'Dispatches Today',
      value: `${todaySnapshot?.dispatches?.count || 0} Trips`,
      subtext: `${todaySnapshot?.dispatches?.cartons || 0} Cartons Loaded`,
      highlight: `${todaySnapshot?.dispatches?.inTransit || 0} In Transit`,
      highlightColor: 'text-cyan-700 bg-cyan-50 border-cyan-200',
      icon: Truck,
      link: '/dispatch',
      borderAccent: 'border-l-4 border-l-cyan-600'
    },
    {
      title: 'Returns Today',
      value: `${todaySnapshot?.returns?.count || 0} Returns`,
      subtext: `${todaySnapshot?.returns?.qty || 0} Units • ₹${(todaySnapshot?.returns?.val || 0).toLocaleString('en-IN')}`,
      highlight: `${todaySnapshot?.returns?.dmsDone || 0} DMS Recd`,
      highlightColor: 'text-rose-700 bg-rose-50 border-rose-200',
      icon: Undo2,
      link: '/return/register',
      borderAccent: 'border-l-4 border-l-rose-600'
    },
    {
      title: 'Floor Arranges (STI)',
      value: `${todaySnapshot?.arranges?.count || 0} Arranges`,
      subtext: `${todaySnapshot?.arranges?.qty || 0} Requested Units`,
      highlight: `${todaySnapshot?.arranges?.converted || 0} Converted`,
      highlightColor: 'text-blue-700 bg-blue-50 border-blue-200',
      icon: Boxes,
      link: '/arrange/register',
      borderAccent: 'border-l-4 border-l-indigo-600'
    },
    {
      title: 'Active Fleet Today',
      value: `${kpis?.activeDrivers || 0} Drivers`,
      subtext: `${kpis?.totalVehicles || 0} Registered Vehicles`,
      highlight: 'Logistics Ready',
      highlightColor: 'text-purple-700 bg-purple-50 border-purple-200',
      icon: Building2,
      link: '/masters',
      borderAccent: 'border-l-4 border-l-purple-600'
    }
  ];

  return (
    <div className="space-y-5">
      {/* ── TOP EXECUTIVE CONTROL & SNAPSHOT SELECTOR ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#003366] flex items-center justify-center text-white shadow-xs">
            <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-[#003366] tracking-tight">
                Operations Executive Dashboard
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                LIVE
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
              <span>Domain:</span>
              <strong className="text-slate-800">{activeWarehouse?.name || 'Central Logistics Hub'}</strong>
              <span className="text-slate-300">•</span>
              <Calendar className="w-3.5 h-3.5 text-slate-400 inline" />
              <span className="font-semibold text-slate-600">{todayDateStr}</span>
            </p>
          </div>
        </div>

        {/* View Mode Toggle & Sync Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200/80">
            <button
              type="button"
              onClick={() => setViewMode('today')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'today'
                  ? 'bg-[#003366] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Today's Snapshot</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'all'
                  ? 'bg-[#003366] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All-Time Operations</span>
            </button>
          </div>

          <button
            type="button"
            onClick={fetchStats}
            disabled={refreshing}
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50 shadow-2xs"
            title="Refresh Live Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-[#004C8F]' : 'text-slate-600'}`} />
          </button>
        </div>
      </div>

      {/* ── VIEW MODE: TODAY'S SNAPSHOT HERO SECTION ── */}
      {viewMode === 'today' && (
        <div className="space-y-4">
          {/* Hero Banner with Date & Quick Action Badges */}
          <div className="bg-gradient-to-r from-[#002244] via-[#003366] to-[#004c8f] rounded-2xl border-b-4 border-[#ed1c24] p-4 sm:p-5 text-white shadow-md relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="bg-amber-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">
                    Today's Snapshot
                  </span>
                  <span className="text-slate-300 text-xs font-mono">{todayDateStr}</span>
                </div>
                <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  Daily Execution &amp; Dispatch Pulse
                </h3>
                <p className="text-xs text-slate-200/90 max-w-xl">
                  Real-time visibility into today's pick tickets, billing generation, route dispatches, returns, and arrangement requests.
                </p>
              </div>

              {/* Quick Jump Shortcuts */}
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  to="/pick-tickets"
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Pick Ticket</span>
                </Link>
                <Link
                  to="/billing"
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-purple-400" />
                  <span>Billing</span>
                </Link>
                <Link
                  to="/dispatch-planning"
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-colors"
                >
                  <Route className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Dispatch Console</span>
                </Link>
                <Link
                  to="/return/register"
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-colors"
                >
                  <Undo2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Return</span>
                </Link>
                <Link
                  to="/arrange/register"
                  className="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-colors"
                >
                  <Boxes className="w-3.5 h-3.5 text-blue-400" />
                  <span>Arrange</span>
                </Link>
              </div>
            </div>
          </div>

          {/* 6 Today's Snapshot Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {todayCards.map((card, idx) => {
              const Icon = card.icon;
              return (
                <Link
                  to={card.link}
                  key={idx}
                  className={`bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5 hover:border-[#003366] hover:shadow-md transition-all block group cursor-pointer ${card.borderAccent}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider group-hover:text-[#003366]">
                      {card.title}
                    </span>
                    <div className="p-1.5 rounded-lg bg-slate-100 text-[#003366] group-hover:bg-[#003366] group-hover:text-white transition-colors">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-slate-900 group-hover:text-[#003366] transition-colors">
                      {card.value}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                      {card.subtext}
                    </p>
                  </div>

                  <div className="pt-1 flex items-center justify-between border-t border-slate-100 text-[10px]">
                    <span className={`px-2 py-0.5 rounded-md font-bold border ${card.highlightColor}`}>
                      {card.highlight}
                    </span>
                    <span className="text-slate-400 group-hover:text-[#004C8F] font-bold flex items-center gap-0.5">
                      View <ArrowRight className="w-3 h-3 inline" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Today's Route Dispatch Progress Grid */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Route className="w-4 h-4 text-[#004C8F]" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#003366]">
                  Today's Route Dispatch Trajectory ({todaySnapshot?.routes?.length || 0} Active Routes)
                </h4>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">Real-time fulfillment %</span>
            </div>

            {(!todaySnapshot?.routes || todaySnapshot.routes.length === 0) ? (
              <div className="py-8 text-center text-xs text-slate-400 font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
                No tickets issued yet today. Create a new pick ticket to begin today's dispatch cycle.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {todaySnapshot.routes.map((r, i) => {
                  const pct = r.total_tickets > 0 ? Math.round((r.dispatched_tickets / r.total_tickets) * 100) : 0;
                  return (
                    <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-slate-900 truncate max-w-[170px]">
                          {r.route || 'Direct Route'}
                        </span>
                        <span className="font-mono text-xs font-black text-[#004C8F]">
                          {r.dispatched_tickets} / {r.total_tickets} Dispatched
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>{pct}% Completed</span>
                        <span>{r.total_qty} units</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── VIEW MODE: ALL-TIME OPERATIONS & KPI CARDS ── */}
      {viewMode === 'all' && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {allTimeCards.map((card, idx) => {
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
                  <div className={`p-1.5 rounded-lg ${card.bg} ${card.color} group-hover:bg-[#003366] group-hover:text-white transition-colors`}>
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
      )}

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

