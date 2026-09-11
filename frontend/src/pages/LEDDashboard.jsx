import React, { useEffect, useState, useRef, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import {
  Route as RouteIcon,
  ClipboardList,
  Clock,
  PackageCheck,
  Receipt,
  CheckCircle2,
  AlertOctagon,
  Search,
  Filter,
  RefreshCw,
  Maximize2,
  Minimize2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Truck,
  FileSpreadsheet,
  Printer,
  Eye,
  X,
  User,
  ShieldCheck,
  Radio,
  SlidersHorizontal,
  Flame,
  AlertTriangle,
  Building2,
  Layers,
  ArrowRight,
  Sparkles,
  Check
} from 'lucide-react';

export default function LEDDashboard() {
  const { user, activeWarehouse } = useAuth();
  const { socket, isConnected } = useSocket();
  const toast = useToast();

  // Primary State
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const [refreshCountdown, setRefreshCountdown] = useState(30);

  // Filters State
  const [date, setDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [routeFilter, setRouteFilter] = useState('ALL');
  const [slotFilter, setSlotFilter] = useState('ALL'); // 'ALL' | 'Morning' | 'Evening'
  const [stageFilter, setStageFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [quickFilter, setQuickFilter] = useState('ALL');

  // Selected Route Detail State
  const [selectedCycleKey, setSelectedCycleKey] = useState(null);
  const [activeTab, setActiveTab] = useState('tickets'); // 'tickets' | 'stage' | 'party' | 'carton'

  // Summaries State
  const [stageSummary, setStageSummary] = useState([]);
  const [partySummary, setPartySummary] = useState([]);
  const [cartonSummary, setCartonSummary] = useState(null);

  // Ticket Modal State
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [ticketDetail, setTicketDetail] = useState(null);
  const [ticketModalLoading, setTicketModalLoading] = useState(false);

  // Full Screen State
  const [isFullScreen, setIsFullScreen] = useState(false);
  const containerRef = useRef(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Real-time Clock
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Dashboard on Filter Changes
  useEffect(() => {
    fetchDashboard();
  }, [date, routeFilter, slotFilter, stageFilter, statusFilter, priorityFilter, quickFilter, activeWarehouse, currentPage]);

  // Auto Refresh Every 30 Seconds
  useEffect(() => {
    const countdownInterval = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          fetchDashboard(true);
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [date, routeFilter, slotFilter, stageFilter, statusFilter, priorityFilter, quickFilter, activeWarehouse, currentPage]);

  // Listen to Real-time Socket Events
  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      fetchDashboard(true);
    };

    socket.on('pickTicketCreated', handleUpdate);
    socket.on('pickTicketUpdated', handleUpdate);
    socket.on('billingCreated', handleUpdate);
    socket.on('billingUpdated', handleUpdate);
    socket.on('dispatchUpdated', handleUpdate);
    socket.on('deliveryUpdated', handleUpdate);

    return () => {
      socket.off('pickTicketCreated', handleUpdate);
      socket.off('pickTicketUpdated', handleUpdate);
      socket.off('billingCreated', handleUpdate);
      socket.off('billingUpdated', handleUpdate);
      socket.off('dispatchUpdated', handleUpdate);
      socket.off('deliveryUpdated', handleUpdate);
    };
  }, [socket]);

  // Fetch Dashboard Main API
  const fetchDashboard = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const activeStage = quickFilter !== 'ALL' && ['PENDING', 'PICKING', 'BILLING', 'READY', 'DISPATCHED'].includes(quickFilter)
        ? (quickFilter.charAt(0) + quickFilter.slice(1).toLowerCase())
        : stageFilter;

      const activeStatus = quickFilter === 'DELAYED' ? 'Delayed' : statusFilter;

      const res = await axios.get('/api/led/dashboard', {
        params: {
          date,
          route_id: routeFilter,
          dispatch_slot: slotFilter,
          stage: activeStage,
          status: activeStatus,
          priority: priorityFilter,
          search: searchTerm,
          page: currentPage,
          limit: pageSize
        }
      });

      setData(res.data);
      setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));

      // Auto-select initial cycle if not selected
      if (!selectedCycleKey && res.data) {
        const morningFirst = res.data.morningDispatch?.cycles?.[0];
        const eveningFirst = res.data.eveningDispatch?.cycles?.[0];
        const initial = eveningFirst || morningFirst;
        if (initial) {
          setSelectedCycleKey(initial.cycle_key);
        }
      }

      // Fetch Summaries if requested
      if (activeTab === 'stage') fetchStageSummary();
      else if (activeTab === 'party') fetchPartySummary();
      else if (activeTab === 'carton') fetchCartonSummary();

    } catch (err) {
      console.error('Error loading LED dashboard data:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Fetch Stage Summary
  const fetchStageSummary = async () => {
    try {
      const res = await axios.get('/api/led/stage-summary', {
        params: { date, route_id: routeFilter, dispatch_slot: slotFilter }
      });
      setStageSummary(res.data || []);
    } catch (err) {
      console.error('Error fetching stage summary:', err);
    }
  };

  // Fetch Party Summary
  const fetchPartySummary = async () => {
    try {
      const res = await axios.get('/api/led/party-summary', {
        params: { date, route_id: routeFilter, dispatch_slot: slotFilter }
      });
      setPartySummary(res.data || []);
    } catch (err) {
      console.error('Error fetching party summary:', err);
    }
  };

  // Fetch Carton Summary
  const fetchCartonSummary = async () => {
    try {
      const res = await axios.get('/api/led/carton-summary', {
        params: { date, route_id: routeFilter, dispatch_slot: slotFilter }
      });
      setCartonSummary(res.data || null);
    } catch (err) {
      console.error('Error fetching carton summary:', err);
    }
  };

  // Switch Tab
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'stage') fetchStageSummary();
    else if (tab === 'party') fetchPartySummary();
    else if (tab === 'carton') fetchCartonSummary();
  };

  // Open Ticket Details Modal
  const openTicketModal = async (ticketId) => {
    setSelectedTicketId(ticketId);
    setTicketModalLoading(true);
    try {
      const res = await axios.get(`/api/led/pick-tickets/${ticketId}`);
      setTicketDetail(res.data);
    } catch (err) {
      toast.error('Failed to load pick ticket details.');
    } finally {
      setTicketModalLoading(false);
    }
  };

  // Toggle Full Screen Focus Mode
  const toggleFullScreen = () => {
    if (!isFullScreen) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      }
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullScreen(false);
    }
  };

  // Handle Quick Filter Pill Clicks
  const handleQuickFilterClick = (filterName) => {
    setQuickFilter(filterName);
    setCurrentPage(1);
    if (filterName === 'ALL') {
      setStageFilter('ALL');
      setStatusFilter('ALL');
    } else if (filterName === 'DELAYED') {
      setStageFilter('ALL');
      setStatusFilter('Delayed');
    } else {
      setStageFilter(filterName.charAt(0) + filterName.slice(1).toLowerCase());
      setStatusFilter('ALL');
    }
  };

  // Handle Top KPI Click
  const handleKpiClick = (kpiType) => {
    setCurrentPage(1);
    switch (kpiType) {
      case 'PENDING':
        handleQuickFilterClick('PENDING');
        break;
      case 'PICKING':
        handleQuickFilterClick('PICKING');
        break;
      case 'BILLING':
        handleQuickFilterClick('BILLING');
        break;
      case 'READY':
        handleQuickFilterClick('READY');
        break;
      case 'DELAYED':
        handleQuickFilterClick('DELAYED');
        break;
      default:
        handleQuickFilterClick('ALL');
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
    setRouteFilter('ALL');
    setSlotFilter('ALL');
    setStageFilter('ALL');
    setStatusFilter('ALL');
    setPriorityFilter('ALL');
    setSearchTerm('');
    setQuickFilter('ALL');
    setCurrentPage(1);
  };

  // Find currently selected cycle object
  const allCyclesList = useMemo(() => {
    if (!data) return [];
    return [...(data.morningDispatch?.cycles || []), ...(data.eveningDispatch?.cycles || [])];
  }, [data]);

  const selectedCycleObj = useMemo(() => {
    if (!selectedCycleKey || !allCyclesList.length) return allCyclesList[0] || null;
    return allCyclesList.find(c => c.cycle_key === selectedCycleKey) || allCyclesList[0] || null;
  }, [selectedCycleKey, allCyclesList]);

  // Export to Excel
  const handleExportExcel = () => {
    if (!data || !data.tickets?.items?.length) {
      toast.warning('No tickets to export.');
      return;
    }

    const rows = data.tickets.items.map((t, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${t.pick_ticket_no}</td>
        <td>${t.party_name}</td>
        <td>${t.invoices_count}</td>
        <td>${t.cartons}</td>
        <td>${t.current_stage}</td>
        <td>${t.stage_started_time_formatted}</td>
        <td>${t.pending_since_time_formatted}</td>
        <td>${t.aging_formatted}</td>
        <td>${t.priority}</td>
        <td>${t.assigned_to || '-'}</td>
        <td>${t.status}</td>
      </tr>
    `).join('');

    const template = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="utf-8"/></head>
      <body>
        <h3>Dispatch Control LED Report - ${selectedCycleObj?.route_name || 'All Routes'} (${selectedCycleObj?.slot || 'Daily'})</h3>
        <p>Date: ${date} | Generated: ${new Date().toLocaleString()}</p>
        <table border="1">
          <thead>
            <tr style="background:#003366;color:#ffffff;">
              <th>#</th><th>Pick Ticket</th><th>Party Name</th><th>Invoices</th><th>Cartons</th><th>Stage</th>
              <th>Stage Started</th><th>Pending Since</th><th>Aging</th><th>Priority</th><th>Assigned To</th><th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff' + template], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Dispatch_LED_${date}_${selectedCycleObj?.route_name || 'Report'}.xls`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('LED Report exported successfully!');
  };

  const kpis = data?.kpis || {
    activeRoutes: 0,
    totalPickTickets: 0,
    pending: 0,
    picking: 0,
    billing: 0,
    ready: 0,
    delayed: 0
  };

  return (
    <div
      ref={containerRef}
      className={`space-y-4 pb-12 transition-colors duration-200 ${
        isFullScreen ? 'bg-[#f4f7fb] p-6 min-h-screen overflow-y-auto' : ''
      }`}
    >
      {/* ── Top Header Bar ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#003366] text-white flex items-center justify-center shadow-sm">
            <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black text-[#003366] tracking-tight">
                Dispatch Control - LED
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                LIVE
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Real-time monitoring of today’s route dispatch and Pick Ticket status
            </p>
          </div>
        </div>

        {/* Header Right Status Meta */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
          {/* Live Clock */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-700 shadow-xs">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            <span>
              {currentTime.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, {currentTime.toLocaleTimeString('en-IN')}
            </span>
          </div>

          {/* System Live Indicator */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold shadow-xs ${
            isConnected ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
            <span>{isConnected ? 'System Live' : 'Polling Active'}</span>
          </div>

          {/* User & Role Badge */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 font-bold">
            <User className="w-3.5 h-3.5 text-blue-600" />
            <span>{user?.full_name || 'Admin'}</span>
            <span className="text-[10px] bg-blue-200/80 text-blue-800 px-1.5 py-0.5 rounded uppercase font-extrabold">
              {user?.role || 'Dispatcher'}
            </span>
          </div>

          {/* Full Screen Focus Toggle */}
          <button
            onClick={toggleFullScreen}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer shadow-xs"
            title={isFullScreen ? 'Exit Full Screen' : 'Full Screen Focus Mode'}
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── 7 Top Interactive KPI Cards ────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* 1. Active Routes */}
        <div
          onClick={() => handleKpiClick('ALL')}
          className={`bg-white border rounded-2xl p-3.5 flex items-center gap-3 shadow-xs cursor-pointer hover:border-blue-300 hover:shadow-md transition-all ${
            quickFilter === 'ALL' ? 'ring-2 ring-blue-500 border-blue-400 bg-blue-50/20' : 'border-slate-200'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Truck className="w-5 h-5" />
          </div>
          <div className="min-w-0 overflow-hidden">
            <div className="text-xl sm:text-2xl font-black text-slate-900 leading-none">{kpis.activeRoutes}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1 truncate">Active Routes</div>
          </div>
        </div>

        {/* 2. Total Pick Tickets */}
        <div
          onClick={() => handleKpiClick('ALL')}
          className={`bg-white border rounded-2xl p-3.5 flex items-center gap-3 shadow-xs cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all ${
            quickFilter === 'ALL' ? 'ring-2 ring-indigo-500 border-indigo-400 bg-indigo-50/20' : 'border-slate-200'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div className="min-w-0 overflow-hidden">
            <div className="text-xl sm:text-2xl font-black text-slate-900 leading-none">{kpis.totalPickTickets}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1 truncate">Total Pick Tickets</div>
          </div>
        </div>

        {/* 3. Pending */}
        <div
          onClick={() => handleKpiClick('PENDING')}
          className={`bg-white border rounded-2xl p-3.5 flex items-center gap-3 shadow-xs cursor-pointer hover:border-red-300 hover:shadow-md transition-all ${
            quickFilter === 'PENDING' ? 'ring-2 ring-red-500 border-red-400 bg-red-50/30' : 'border-slate-200'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0 overflow-hidden">
            <div className="text-xl sm:text-2xl font-black text-red-600 leading-none">{kpis.pending}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1 truncate">Pending</div>
          </div>
        </div>

        {/* 4. Picking */}
        <div
          onClick={() => handleKpiClick('PICKING')}
          className={`bg-white border rounded-2xl p-3.5 flex items-center gap-3 shadow-xs cursor-pointer hover:border-amber-300 hover:shadow-md transition-all ${
            quickFilter === 'PICKING' ? 'ring-2 ring-amber-500 border-amber-400 bg-amber-50/30' : 'border-slate-200'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <PackageCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0 overflow-hidden">
            <div className="text-xl sm:text-2xl font-black text-amber-600 leading-none">{kpis.picking}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1 truncate">Picking</div>
          </div>
        </div>

        {/* 5. Billing */}
        <div
          onClick={() => handleKpiClick('BILLING')}
          className={`bg-white border rounded-2xl p-3.5 flex items-center gap-3 shadow-xs cursor-pointer hover:border-yellow-300 hover:shadow-md transition-all ${
            quickFilter === 'BILLING' ? 'ring-2 ring-yellow-500 border-yellow-400 bg-yellow-50/30' : 'border-slate-200'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-yellow-50 text-yellow-600 flex items-center justify-center shrink-0 border border-yellow-100">
            <Receipt className="w-5 h-5" />
          </div>
          <div className="min-w-0 overflow-hidden">
            <div className="text-xl sm:text-2xl font-black text-yellow-600 leading-none">{kpis.billing}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1 truncate">Billing</div>
          </div>
        </div>

        {/* 6. Ready */}
        <div
          onClick={() => handleKpiClick('READY')}
          className={`bg-white border rounded-2xl p-3.5 flex items-center gap-3 shadow-xs cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all ${
            quickFilter === 'READY' ? 'ring-2 ring-emerald-500 border-emerald-400 bg-emerald-50/30' : 'border-slate-200'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0 overflow-hidden">
            <div className="text-xl sm:text-2xl font-black text-emerald-600 leading-none">{kpis.ready}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1 truncate">Ready</div>
          </div>
        </div>

        {/* 7. Delayed */}
        <div
          onClick={() => handleKpiClick('DELAYED')}
          className={`bg-white border rounded-2xl p-3.5 flex items-center gap-3 shadow-xs cursor-pointer hover:border-red-400 hover:shadow-md transition-all col-span-2 sm:col-span-1 ${
            quickFilter === 'DELAYED' ? 'ring-2 ring-red-600 border-red-500 bg-red-100/40' : 'border-slate-200'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0 border border-red-200">
            <AlertOctagon className="w-5 h-5 animate-pulse" />
          </div>
          <div className="min-w-0 overflow-hidden">
            <div className="text-xl sm:text-2xl font-black text-red-700 leading-none">{kpis.delayed}</div>
            <div className="text-[11px] font-bold text-slate-500 mt-1 truncate">Delayed</div>
          </div>
        </div>
      </div>

      {/* ── Multi-Filter Bar ────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 p-3.5 sm:p-4 rounded-2xl shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* Date Picker */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center gap-1">
              <Calendar className="w-3 h-3 text-indigo-600" /> Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-600 focus:outline-none"
            />
          </div>

          {/* Route Dropdown */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center gap-1">
              <RouteIcon className="w-3 h-3 text-indigo-600" /> Route
            </label>
            <select
              value={routeFilter}
              onChange={(e) => { setRouteFilter(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-600 focus:outline-none truncate"
            >
              <option value="ALL">All Routes</option>
              {(data?.routes || []).map(r => (
                <option key={r.id} value={r.id}>{r.route_name}</option>
              ))}
            </select>
          </div>

          {/* Dispatch Slot */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center gap-1">
              <Sun className="w-3 h-3 text-amber-500" /> Dispatch
            </label>
            <select
              value={slotFilter}
              onChange={(e) => { setSlotFilter(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-600 focus:outline-none"
            >
              <option value="ALL">All Shifts</option>
              <option value="Morning">Morning</option>
              <option value="Evening">Evening</option>
            </select>
          </div>

          {/* Stage Dropdown */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center gap-1">
              <SlidersHorizontal className="w-3 h-3 text-indigo-600" /> Stage
            </label>
            <select
              value={stageFilter}
              onChange={(e) => { setStageFilter(e.target.value); setQuickFilter('ALL'); setCurrentPage(1); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-600 focus:outline-none"
            >
              <option value="ALL">All Stages</option>
              <option value="Pending">Pending</option>
              <option value="Picking">Picking</option>
              <option value="Billing">Billing</option>
              <option value="Ready">Ready</option>
              <option value="Dispatched">Dispatched</option>
              <option value="Hold">Hold</option>
            </select>
          </div>

          {/* Status Dropdown */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center gap-1">
              <Filter className="w-3 h-3 text-indigo-600" /> Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setQuickFilter('ALL'); setCurrentPage(1); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-600 focus:outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="Pending">Pending</option>
              <option value="In Process">In Progress</option>
              <option value="Ready">Ready</option>
              <option value="Completed">Completed</option>
              <option value="Delayed">Delayed</option>
              <option value="Hold">Hold</option>
            </select>
          </div>

          {/* Search Input & Action Buttons */}
          <div className="space-y-1">
            <label className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider flex items-center gap-1">
              <Search className="w-3 h-3 text-indigo-600" /> Search
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Pick Ticket / Party..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchDashboard()}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 pr-8 text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-600 focus:outline-none"
              />
              <button
                onClick={() => fetchDashboard()}
                className="absolute right-1.5 top-1.5 p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"
                title="Search"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Filter Pills Row & Auto-Refresh Status */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2.5 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            {['ALL', 'PENDING', 'PICKING', 'BILLING', 'READY', 'DISPATCHED', 'DELAYED'].map((pill) => {
              const isActive = quickFilter === pill;
              return (
                <button
                  key={pill}
                  onClick={() => handleQuickFilterClick(pill)}
                  className={`px-3 py-1 rounded-full text-[11px] font-extrabold transition-all cursor-pointer ${
                    isActive
                      ? pill === 'DELAYED'
                        ? 'bg-red-600 text-white shadow-xs'
                        : 'bg-[#003366] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {pill}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4 text-xs shrink-0 self-end sm:self-auto">
            <button
              onClick={handleResetFilters}
              className="text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1 cursor-pointer text-[11px]"
            >
              Reset
            </button>

            <button
              onClick={() => fetchDashboard()}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <div className="flex items-center gap-2 text-slate-500 text-[11px] font-medium font-mono">
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Auto refresh: {refreshCountdown}s
              </span>
              <span className="text-slate-300">|</span>
              <span>Last: {lastUpdated || 'Just now'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Next Dispatch Banner ──────────────────────────────────── */}
      {data?.nextDispatch ? (
        <div className="bg-linear-to-r from-amber-50 to-orange-50 border border-amber-200/90 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 text-xs font-bold text-amber-950">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-200/70 text-amber-900 uppercase tracking-wider text-[11px] font-black">
              <Clock className="w-3.5 h-3.5 text-amber-800" />
              <span>Next Dispatch</span>
            </div>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <span className="text-sm font-black text-slate-900 uppercase">
              {data.nextDispatch.route_name} ({data.nextDispatch.slot})
            </span>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <span className="text-slate-700 font-semibold">
              Cut-off: <strong className="text-slate-900">{data.nextDispatch.cutoff_time_formatted}</strong>
            </span>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <span className="text-slate-700 font-semibold">
              Dispatch: <strong className="text-slate-900">{data.nextDispatch.dispatch_time_formatted}</strong>
            </span>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <span className={`font-mono font-bold ${data.nextDispatch.is_delayed ? 'text-red-700 font-black animate-pulse' : 'text-amber-800'}`}>
              Time Remaining: {data.nextDispatch.time_remaining}
            </span>
          </div>

          <button
            onClick={() => {
              setSelectedCycleKey(data.nextDispatch.cycle_key);
              const element = document.getElementById('route-details-panel');
              if (element) element.scrollIntoView({ behavior: 'smooth' });
            }}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 self-start sm:self-auto transition-all"
          >
            <span>View Details</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : null}

      {/* ── Dispatch Sections: Morning & Evening Horizontal Cards ── */}
      <div className="space-y-4">
        {/* ☀️ Morning Dispatch Section */}
        {data?.morningDispatch?.cycles?.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                Morning Dispatch <span className="text-slate-400 font-bold">({data.morningDispatch.count} Routes)</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {data.morningDispatch.cycles.map((cycle) => {
                const isSelected = selectedCycleKey === cycle.cycle_key;
                return (
                  <div
                    key={cycle.cycle_key}
                    onClick={() => setSelectedCycleKey(cycle.cycle_key)}
                    className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer shadow-xs hover:shadow-md ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <h4 className="font-black text-sm text-slate-900 truncate">
                        {cycle.route_name}
                      </h4>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${cycle.statusClass}`}>
                        {cycle.statusBadge}
                      </span>
                    </div>

                    {/* Subtitle / Timing */}
                    <div className="text-[11px] text-slate-500 font-medium space-y-0.5 mb-3">
                      <div className="flex justify-between">
                        <span>Morning | Dispatch {cycle.dispatch_time_formatted}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Cut-off: {cycle.cutoff_time_formatted}</span>
                        <span className={`font-bold font-mono text-[10px] ${cycle.isDelayed ? 'text-red-600' : 'text-emerald-700'}`}>
                          {cycle.timeRemaining}
                        </span>
                      </div>
                    </div>

                    {/* Breakdown Numbers */}
                    <div className="grid grid-cols-5 gap-1 text-center bg-slate-50/80 p-2 rounded-xl border border-slate-100 mb-3 text-xs">
                      <div>
                        <div className="font-black text-slate-900">{cycle.metrics.total}</div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">Total</div>
                      </div>
                      <div>
                        <div className="font-black text-red-600">{cycle.metrics.pending}</div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">Pending</div>
                      </div>
                      <div>
                        <div className="font-black text-amber-600">{cycle.metrics.picking}</div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">Picking</div>
                      </div>
                      <div>
                        <div className="font-black text-yellow-600">{cycle.metrics.billing}</div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">Billing</div>
                      </div>
                      <div>
                        <div className="font-black text-emerald-600">
                          {cycle.metrics.dispatched > 0 ? cycle.metrics.dispatched : cycle.metrics.ready}
                        </div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">
                          {cycle.metrics.dispatched > 0 ? 'Dispatched' : 'Ready'}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                        <span>Progress</span>
                        <span className="text-[#003366] font-black">{cycle.progress_pct}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            cycle.progress_pct === 100
                              ? 'bg-emerald-500'
                              : cycle.isDelayed
                              ? 'bg-red-500'
                              : 'bg-emerald-600'
                          }`}
                          style={{ width: `${cycle.progress_pct}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 🌙 Evening Dispatch Section */}
        {data?.eveningDispatch?.cycles?.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Moon className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                Evening Dispatch <span className="text-slate-400 font-bold">({data.eveningDispatch.count} Routes)</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {data.eveningDispatch.cycles.map((cycle) => {
                const isSelected = selectedCycleKey === cycle.cycle_key;
                return (
                  <div
                    key={cycle.cycle_key}
                    onClick={() => setSelectedCycleKey(cycle.cycle_key)}
                    className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer shadow-xs hover:shadow-md ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/10'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <h4 className="font-black text-sm text-slate-900 truncate">
                        {cycle.route_name}
                      </h4>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${cycle.statusClass}`}>
                        {cycle.statusBadge}
                      </span>
                    </div>

                    {/* Subtitle / Timing */}
                    <div className="text-[11px] text-slate-500 font-medium space-y-0.5 mb-3">
                      <div className="flex justify-between">
                        <span>Evening | Dispatch {cycle.dispatch_time_formatted}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-600">
                        <span>Cut-off: {cycle.cutoff_time_formatted}</span>
                        <span className={`font-bold font-mono text-[10px] ${cycle.isDelayed ? 'text-red-600' : 'text-emerald-700'}`}>
                          {cycle.timeRemaining}
                        </span>
                      </div>
                    </div>

                    {/* Breakdown Numbers */}
                    <div className="grid grid-cols-5 gap-1 text-center bg-slate-50/80 p-2 rounded-xl border border-slate-100 mb-3 text-xs">
                      <div>
                        <div className="font-black text-slate-900">{cycle.metrics.total}</div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">Total</div>
                      </div>
                      <div>
                        <div className="font-black text-red-600">{cycle.metrics.pending}</div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">Pending</div>
                      </div>
                      <div>
                        <div className="font-black text-amber-600">{cycle.metrics.picking}</div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">Picking</div>
                      </div>
                      <div>
                        <div className="font-black text-yellow-600">{cycle.metrics.billing}</div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">Billing</div>
                      </div>
                      <div>
                        <div className="font-black text-emerald-600">
                          {cycle.metrics.dispatched > 0 ? cycle.metrics.dispatched : cycle.metrics.ready}
                        </div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase">
                          {cycle.metrics.dispatched > 0 ? 'Dispatched' : 'Ready'}
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                        <span>Progress</span>
                        <span className="text-[#003366] font-black">{cycle.progress_pct}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            cycle.progress_pct === 100
                              ? 'bg-emerald-500'
                              : cycle.isDelayed
                              ? 'bg-red-500'
                              : 'bg-emerald-600'
                          }`}
                          style={{ width: `${cycle.progress_pct}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Route Details & Summaries Panel ───────────────────────── */}
      <div id="route-details-panel" className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Panel Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedCycleKey(null)}
              className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer shadow-2xs"
              title="All Routes View"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                {selectedCycleObj ? `${selectedCycleObj.route_name} - ${selectedCycleObj.slot} Dispatch` : 'All Routes Active Dispatch'}
              </h3>
              {selectedCycleObj && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-semibold mt-0.5">
                  <span>Cut-off: <strong className="text-slate-800">{selectedCycleObj.cutoff_time_formatted}</strong></span>
                  <span>|</span>
                  <span>Dispatch: <strong className="text-slate-800">{selectedCycleObj.dispatch_time_formatted}</strong></span>
                  <span>|</span>
                  <span className={`font-mono ${selectedCycleObj.isDelayed ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold'}`}>
                    Time Remaining: {selectedCycleObj.timeRemaining}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={handleExportExcel}
              className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export</span>
            </button>
            <button
              onClick={() => window.print()}
              className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-600" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 px-4 pt-2 gap-4 bg-white text-xs font-bold">
          <button
            onClick={() => handleTabChange('tickets')}
            className={`pb-3 px-2 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'tickets'
                ? 'border-indigo-600 text-indigo-600 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Pick Tickets ({data?.tickets?.pagination?.totalCount || 0})
          </button>
          <button
            onClick={() => handleTabChange('stage')}
            className={`pb-3 px-2 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'stage'
                ? 'border-indigo-600 text-indigo-600 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Stage Summary
          </button>
          <button
            onClick={() => handleTabChange('party')}
            className={`pb-3 px-2 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'party'
                ? 'border-indigo-600 text-indigo-600 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Party Summary
          </button>
          <button
            onClick={() => handleTabChange('carton')}
            className={`pb-3 px-2 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'carton'
                ? 'border-indigo-600 text-indigo-600 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Carton Summary
          </button>
        </div>

        {/* Tab 1: Pick Tickets Dense WMS Table */}
        {activeTab === 'tickets' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="p-3 text-center w-10">#</th>
                  <th className="p-3">Pick Ticket</th>
                  <th className="p-3">Party Name</th>
                  <th className="p-3 text-center w-16">Invoices</th>
                  <th className="p-3 text-center w-16">Cartons</th>
                  <th className="p-3">Current Stage</th>
                  <th className="p-3">Stage Started At</th>
                  <th className="p-3">Pending Since</th>
                  <th className="p-3 text-center">Aging</th>
                  <th className="p-3 text-center">Priority</th>
                  <th className="p-3">Assigned To</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center w-20">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                {data?.tickets?.items?.length === 0 ? (
                  <tr>
                    <td colSpan="13" className="text-center py-12 text-slate-400 font-bold">
                      No Pick Tickets found for this dispatch cycle.
                    </td>
                  </tr>
                ) : (
                  data?.tickets?.items?.map((ticket, idx) => {
                    const rowNumber = (data.tickets.pagination.startIndex || 1) + idx;
                    return (
                      <tr key={ticket.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="p-3 text-center font-bold text-slate-400">{rowNumber}</td>
                        <td className="p-3 font-mono font-bold text-[#004c8f]">
                          {ticket.pick_ticket_no}
                        </td>
                        <td className="p-3 font-bold text-slate-900">
                          {ticket.party_name}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-700">
                          {ticket.invoices_count}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-700">
                          {ticket.cartons}
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold ${
                            ticket.current_stage === 'Picking'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : ticket.current_stage === 'Billing'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : ticket.current_stage === 'Ready'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : ticket.current_stage === 'Dispatched'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {ticket.current_stage}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 font-mono">
                          {ticket.stage_started_time_formatted}
                        </td>
                        <td className="p-3 text-slate-600 font-mono">
                          {ticket.pending_since_time_formatted}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-mono border ${ticket.aging_color}`}>
                            {ticket.aging_formatted}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                            ticket.priority === 'High'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : ticket.priority === 'Medium'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {ticket.priority}
                          </span>
                        </td>
                        <td className="p-3 text-slate-700 font-semibold">
                          {ticket.assigned_to || '-'}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                            ticket.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-700'
                              : ticket.status === 'Ready'
                              ? 'bg-emerald-50 text-emerald-700'
                              : ticket.status === 'In Process'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-amber-50 text-amber-800'
                          }`}>
                            {ticket.status}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => openTicketModal(ticket.id)}
                            className="px-2.5 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors cursor-pointer"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {data?.tickets?.pagination?.totalPages > 1 && (
              <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div className="text-slate-500 font-semibold">
                  Showing {data.tickets.pagination.startIndex} to {data.tickets.pagination.endIndex} of {data.tickets.pagination.totalCount} records
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {Array.from({ length: data.tickets.pagination.totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setCurrentPage(p)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        currentPage === p
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {p}
                    </button>
                  ))}

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(data.tickets.pagination.totalPages, p + 1))}
                    disabled={currentPage >= data.tickets.pagination.totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Stage Summary */}
        {activeTab === 'stage' && (
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase text-slate-500">
                  <th className="p-3">Stage Name</th>
                  <th className="p-3 text-center">Pick Tickets</th>
                  <th className="p-3 text-center">Total Cartons</th>
                  <th className="p-3 text-right">Invoice Amount (₹)</th>
                  <th className="p-3 text-center">Avg Aging</th>
                  <th className="p-3 text-center">% Workload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                {stageSummary.map((s) => (
                  <tr key={s.stage} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{s.stage}</td>
                    <td className="p-3 text-center font-bold text-[#003366]">{s.count}</td>
                    <td className="p-3 text-center">{s.cartons}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-700">
                      ₹{Number(s.invoice_amount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 text-center font-mono">{s.avg_aging_formatted}</td>
                    <td className="p-3 text-center font-bold">{s.pct_of_total}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 3: Party Summary */}
        {activeTab === 'party' && (
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase text-slate-500">
                  <th className="p-3">Party Code</th>
                  <th className="p-3">Party Name</th>
                  <th className="p-3 text-center">Tickets</th>
                  <th className="p-3 text-center">Invoices</th>
                  <th className="p-3 text-center">Cartons</th>
                  <th className="p-3 text-center text-red-600">Pending</th>
                  <th className="p-3 text-center text-amber-600">Picking</th>
                  <th className="p-3 text-center text-yellow-600">Billing</th>
                  <th className="p-3 text-center text-emerald-600">Ready</th>
                  <th className="p-3 text-center text-purple-600">Dispatched</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                {partySummary.map((p) => (
                  <tr key={p.party_code} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-[#004c8f]">{p.party_code}</td>
                    <td className="p-3 font-bold text-slate-900">{p.party_name}</td>
                    <td className="p-3 text-center font-bold">{p.total_tickets}</td>
                    <td className="p-3 text-center">{p.invoices}</td>
                    <td className="p-3 text-center">{p.cartons}</td>
                    <td className="p-3 text-center text-red-600 font-bold">{p.pending}</td>
                    <td className="p-3 text-center text-amber-600 font-bold">{p.picking}</td>
                    <td className="p-3 text-center text-yellow-600 font-bold">{p.billing}</td>
                    <td className="p-3 text-center text-emerald-600 font-bold">{p.ready}</td>
                    <td className="p-3 text-center text-purple-600 font-bold">{p.dispatched}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 4: Carton Summary */}
        {activeTab === 'carton' && cartonSummary && (
          <div className="p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
              <div className="text-2xl font-black text-slate-900">{cartonSummary.total}</div>
              <div className="text-xs text-slate-500 font-bold uppercase mt-1">Total Cartons</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center">
              <div className="text-2xl font-black text-amber-700">{cartonSummary.picked}</div>
              <div className="text-xs text-amber-700 font-bold uppercase mt-1">Picked</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-center">
              <div className="text-2xl font-black text-yellow-700">{cartonSummary.billed}</div>
              <div className="text-xs text-yellow-700 font-bold uppercase mt-1">Billed</div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
              <div className="text-2xl font-black text-emerald-700">{cartonSummary.ready}</div>
              <div className="text-xs text-emerald-700 font-bold uppercase mt-1">Ready</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
              <div className="text-2xl font-black text-blue-700">{cartonSummary.loaded}</div>
              <div className="text-xs text-blue-700 font-bold uppercase mt-1">Loaded</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 text-center">
              <div className="text-2xl font-black text-purple-700">{cartonSummary.dispatched}</div>
              <div className="text-xs text-purple-700 font-bold uppercase mt-1">Dispatched</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Ticket Detail Slide-Over Modal / Drawer ───────────────── */}
      {selectedTicketId && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-[#003366] text-white rounded-t-2xl">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-base">{ticketDetail?.pick_ticket_no || 'Pick Ticket Details'}</span>
                  {ticketDetail?.priority && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-red-500 text-white">
                      {ticketDetail.priority} Priority
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-200 mt-0.5">
                  Route: {ticketDetail?.route_name} ({ticketDetail?.dispatch_slot})
                </p>
              </div>

              <button
                onClick={() => setSelectedTicketId(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            {ticketModalLoading ? (
              <div className="p-12 text-center text-indigo-600 font-bold text-xs">
                Loading Pick Ticket Details...
              </div>
            ) : ticketDetail ? (
              <div className="p-5 space-y-5 text-xs text-slate-700">
                {/* Visual Stage Timeline */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Stage Progression Timeline
                  </h4>
                  <div className="grid grid-cols-7 gap-1 text-center pt-2">
                    {ticketDetail.timeline?.map((st, i) => (
                      <div key={st.stage} className="space-y-1">
                        <div className="flex items-center justify-center">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            st.state === 'completed'
                              ? 'bg-emerald-600 text-white'
                              : st.state === 'current'
                              ? 'bg-blue-600 text-white animate-pulse ring-4 ring-blue-100'
                              : 'bg-slate-200 text-slate-500'
                          }`}>
                            {st.state === 'completed' ? <Check className="w-3.5 h-3.5" /> : i + 1}
                          </div>
                        </div>
                        <div className={`text-[10px] font-bold ${st.state === 'current' ? 'text-blue-700' : 'text-slate-600'}`}>
                          {st.stage}
                        </div>
                        {st.timestamp && (
                          <div className="text-[9px] font-mono text-slate-400">{st.timestamp}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Party & Order Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 bg-slate-50/70 p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Party Details</span>
                    <p className="font-extrabold text-slate-900 text-sm">{ticketDetail.party_name}</p>
                    <p className="font-mono text-xs text-indigo-700 font-bold">{ticketDetail.party_code}</p>
                    <p className="text-slate-500 text-[11px]">{ticketDetail.party_address || 'Address on file'}</p>
                  </div>

                  <div className="space-y-1.5 bg-slate-50/70 p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Order & Quantities</span>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Order Ref:</span>
                      <span className="font-bold text-slate-800">{ticketDetail.customer_order_no || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cartons / Qty:</span>
                      <span className="font-bold text-indigo-700">{ticketDetail.qty_in_pick_ticket}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Aging:</span>
                      <span className="font-bold font-mono text-red-600">{ticketDetail.aging_formatted}</span>
                    </div>
                  </div>
                </div>

                {/* Billing & Dispatch Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 bg-slate-50/70 p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Billing Invoice</span>
                    {ticketDetail.billing ? (
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Bill No:</span>
                          <span className="font-mono font-bold text-emerald-700">{ticketDetail.billing.bill_no}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Invoice Amount:</span>
                          <span className="font-bold text-slate-900">₹{Number(ticketDetail.billing.invoice_amount || 0).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-400 italic">Not yet billed</p>
                    )}
                  </div>

                  <div className="space-y-1.5 bg-slate-50/70 p-3 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Picker / Staff Assigned</span>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Picker:</span>
                        <span className="font-bold text-slate-800">{ticketDetail.picker?.name || 'Unassigned'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Contact:</span>
                        <span className="font-mono text-slate-600">{ticketDetail.picker?.mobile || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setSelectedTicketId(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}