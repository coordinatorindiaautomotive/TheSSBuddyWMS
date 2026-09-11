import React, { useEffect, useState, useRef, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import {
  Route as RouteIcon,
  Clock,
  PackageCheck,
  Receipt,
  CheckCircle2,
  AlertOctagon,
  Search,
  RefreshCw,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  Truck,
  Eye,
  X,
  ChevronRight,
  Layers,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  Flame,
  Filter,
  ArrowUpRight,
  FileText,
  UserCheck,
  Building2,
  Check,
  Calendar
} from 'lucide-react';

export default function LEDDashboard() {
  const navigate = useNavigate();
  const { user, activeWarehouse } = useAuth();
  const { socket } = useSocket();
  const toast = useToast();

  // Primary State
  const [data, setData] = useState(null);
  const [masterRoutes, setMasterRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshCountdown, setRefreshCountdown] = useState(30);

  // Filters State
  const [selectedRoute, setSelectedRoute] = useState('ALL');
  const [selectedSlot, setSelectedSlot] = useState('ALL'); // 'ALL' | 'Morning' | 'Evening'
  const [selectedStage, setSelectedStage] = useState('ALL'); // 'ALL' | 'Pending' | 'Picking' | 'Billing' | 'Ready' | 'Dispatched'
  const [showUnbilledOnly, setShowUnbilledOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Ticket Detail Drawer State
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [ticketDetail, setTicketDetail] = useState(null);
  const [ticketModalLoading, setTicketModalLoading] = useState(false);

  // Full Screen State
  const [isFullScreen, setIsFullScreen] = useState(false);
  const containerRef = useRef(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Real-time Clock (IST)
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Master Routes on Warehouse change
  useEffect(() => {
    axios.get('/api/masters/routes')
      .then(res => setMasterRoutes(res.data || []))
      .catch(() => {});
  }, [activeWarehouse]);

  // Fetch Dashboard Data
  const fetchDashboard = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await axios.get('/api/led/dashboard', {
        params: {
          date: 'ALL',
          route_id: 'ALL',
          dispatch_slot: 'ALL',
          limit: 5000
        }
      });
      setData(res.data);
    } catch (err) {
      console.error('Error loading LED dashboard:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [activeWarehouse]);

  // Auto Refresh Countdown
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
  }, [activeWarehouse]);

  // Socket event listener
  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => fetchDashboard(true);
    socket.on('pickTicketCreated', handleUpdate);
    socket.on('pickTicketUpdated', handleUpdate);
    socket.on('billingCreated', handleUpdate);
    socket.on('billingUpdated', handleUpdate);
    socket.on('dispatchUpdated', handleUpdate);

    return () => {
      socket.off('pickTicketCreated', handleUpdate);
      socket.off('pickTicketUpdated', handleUpdate);
      socket.off('billingCreated', handleUpdate);
      socket.off('billingUpdated', handleUpdate);
      socket.off('dispatchUpdated', handleUpdate);
    };
  }, [socket]);

  // Open Ticket Details Modal
  const openTicketModal = async (ticketId) => {
    setSelectedTicketId(ticketId);
    setTicketModalLoading(true);
    try {
      const res = await axios.get('/api/led/pick-tickets/' + ticketId);
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

  const normalizeRouteKey = (r) => {
    if (!r) return '';
    return String(r).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  const checkRoutesMatch = (r1, r2) => {
    const k1 = normalizeRouteKey(r1);
    const k2 = normalizeRouteKey(r2);
    if (!k1 || !k2) return false;
    return k1 === k2;
  };

  // Extract all tickets
  const rawTickets = data?.tickets?.allItems || data?.tickets?.items || [];

  // Build unified authoritative route list
  const routesList = useMemo(() => {
    const routesMap = new Map();

    // From Master Routes
    masterRoutes.forEach(mr => {
      const name = String(mr.route_name || mr.name || '').trim();
      const k = normalizeRouteKey(name);
      if (k && k !== 'unassigned' && !routesMap.has(k)) {
        routesMap.set(k, {
          id: mr.id || name,
          route_name: name,
          route_code: mr.route_code || name.substring(0, 10).toUpperCase(),
          unbilled_count: 0,
          total_count: 0
        });
      }
    });

    // From API data.routes
    (data?.routes || []).forEach(r => {
      const name = String(r.route_name || r.name || '').trim();
      const k = normalizeRouteKey(name);
      if (k && k !== 'unassigned') {
        if (!routesMap.has(k)) {
          routesMap.set(k, {
            id: r.id || name,
            route_name: name,
            route_code: r.route_code || name.substring(0, 10).toUpperCase(),
            unbilled_count: r.unbilled_count || 0,
            total_count: r.total_count || 0
          });
        }
      }
    });

    // From loaded Pick Tickets
    rawTickets.forEach(t => {
      const name = String(t.route_name || t.ticket_route || t.party_route || t.route || '').trim();
      const k = normalizeRouteKey(name);
      if (k && k !== 'unassigned' && !routesMap.has(k)) {
        routesMap.set(k, {
          id: name,
          route_name: name,
          route_code: name.substring(0, 10).toUpperCase(),
          unbilled_count: 0,
          total_count: 0
        });
      }
    });

    // Calculate live counts for each route
    routesMap.forEach(r => {
      const rTickets = rawTickets.filter(t =>
        checkRoutesMatch(t.route_name, r.route_name)
      );
      r.total_count = rTickets.length;
      r.unbilled_count = rTickets.filter(t => !t.is_billed && t.current_stage !== 'Cancelled').length;
    });

    return Array.from(routesMap.values()).sort((a, b) => {
      if (b.unbilled_count !== a.unbilled_count) return b.unbilled_count - a.unbilled_count;
      return a.route_name.localeCompare(b.route_name);
    });
  }, [masterRoutes, data, rawTickets]);

  const selectedRouteObj = selectedRoute !== 'ALL'
    ? routesList.find(r => checkRoutesMatch(r.route_name, selectedRoute))
    : null;

  // Filter tickets based on selection
  const filteredTickets = useMemo(() => {
    return rawTickets.filter(t => {
      // Route Filter
      if (selectedRoute !== 'ALL') {
        const targetRouteName = selectedRouteObj ? selectedRouteObj.route_name : selectedRoute;
        const isMatch = checkRoutesMatch(t.route_name, targetRouteName);
        if (!isMatch) return false;
      }

      // Slot Filter
      if (selectedSlot !== 'ALL') {
        const tSlot = String(t.dispatch_slot || 'Morning').toLowerCase();
        if (tSlot !== selectedSlot.toLowerCase()) return false;
      }

      // Stage Filter
      if (selectedStage !== 'ALL') {
        if (selectedStage === 'Pending') {
          if (t.is_billed || t.current_stage === 'Ready' || t.current_stage === 'Dispatched' || t.current_stage === 'Cancelled' || t.bill_no) {
            return false;
          }
        } else if (selectedStage === 'Ready') {
          if (!t.is_billed || t.current_stage === 'Dispatched' || t.current_stage === 'Cancelled') {
            return false;
          }
        } else if (selectedStage === 'Dispatched') {
          if (t.current_stage !== 'Dispatched') {
            return false;
          }
        }
      }

      // Unbilled Only Filter
      if (showUnbilledOnly && t.is_billed) return false;

      // Search Filter
      if (searchTerm && searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchNo = String(t.pick_ticket_no || '').toLowerCase().includes(term);
        const matchParty = String(t.party_name || '').toLowerCase().includes(term) || String(t.party_code || '').toLowerCase().includes(term);
        const matchRoute = String(t.route_name || t.party_route || t.ticket_route || '').toLowerCase().includes(term);
        const matchOrder = String(t.customer_order_no || '').toLowerCase().includes(term);
        const matchPicker = String(t.picker_name || t.assigned_to || '').toLowerCase().includes(term);
        const matchBill = String(t.bill_no || '').toLowerCase().includes(term);
        if (!matchNo && !matchParty && !matchRoute && !matchOrder && !matchPicker && !matchBill) return false;
      }

      return true;
    });
  }, [rawTickets, selectedRoute, selectedRouteObj, selectedSlot, selectedStage, showUnbilledOnly, searchTerm]);

  // Overall KPIs
  const totalTickets = rawTickets.length;
  const pendingTickets = rawTickets.filter(t => !t.is_billed && t.current_stage !== 'Cancelled');
  const pickingTickets = rawTickets.filter(t => t.current_stage === 'Picking');
  const readyTickets = rawTickets.filter(t => t.is_billed && t.current_stage !== 'Dispatched');
  const dispatchedTickets = rawTickets.filter(t => t.current_stage === 'Dispatched');
  const criticalDelayedCount = rawTickets.filter(t => !t.is_billed && (t.aging_level === 'Critical' || t.aging_minutes >= 60)).length;
  const totalCartons = rawTickets.reduce((sum, t) => sum + (t.cartons || 1), 0);

  // Filtered Set KPIs
  const filteredCartons = filteredTickets.reduce((sum, t) => sum + (t.cartons || 1), 0);
  const filteredPending = filteredTickets.filter(t => !t.is_billed && t.current_stage !== 'Cancelled').length;
  const filteredReady = filteredTickets.filter(t => t.is_billed).length;

  // Next Dispatch Details
  const nextDispatch = data?.nextDispatch || null;

  // Cycles
  const morningCycles = data?.morningDispatch?.cycles || [];
  const eveningCycles = data?.eveningDispatch?.cycles || [];

  const displayMorningCycle = selectedRouteObj
    ? morningCycles.find(c => checkRoutesMatch(c.route_name, selectedRouteObj.route_name, c.route_code, selectedRouteObj.route_code))
    : morningCycles[0] || null;

  const displayEveningCycle = selectedRouteObj
    ? eveningCycles.find(c => checkRoutesMatch(c.route_name, selectedRouteObj.route_name, c.route_code, selectedRouteObj.route_code))
    : eveningCycles[0] || null;

  // Pagination for table
  const totalPages = Math.ceil(filteredTickets.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedTickets = filteredTickets.slice(startIndex, startIndex + pageSize);

  return (
    <div ref={containerRef} className="space-y-3.5 w-full p-2 sm:p-4 min-h-screen bg-slate-900 text-slate-100 selection:bg-blue-600 selection:text-white font-sans">
      
      {/* ── Top Header Bar ────────────────────────────────────────── */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3 sm:p-4 shadow-xl backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
        {/* Left: Title & Status */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-black">
            <RouteIcon className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                Dispatch Control <span className="text-blue-400 font-extrabold">• Live Monitor</span>
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> LIVE SYNC
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Real-time shift dispatch pipeline & pick ticket aging matrix</p>
          </div>
        </div>

        {/* Right: Clock, Warehouse, Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Active Warehouse Tag */}
          <div className="px-3 py-1.5 rounded-xl bg-blue-950/60 border border-blue-700/50 text-blue-300 font-black text-xs uppercase flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-blue-400" />
            <span>{activeWarehouse ? (activeWarehouse.warehouse_code || activeWarehouse.warehouse_name) : 'WH-MAIN'}</span>
          </div>

          {/* Real-time IST Digital Clock */}
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-amber-400 font-mono font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-inner">
            <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
            <span>{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
          </div>

          {/* Refresh Button with Countdown */}
          <button
            onClick={() => fetchDashboard()}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/30 cursor-pointer"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh ({refreshCountdown}s)</span>
          </button>

          {/* Fullscreen TV Mode */}
          <button
            onClick={toggleFullScreen}
            className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 cursor-pointer transition-colors"
            title={isFullScreen ? 'Exit Full Screen' : 'Full Screen TV Mode'}
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── Top Executive KPI Cards ───────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Pick Tickets */}
        <div className="bg-slate-800/80 border border-slate-700 p-3.5 rounded-2xl shadow-md flex items-center gap-3 relative overflow-hidden">
          <div className="w-11 h-11 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
            <PackageCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-white leading-none">{totalTickets}</div>
            <div className="text-xs font-bold text-slate-400 mt-1 flex items-center gap-1">
              <span>Total Tickets</span>
              <span className="text-[10px] text-blue-300 font-mono">({totalCartons} Ctn)</span>
            </div>
          </div>
          <div className="absolute right-2 top-2 w-1.5 h-1.5 rounded-full bg-blue-400"></div>
        </div>

        {/* Pending Billing (Unbilled) */}
        <div className="bg-slate-800/80 border border-red-500/40 p-3.5 rounded-2xl shadow-md flex items-center gap-3 relative overflow-hidden">
          <div className="w-11 h-11 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-2xl font-black text-red-400 leading-none">{pendingTickets.length}</div>
            <div className="text-xs font-bold text-slate-300 mt-1">Pending Billing</div>
          </div>
          {criticalDelayedCount > 0 && (
            <span className="absolute right-2 top-2 px-1.5 py-0.5 rounded-full bg-red-500 text-white font-black text-[9px] animate-bounce">
              {criticalDelayedCount} &gt;60m
            </span>
          )}
        </div>

        {/* Picking In Progress */}
        <div className="bg-slate-800/80 border border-amber-500/40 p-3.5 rounded-2xl shadow-md flex items-center gap-3 relative overflow-hidden">
          <div className="w-11 h-11 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-amber-400 leading-none">{pickingTickets.length}</div>
            <div className="text-xs font-bold text-slate-400 mt-1">In Picking / Desk</div>
          </div>
        </div>

        {/* Billed & Ready for Trip */}
        <div className="bg-slate-800/80 border border-emerald-500/40 p-3.5 rounded-2xl shadow-md flex items-center gap-3 relative overflow-hidden">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-400 leading-none">{readyTickets.length}</div>
            <div className="text-xs font-bold text-slate-400 mt-1">Ready for Dispatch</div>
          </div>
        </div>

        {/* Dispatched */}
        <div className="col-span-2 sm:col-span-1 bg-slate-800/80 border border-purple-500/40 p-3.5 rounded-2xl shadow-md flex items-center gap-3 relative overflow-hidden">
          <div className="w-11 h-11 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-black text-purple-400 leading-none">{dispatchedTickets.length}</div>
            <div className="text-xs font-bold text-slate-400 mt-1">Dispatched Today</div>
          </div>
        </div>
      </div>

      {/* ── Next Dispatch Live Banner ─────────────────────────────── */}
      {nextDispatch && (
        <div className="bg-gradient-to-r from-blue-900/60 via-indigo-950/70 to-slate-900 border border-blue-500/40 rounded-2xl p-3 sm:p-4 shadow-lg flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-300 shrink-0">
              <Flame className="w-5 h-5 text-amber-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-blue-300">Next Upcoming Dispatch:</span>
                <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-white font-extrabold text-xs border border-blue-400/30">
                  {nextDispatch.route_name} ({nextDispatch.slot})
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                  nextDispatch.is_delayed ? 'bg-red-500 text-white animate-pulse' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {nextDispatch.status}
                </span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                <span>Cutoff: <strong className="text-slate-200">{nextDispatch.cutoff_time_formatted}</strong></span>
                <span>•</span>
                <span>Dispatch: <strong className="text-slate-200">{nextDispatch.dispatch_time_formatted}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-slate-400 font-bold uppercase">Time Remaining</div>
              <div className={`text-lg font-mono font-black ${nextDispatch.is_delayed ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
                {nextDispatch.time_remaining}
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/dispatch-planning')}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs flex items-center gap-1 cursor-pointer transition-all shadow-md shadow-blue-600/30"
            >
              <span>Plan Trip</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Interactive Route & Shift Control Center ───────────────── */}
      <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3.5 sm:p-4 shadow-xl space-y-3.5">
        
        {/* Quick Route Selector Bar (Pill Tabs) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-300">
            <span className="flex items-center gap-1.5 text-blue-400">
              <RouteIcon className="w-4 h-4" /> 1. Select Route ({routesList.length} Available)
            </span>
            <span className="text-[11px] text-slate-400 font-normal">
              Showing: <strong className="text-white">{selectedRouteObj ? selectedRouteObj.route_name : 'All Routes'}</strong>
            </span>
          </div>

          {/* Horizontally scrollable Route Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-slate-700">
            {/* All Routes Pill */}
            <button
              type="button"
              onClick={() => { setSelectedRoute('ALL'); setCurrentPage(1); }}
              className={`px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 border transition-all cursor-pointer shrink-0 ${
                selectedRoute === 'ALL'
                  ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/30 ring-2 ring-blue-400/40'
                  : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-700/60'
              }`}
            >
              <span>🌟 All Routes</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                selectedRoute === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                {pendingTickets.length} Pending
              </span>
            </button>

            {/* Individual Route Pills */}
            {routesList.map(r => {
              const isSelected = selectedRoute === r.route_name || selectedRoute === r.id;
              return (
                <button
                  key={r.id || r.route_name}
                  type="button"
                  onClick={() => { setSelectedRoute(r.route_name); setCurrentPage(1); }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 border transition-all cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/30 ring-2 ring-blue-400/40'
                      : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:bg-slate-700/60'
                  }`}
                >
                  <span>{r.route_name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : r.unbilled_count > 0
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30 font-bold'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                    {r.unbilled_count > 0 ? `${r.unbilled_count} Pending` : '0'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Shift Slots & Filters Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center pt-2 border-t border-slate-700/60">
          
          {/* Shift Slot Switcher */}
          <div className="lg:col-span-5 flex items-center gap-2">
            <span className="text-xs font-black uppercase text-slate-400 shrink-0">Shift:</span>
            <div className="grid grid-cols-3 gap-1.5 w-full">
              <button
                type="button"
                onClick={() => { setSelectedSlot('ALL'); setCurrentPage(1); }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  selectedSlot === 'ALL'
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-slate-900/80 text-slate-400 border-slate-700 hover:bg-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> All Shifts
              </button>

              <button
                type="button"
                onClick={() => { setSelectedSlot('Morning'); setCurrentPage(1); }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  selectedSlot === 'Morning'
                    ? 'bg-amber-500 text-slate-900 border-amber-400'
                    : 'bg-slate-900/80 text-slate-400 border-slate-700 hover:bg-amber-950/30'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-400" /> Morning
              </button>

              <button
                type="button"
                onClick={() => { setSelectedSlot('Evening'); setCurrentPage(1); }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  selectedSlot === 'Evening'
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-slate-900/80 text-slate-400 border-slate-700 hover:bg-indigo-950/30'
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-indigo-400" /> Evening
              </button>
            </div>
          </div>

          {/* Quick Stage Pills */}
          <div className="lg:col-span-4 flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {['ALL', 'Pending', 'Ready', 'Dispatched'].map(st => (
              <button
                key={st}
                type="button"
                onClick={() => { setSelectedStage(st); setCurrentPage(1); }}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black border transition-all cursor-pointer whitespace-nowrap ${
                  selectedStage === st
                    ? 'bg-slate-200 text-slate-900 border-white'
                    : 'bg-slate-900/80 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                {st === 'ALL' ? 'All Stages' : st === 'Pending' ? '⏳ Pending Billing' : st === 'Ready' ? '✅ Ready' : '🚚 Dispatched'}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="lg:col-span-3 relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search ticket, party, route..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs font-semibold text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Shift Dispatch Cycles Side-by-Side (Morning & Evening) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Morning Dispatch Cycle Card */}
        <div className="bg-slate-800/90 border border-amber-500/30 rounded-2xl p-4 shadow-lg space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black">
                <Sun className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                  Morning Shift Dispatch
                  {displayMorningCycle && (
                    <span className="text-[11px] text-amber-400 font-bold">({displayMorningCycle.route_name})</span>
                  )}
                </h3>
                <span className="text-[11px] text-slate-400">
                  Cutoff: <strong className="text-slate-200">{displayMorningCycle?.cutoff_time_formatted || '08:00 AM'}</strong> | Dispatch: <strong className="text-slate-200">{displayMorningCycle?.dispatch_time_formatted || '10:00 AM'}</strong>
                </span>
              </div>
            </div>

            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
              displayMorningCycle?.isDelayed
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}>
              {displayMorningCycle?.status || 'Upcoming'}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-bold text-slate-400">
              <span>Readiness Progress</span>
              <span className="text-amber-400 font-mono font-black">{displayMorningCycle?.progress_pct || 0}%</span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${displayMorningCycle?.progress_pct || 0}%` }}
              ></div>
            </div>
          </div>

          {/* Stage breakdown numbers */}
          <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-700/60 text-center">
            <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-700">
              <div className="text-xs text-slate-400 font-bold">Total</div>
              <div className="text-sm font-black text-white">{displayMorningCycle?.metrics?.total || 0}</div>
            </div>
            <div className="bg-red-950/40 p-2 rounded-xl border border-red-500/30">
              <div className="text-xs text-red-400 font-bold">Pending</div>
              <div className="text-sm font-black text-red-400">{displayMorningCycle?.metrics?.pending || 0}</div>
            </div>
            <div className="bg-emerald-950/40 p-2 rounded-xl border border-emerald-500/30">
              <div className="text-xs text-emerald-400 font-bold">Ready</div>
              <div className="text-sm font-black text-emerald-400">{displayMorningCycle?.metrics?.ready || 0}</div>
            </div>
            <div className="bg-purple-950/40 p-2 rounded-xl border border-purple-500/30">
              <div className="text-xs text-purple-400 font-bold">Dispatched</div>
              <div className="text-sm font-black text-purple-400">{displayMorningCycle?.metrics?.dispatched || 0}</div>
            </div>
          </div>
        </div>

        {/* Evening Dispatch Cycle Card */}
        <div className="bg-slate-800/90 border border-indigo-500/30 rounded-2xl p-4 shadow-lg space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-black">
                <Moon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                  Evening Shift Dispatch
                  {displayEveningCycle && (
                    <span className="text-[11px] text-indigo-400 font-bold">({displayEveningCycle.route_name})</span>
                  )}
                </h3>
                <span className="text-[11px] text-slate-400">
                  Cutoff: <strong className="text-slate-200">{displayEveningCycle?.cutoff_time_formatted || '04:00 PM'}</strong> | Dispatch: <strong className="text-slate-200">{displayEveningCycle?.dispatch_time_formatted || '06:00 PM'}</strong>
                </span>
              </div>
            </div>

            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
              displayEveningCycle?.isDelayed
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
            }`}>
              {displayEveningCycle?.status || 'Upcoming'}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-bold text-slate-400">
              <span>Readiness Progress</span>
              <span className="text-indigo-400 font-mono font-black">{displayEveningCycle?.progress_pct || 0}%</span>
            </div>
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${displayEveningCycle?.progress_pct || 0}%` }}
              ></div>
            </div>
          </div>

          {/* Stage breakdown numbers */}
          <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-700/60 text-center">
            <div className="bg-slate-900/60 p-2 rounded-xl border border-slate-700">
              <div className="text-xs text-slate-400 font-bold">Total</div>
              <div className="text-sm font-black text-white">{displayEveningCycle?.metrics?.total || 0}</div>
            </div>
            <div className="bg-red-950/40 p-2 rounded-xl border border-red-500/30">
              <div className="text-xs text-red-400 font-bold">Pending</div>
              <div className="text-sm font-black text-red-400">{displayEveningCycle?.metrics?.pending || 0}</div>
            </div>
            <div className="bg-emerald-950/40 p-2 rounded-xl border border-emerald-500/30">
              <div className="text-xs text-emerald-400 font-bold">Ready</div>
              <div className="text-sm font-black text-emerald-400">{displayEveningCycle?.metrics?.ready || 0}</div>
            </div>
            <div className="bg-purple-950/40 p-2 rounded-xl border border-purple-500/30">
              <div className="text-xs text-purple-400 font-bold">Dispatched</div>
              <div className="text-sm font-black text-purple-400">{displayEveningCycle?.metrics?.dispatched || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Dense Live Ticket Matrix (Data Table) ──────────────────── */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-2xl shadow-xl overflow-hidden space-y-3">
        {/* Table Action Header */}
        <div className="px-4 py-3 bg-slate-800 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-blue-400" />
              Live Pick Tickets Queue
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-blue-600 text-white ml-1">
                {filteredTickets.length}
              </span>
            </h3>
            {selectedRouteObj && (
              <span className="px-2.5 py-0.5 bg-blue-950 text-blue-300 border border-blue-700 rounded-lg text-xs font-black">
                Route: {selectedRouteObj.route_name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-medium">
              Showing {filteredPending} Pending • {filteredReady} Ready • {filteredCartons} Cartons
            </span>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-900 text-slate-300 border-b border-slate-700 font-black uppercase tracking-wider text-[11px]">
                <th className="px-3.5 py-3 whitespace-nowrap">#</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Ticket No</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Party Name & Code</th>
                <th className="px-2.5 py-3 text-center whitespace-nowrap">Qty / Cartons</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Route</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Shift</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Assigned Picker</th>
                <th className="px-3.5 py-3 text-center whitespace-nowrap">Aging / Waiting Time</th>
                <th className="px-3.5 py-3 text-center whitespace-nowrap">Status</th>
                <th className="px-3.5 py-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-slate-400 font-bold">
                    <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading live pick tickets...
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-slate-400">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
                    <div className="text-base font-black text-white">No Tickets Found in View!</div>
                    <p className="text-xs text-slate-400 mt-1">
                      No pick tickets match the selected route or filter options.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedTickets.map((t, idx) => {
                  const isCritical = t.aging_minutes >= 60;
                  const isWarning = t.aging_minutes >= 30 && t.aging_minutes < 60;

                  return (
                    <tr key={t.id} className="hover:bg-slate-700/40 transition-colors">
                      {/* # Index */}
                      <td className="px-3.5 py-3 text-slate-500 font-mono font-bold whitespace-nowrap">
                        {startIndex + idx + 1}
                      </td>

                      {/* Ticket No */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openTicketModal(t.id)}
                          className="font-mono font-black text-blue-400 hover:text-blue-300 hover:underline cursor-pointer bg-blue-950/60 hover:bg-blue-900/60 px-2 py-1 rounded-lg border border-blue-700/50 transition-colors"
                        >
                          {t.pick_ticket_no}
                        </button>
                        {t.customer_order_no && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">PO: {t.customer_order_no}</div>
                        )}
                      </td>

                      {/* Party */}
                      <td className="px-3.5 py-3">
                        <div className="font-extrabold text-white line-clamp-1 max-w-[220px]" title={t.party_name}>
                          {t.party_name}
                        </div>
                        <span className="text-[10px] font-mono font-bold text-slate-400">{t.party_code}</span>
                      </td>

                      {/* Qty */}
                      <td className="px-2.5 py-3 text-center whitespace-nowrap font-black text-white text-sm">
                        {t.cartons}
                      </td>

                      {/* Route */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-900 text-blue-300 font-bold border border-slate-700 text-xs">
                          {t.route_name}
                        </span>
                      </td>

                      {/* Slot */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          t.dispatch_slot === 'Evening'
                            ? 'bg-indigo-950 text-indigo-300 border border-indigo-700'
                            : 'bg-amber-950 text-amber-300 border border-amber-700'
                        }`}>
                          {t.dispatch_slot === 'Evening' ? '🌙 Evening' : '☀️ Morning'}
                        </span>
                        <span className="text-slate-400 font-mono text-[10px] ml-1.5">{t.time || '09:00'}</span>
                      </td>

                      {/* Assigned Picker */}
                      <td className="px-3.5 py-3 whitespace-nowrap font-medium text-slate-300">
                        {t.picker_name || t.assigned_to || '—'}
                      </td>

                      {/* Aging / Waiting Time */}
                      <td className="px-3.5 py-3 text-center whitespace-nowrap">
                        <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black border ${
                          isCritical
                            ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                            : isWarning
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        }`}>
                          <Clock className="w-3 h-3" />
                          <span>{t.aging_formatted || `${t.aging_minutes}m`}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-3.5 py-3 text-center whitespace-nowrap">
                        {t.current_stage === 'Cancelled' ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-red-950 text-red-400 border border-red-700 line-through">
                            Cancelled
                          </span>
                        ) : t.current_stage === 'Dispatched' ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-purple-950 text-purple-300 border border-purple-700 inline-flex items-center gap-1">
                            <Truck className="w-3 h-3" /> Dispatched
                          </span>
                        ) : t.is_billed ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-950 text-emerald-300 border border-emerald-700 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Billed ({t.bill_no || 'Ready'})
                          </span>
                        ) : t.current_stage === 'Picking' ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-950 text-amber-300 border border-amber-700 inline-flex items-center gap-1">
                            <PackageCheck className="w-3 h-3 text-amber-400" /> In Picking
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-red-950 text-red-400 border border-red-700 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-red-400" /> Pending Billing
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-3.5 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {!t.is_billed ? (
                            <button
                              type="button"
                              onClick={() => navigate('/billing')}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black shadow-md transition-all cursor-pointer flex items-center gap-1"
                              title="Go to Billing desk"
                            >
                              <Receipt className="w-3 h-3" /> Bill Now
                            </button>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-900 text-slate-400 rounded text-[10px] font-bold border border-slate-700">
                              {t.bill_no || 'Billed'}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => openTicketModal(t.id)}
                            className="p-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 cursor-pointer"
                            title="Inspect Lifecycle & Timeline"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredTickets.length > 0 && (
          <div className="px-4 py-3 bg-slate-900/90 border-t border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-400 font-medium">
              Showing <strong className="text-white">{startIndex + 1}</strong> to <strong className="text-white">{Math.min(startIndex + pageSize, filteredTickets.length)}</strong> of <strong className="text-white">{filteredTickets.length}</strong> tickets
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 font-bold hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Previous
              </button>
              <span className="font-black text-blue-400 px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 font-bold hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Single Pick Ticket Timeline Modal Drawer ────────────────── */}
      {selectedTicketId && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto">
          <div className="bg-slate-900 text-slate-100 rounded-3xl w-full max-w-2xl border border-slate-700 shadow-2xl overflow-hidden space-y-4 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-slate-800 border-b-2 border-blue-500 p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-mono font-black text-white">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white font-mono">
                    Pick Ticket {ticketDetail?.pick_ticket_no || 'Details'}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">Lifecycle tracking & operational stage progression</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedTicketId(null); setTicketDetail(null); }}
                className="p-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
              {ticketModalLoading ? (
                <div className="text-center py-12 text-slate-400 font-bold">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                  Loading ticket lifecycle details...
                </div>
              ) : ticketDetail ? (
                <>
                  {/* Context Info Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Party Name</span>
                      <div className="font-black text-white mt-0.5">{ticketDetail.party_name}</div>
                      <span className="font-mono text-blue-400 font-bold">{ticketDetail.party_code}</span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Route & Shift</span>
                      <div className="font-black text-blue-300 mt-0.5">{ticketDetail.route_name || ticketDetail.route}</div>
                      <span className="text-slate-400">{ticketDetail.dispatch_slot || 'Morning'}</span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Quantity</span>
                      <div className="text-base font-black text-amber-400 mt-0.5">{ticketDetail.qty_in_pick_ticket} Cartons</div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Picker</span>
                      <div className="font-bold text-slate-300 mt-0.5">{ticketDetail.picker?.name || ticketDetail.picker_name || 'Unassigned'}</div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Salesman</span>
                      <div className="font-bold text-slate-300 mt-0.5">{ticketDetail.salesman || '—'}</div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Aging / Pending</span>
                      <div className="font-black text-red-400 mt-0.5">{ticketDetail.aging_formatted || 'Normal'}</div>
                    </div>
                  </div>

                  {/* Stage Progression Timeline */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black uppercase text-blue-400 tracking-wider">Operational Timeline</h4>
                    <div className="relative pl-6 space-y-4 border-l-2 border-slate-700 ml-3">
                      {(ticketDetail.timeline || []).map((step, idx) => (
                        <div key={idx} className="relative group">
                          <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 ${
                            step.state === 'completed'
                              ? 'bg-emerald-500 border-emerald-500'
                              : step.state === 'current'
                              ? 'bg-amber-500 border-amber-500 animate-pulse'
                              : 'bg-slate-900 border-slate-600'
                          }`}></div>
                          <div className="flex items-center justify-between">
                            <span className={`font-black text-xs ${
                              step.state === 'completed' ? 'text-emerald-400' : step.state === 'current' ? 'text-amber-400' : 'text-slate-500'
                            }`}>
                              {step.stage}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400 font-medium">
                              {step.timestamp || '—'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Billing Details if present */}
                  {ticketDetail.billing && (
                    <div className="bg-emerald-950/40 border border-emerald-500/40 p-4 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-emerald-300">Invoice Bill Generated</span>
                        <span className="font-mono font-black text-emerald-400">{ticketDetail.billing.bill_no}</span>
                      </div>
                      <div className="flex justify-between text-emerald-300 text-[11px]">
                        <span>Invoice Amount: ₹{ticketDetail.billing.invoice_amount?.toLocaleString() || 0}</span>
                        <span>Billed Qty: {ticketDetail.billing.billed_qty}</span>
                      </div>
                    </div>
                  )}

                  {/* Dispatch details if present */}
                  {ticketDetail.dispatch && (
                    <div className="bg-purple-950/40 border border-purple-500/40 p-4 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-purple-300">Trip Dispatched</span>
                        <span className="font-mono font-black text-purple-400">{ticketDetail.dispatch.dispatch_no}</span>
                      </div>
                      <div className="flex justify-between text-purple-300 text-[11px]">
                        <span>Driver: {ticketDetail.dispatch.driver_name}</span>
                        <span>Vehicle: {ticketDetail.dispatch.vehicle_number}</span>
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-800 border-t border-slate-700 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => { setSelectedTicketId(null); setTicketDetail(null); }}
                className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Close
              </button>
              {ticketDetail && !ticketDetail.billing && (
                <button
                  type="button"
                  onClick={() => { setSelectedTicketId(null); navigate('/billing'); }}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Receipt className="w-3.5 h-3.5" /> Go to Billing
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
