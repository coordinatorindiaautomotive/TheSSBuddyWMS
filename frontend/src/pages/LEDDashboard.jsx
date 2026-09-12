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
  const pageSize = 10;

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
  const cappedTickets = (filteredTickets || []).slice(0, 100);
  const totalPages = Math.ceil(cappedTickets.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, cappedTickets.length);
  const paginatedTickets = cappedTickets.slice(startIndex, startIndex + pageSize);

  return (
    <div ref={containerRef} className="space-y-4 w-full">
      
      {/* ── Top Header Bar ────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Left: Title & Status */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#003366] to-[#004c8f] flex items-center justify-center text-white shadow-md shrink-0">
            <RouteIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Dispatch Control Panel
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> LIVE SYNC
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Real-time route dispatches, shift schedules, and pick ticket queue.
            </p>
          </div>
        </div>

        {/* Right: Clock, Warehouse, Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Active Warehouse Tag */}
          <div className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-[#004c8f] font-bold text-xs uppercase flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#004c8f]" />
            <span>{activeWarehouse ? (activeWarehouse.warehouse_code || activeWarehouse.warehouse_name) : 'WH-MAIN'}</span>
          </div>

          {/* Real-time IST Digital Clock */}
          <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-xs">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
          </div>

          {/* Refresh Button with Countdown */}
          <button
            onClick={() => fetchDashboard()}
            className="px-3.5 py-1.5 rounded-xl bg-[#004c8f] hover:bg-[#003366] active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh ({refreshCountdown}s)</span>
          </button>

          {/* Fullscreen TV Mode */}
          <button
            onClick={toggleFullScreen}
            className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer transition-colors shadow-xs"
            title={isFullScreen ? 'Exit Full Screen' : 'Full Screen View'}
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── Top Executive KPI Cards ───────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Pick Tickets */}
        <div className="card-enterprise p-4 hover:border-slate-300 transition-colors shadow-xs flex items-center gap-3.5 relative overflow-hidden">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#004c8f] border border-blue-100 flex items-center justify-center shrink-0">
            <PackageCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 leading-none">{totalTickets}</div>
            <div className="text-xs font-semibold text-slate-500 mt-1 flex items-center gap-1">
              <span>Total Tickets</span>
              <span className="text-[10px] text-blue-700 font-mono">({totalCartons} Ctn)</span>
            </div>
          </div>
        </div>

        {/* Pending Billing (Unbilled) */}
        <div className="card-enterprise p-4 hover:border-slate-300 transition-colors shadow-xs flex items-center gap-3.5 relative overflow-hidden">
          <div className="w-11 h-11 rounded-xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600 leading-none">{pendingTickets.length}</div>
            <div className="text-xs font-semibold text-slate-500 mt-1">Pending Billing</div>
          </div>
          {criticalDelayedCount > 0 && (
            <span className="absolute right-2.5 top-2.5 px-2 py-0.5 rounded-full bg-red-500 text-white font-bold text-[10px]">
              {criticalDelayedCount} &gt;60m
            </span>
          )}
        </div>

        {/* Picking In Progress */}
        <div className="card-enterprise p-4 hover:border-slate-300 transition-colors shadow-xs flex items-center gap-3.5 relative overflow-hidden">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-600 leading-none">{pickingTickets.length}</div>
            <div className="text-xs font-semibold text-slate-500 mt-1">In Picking</div>
          </div>
        </div>

        {/* Billed & Ready for Trip */}
        <div className="card-enterprise p-4 hover:border-slate-300 transition-colors shadow-xs flex items-center gap-3.5 relative overflow-hidden">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-600 leading-none">{readyTickets.length}</div>
            <div className="text-xs font-semibold text-slate-500 mt-1">Ready for Dispatch</div>
          </div>
        </div>

        {/* Dispatched */}
        <div className="col-span-2 sm:col-span-1 card-enterprise p-4 hover:border-slate-300 transition-colors shadow-xs flex items-center gap-3.5 relative overflow-hidden">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600 leading-none">{dispatchedTickets.length}</div>
            <div className="text-xs font-semibold text-slate-500 mt-1">Dispatched Today</div>
          </div>
        </div>
      </div>

      {/* ── Next Dispatch Live Banner ─────────────────────────────── */}
      {nextDispatch && (
        <div className="bg-white border-l-4 border-l-[#004c8f] border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#004c8f] shrink-0">
              <Flame className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Next Upcoming Dispatch:</span>
                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#004c8f] font-bold text-xs border border-blue-200">
                  {nextDispatch.route_name} ({nextDispatch.slot})
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                  nextDispatch.is_delayed ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}>
                  {nextDispatch.status}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                <span>Cutoff: <strong className="text-slate-800 font-semibold">{nextDispatch.cutoff_time_formatted}</strong></span>
                <span>•</span>
                <span>Dispatch: <strong className="text-slate-800 font-semibold">{nextDispatch.dispatch_time_formatted}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[11px] text-slate-400 font-bold uppercase">Time Remaining</div>
              <div className={`text-base font-mono font-bold ${nextDispatch.is_delayed ? 'text-red-600' : 'text-emerald-700'}`}>
                {nextDispatch.time_remaining}
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/dispatch-planning')}
              className="px-4 py-2 rounded-xl bg-[#004c8f] hover:bg-[#003366] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-xs"
            >
              <span>Plan Trip</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Interactive Route & Shift Control Center ───────────────── */}
      <div className="card-enterprise p-4 space-y-3.5 shadow-xs">
        
        {/* Quick Route Selector Bar (Pill Tabs) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-600">
            <span className="flex items-center gap-1.5 text-[#003366]">
              <RouteIcon className="w-4 h-4 text-[#004c8f]" /> Select Delivery Route ({routesList.length} Available)
            </span>
            <span className="text-[11px] text-slate-400 font-normal">
              Active: <strong className="text-slate-800">{selectedRouteObj ? selectedRouteObj.route_name : 'All Routes'}</strong>
            </span>
          </div>

          {/* Horizontally scrollable Route Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
            {/* All Routes Pill */}
            <button
              type="button"
              onClick={() => { setSelectedRoute('ALL'); setCurrentPage(1); }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer shrink-0 ${
                selectedRoute === 'ALL'
                  ? 'bg-[#003366] text-white border-[#003366] shadow-sm'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span>All Routes</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                selectedRoute === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
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
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-[#003366] text-white border-[#003366] shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span>{r.route_name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : r.unbilled_count > 0
                      ? 'bg-red-50 text-red-600 border border-red-200'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {r.unbilled_count > 0 ? `${r.unbilled_count} Pending` : '0'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Shift Slots & Filters Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center pt-3 border-t border-slate-200">
          
          {/* Shift Slot Switcher */}
          <div className="lg:col-span-5 flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-slate-500 shrink-0">Shift:</span>
            <div className="grid grid-cols-3 gap-1.5 w-full">
              <button
                type="button"
                onClick={() => { setSelectedSlot('ALL'); setCurrentPage(1); }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  selectedSlot === 'ALL'
                    ? 'bg-[#004c8f] text-white border-[#004c8f]'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> All Shifts
              </button>

              <button
                type="button"
                onClick={() => { setSelectedSlot('Morning'); setCurrentPage(1); }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  selectedSlot === 'Morning'
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" /> Morning
              </button>

              <button
                type="button"
                onClick={() => { setSelectedSlot('Evening'); setCurrentPage(1); }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  selectedSlot === 'Evening'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Moon className="w-3.5 h-3.5 text-indigo-500" /> Evening
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
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer whitespace-nowrap ${
                  selectedStage === st
                    ? 'bg-[#003366] text-white border-[#003366]'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {st === 'ALL' ? 'All Stages' : st === 'Pending' ? 'Pending Billing' : st === 'Ready' ? 'Ready' : 'Dispatched'}
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
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#004c8f] focus:outline-none shadow-2xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
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
        <div className="card-enterprise p-4 shadow-xs space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center font-bold">
                <Sun className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  Morning Shift Dispatch
                  {displayMorningCycle && (
                    <span className="text-[11px] text-amber-700 font-semibold">({displayMorningCycle.route_name})</span>
                  )}
                </h3>
                <span className="text-[11px] text-slate-500">
                  Cutoff: <strong className="text-slate-800">{displayMorningCycle?.cutoff_time_formatted || '08:00 AM'}</strong> | Dispatch: <strong className="text-slate-800">{displayMorningCycle?.dispatch_time_formatted || '10:00 AM'}</strong>
                </span>
              </div>
            </div>

            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
              displayMorningCycle?.isDelayed
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}>
              {displayMorningCycle?.status || 'Upcoming'}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-bold text-slate-500">
              <span>Readiness Progress</span>
              <span className="text-amber-600 font-mono">{displayMorningCycle?.progress_pct || 0}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${displayMorningCycle?.progress_pct || 0}%` }}
              ></div>
            </div>
          </div>

          {/* Stage breakdown numbers */}
          <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-100 text-center">
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
              <div className="text-[11px] text-slate-500 font-bold">Total</div>
              <div className="text-sm font-bold text-slate-900">{displayMorningCycle?.metrics?.total || 0}</div>
            </div>
            <div className="bg-red-50/60 p-2 rounded-xl border border-red-200">
              <div className="text-[11px] text-red-600 font-bold">Pending</div>
              <div className="text-sm font-bold text-red-700">{displayMorningCycle?.metrics?.pending || 0}</div>
            </div>
            <div className="bg-emerald-50/60 p-2 rounded-xl border border-emerald-200">
              <div className="text-[11px] text-emerald-600 font-bold">Ready</div>
              <div className="text-sm font-bold text-emerald-700">{displayMorningCycle?.metrics?.ready || 0}</div>
            </div>
            <div className="bg-purple-50/60 p-2 rounded-xl border border-purple-200">
              <div className="text-[11px] text-purple-600 font-bold">Dispatched</div>
              <div className="text-sm font-bold text-purple-700">{displayMorningCycle?.metrics?.dispatched || 0}</div>
            </div>
          </div>
        </div>

        {/* Evening Dispatch Cycle Card */}
        <div className="card-enterprise p-4 shadow-xs space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center font-bold">
                <Moon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  Evening Shift Dispatch
                  {displayEveningCycle && (
                    <span className="text-[11px] text-indigo-700 font-semibold">({displayEveningCycle.route_name})</span>
                  )}
                </h3>
                <span className="text-[11px] text-slate-500">
                  Cutoff: <strong className="text-slate-800">{displayEveningCycle?.cutoff_time_formatted || '04:00 PM'}</strong> | Dispatch: <strong className="text-slate-800">{displayEveningCycle?.dispatch_time_formatted || '06:00 PM'}</strong>
                </span>
              </div>
            </div>

            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
              displayEveningCycle?.isDelayed
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
            }`}>
              {displayEveningCycle?.status || 'Upcoming'}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-bold text-slate-500">
              <span>Readiness Progress</span>
              <span className="text-indigo-600 font-mono">{displayEveningCycle?.progress_pct || 0}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
                style={{ width: `${displayEveningCycle?.progress_pct || 0}%` }}
              ></div>
            </div>
          </div>

          {/* Stage breakdown numbers */}
          <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-100 text-center">
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
              <div className="text-[11px] text-slate-500 font-bold">Total</div>
              <div className="text-sm font-bold text-slate-900">{displayEveningCycle?.metrics?.total || 0}</div>
            </div>
            <div className="bg-red-50/60 p-2 rounded-xl border border-red-200">
              <div className="text-[11px] text-red-600 font-bold">Pending</div>
              <div className="text-sm font-bold text-red-700">{displayEveningCycle?.metrics?.pending || 0}</div>
            </div>
            <div className="bg-emerald-50/60 p-2 rounded-xl border border-emerald-200">
              <div className="text-[11px] text-emerald-600 font-bold">Ready</div>
              <div className="text-sm font-bold text-emerald-700">{displayEveningCycle?.metrics?.ready || 0}</div>
            </div>
            <div className="bg-purple-50/60 p-2 rounded-xl border border-purple-200">
              <div className="text-[11px] text-purple-600 font-bold">Dispatched</div>
              <div className="text-sm font-bold text-purple-700">{displayEveningCycle?.metrics?.dispatched || 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Dense Live Ticket Matrix (Data Table) ──────────────────── */}
      <div className="card-enterprise overflow-hidden shadow-xs space-y-0">
        {/* Table Action Header */}
        <div className="card-header-enterprise">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-cyan-300" />
              Live Pick Tickets Queue
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white ml-1">
                {filteredTickets.length}
              </span>
            </h3>
            {selectedRouteObj && (
              <span className="px-2.5 py-0.5 bg-blue-900/60 text-blue-200 border border-blue-400/30 rounded-lg text-xs font-bold">
                Route: {selectedRouteObj.route_name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-blue-100 font-medium">
              Showing {filteredPending} Pending • {filteredReady} Ready • {filteredCartons} Cartons
            </span>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider text-[11px]">
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
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-slate-400 font-semibold">
                    <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-[#004c8f]" />
                    Loading live pick tickets...
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-slate-400">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
                    <div className="text-base font-bold text-slate-800">No Tickets Found in View</div>
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
                    <tr key={t.id} className="hover:bg-blue-50/40 transition-colors">
                      {/* # Index */}
                      <td className="px-3.5 py-3 text-slate-400 font-mono font-bold whitespace-nowrap">
                        {startIndex + idx + 1}
                      </td>

                      {/* Ticket No */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openTicketModal(t.id)}
                          className="font-mono font-bold text-[#004c8f] hover:text-[#003366] hover:underline cursor-pointer bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg border border-blue-200 transition-colors"
                        >
                          {t.pick_ticket_no}
                        </button>
                        {t.customer_order_no && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">PO: {t.customer_order_no}</div>
                        )}
                      </td>

                      {/* Party */}
                      <td className="px-3.5 py-3">
                        <div className="font-bold text-slate-900 line-clamp-1 max-w-[220px]" title={t.party_name}>
                          {t.party_name}
                        </div>
                        <span className="text-[10px] font-mono font-semibold text-slate-400">{t.party_code}</span>
                      </td>

                      {/* Qty */}
                      <td className="px-2.5 py-3 text-center whitespace-nowrap font-bold text-slate-900 text-sm">
                        {t.cartons}
                      </td>

                      {/* Route */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold border border-slate-200 text-xs">
                          {t.route_name}
                        </span>
                      </td>

                      {/* Slot */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.dispatch_slot === 'Evening'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {t.dispatch_slot === 'Evening' ? '🌙 Evening' : '☀️ Morning'}
                        </span>
                        <span className="text-slate-400 font-mono text-[10px] ml-1.5">{t.time || '09:00'}</span>
                      </td>

                      {/* Assigned Picker */}
                      <td className="px-3.5 py-3 whitespace-nowrap font-medium text-slate-700">
                        {t.picker_name || t.assigned_to || '—'}
                      </td>

                      {/* Aging / Waiting Time */}
                      <td className="px-3.5 py-3 text-center whitespace-nowrap">
                        <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                          isCritical
                            ? 'bg-red-50 text-red-700 border-red-200 animate-pulse'
                            : isWarning
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          <Clock className="w-3 h-3" />
                          <span>{t.aging_formatted || `${t.aging_minutes}m`}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-3.5 py-3 text-center whitespace-nowrap">
                        {t.current_stage === 'Cancelled' ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200 line-through">
                            Cancelled
                          </span>
                        ) : t.current_stage === 'Dispatched' ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 inline-flex items-center gap-1">
                            <Truck className="w-3 h-3" /> Dispatched
                          </span>
                        ) : t.is_billed ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Billed ({t.bill_no || 'Ready'})
                          </span>
                        ) : t.current_stage === 'Picking' ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                            <PackageCheck className="w-3 h-3 text-amber-600" /> In Picking
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-red-600" /> Pending Billing
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
                              className="px-2.5 py-1 rounded-lg bg-[#004c8f] hover:bg-[#003366] text-white text-[11px] font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1"
                              title="Go to Billing desk"
                            >
                              <Receipt className="w-3 h-3" /> Bill Now
                            </button>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold border border-slate-200">
                              {t.bill_no || 'Billed'}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => openTicketModal(t.id)}
                            className="p-1 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer transition-colors shadow-2xs"
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
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 font-medium">
              Showing <strong className="text-slate-800">{cappedTickets.length > 0 ? startIndex + 1 : 0}</strong> to <strong className="text-slate-800">{endIndex}</strong> of <strong className="text-slate-800">{cappedTickets.length}</strong> tickets
              {filteredTickets.length > 100 && (
                <span className="text-[11px] text-slate-400 font-normal ml-1.5">(capped at max 100 — filter by route/date)</span>
              )}
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
              >
                Previous
              </button>
              <span className="font-bold text-slate-800 px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage >= totalPages}
                className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Single Pick Ticket Timeline Modal Drawer ────────────────── */}
      {selectedTicketId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl w-full max-w-2xl border border-slate-200 shadow-2xl overflow-hidden space-y-0 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-[#003366] border-b-4 border-[#ed1c24] p-4 sm:p-5 flex items-center justify-between shrink-0 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-mono font-bold text-white border border-white/20">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white font-mono">
                    Pick Ticket {ticketDetail?.pick_ticket_no || 'Details'}
                  </h3>
                  <p className="text-xs text-blue-100 font-medium">Lifecycle tracking & operational stage progression</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedTicketId(null); setTicketDetail(null); }}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs bg-slate-50/50">
              {ticketModalLoading ? (
                <div className="text-center py-12 text-slate-400 font-bold">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#004c8f]" />
                  Loading ticket lifecycle details...
                </div>
              ) : ticketDetail ? (
                <>
                  {/* Context Info Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Party Name</span>
                      <div className="font-bold text-slate-900 mt-0.5">{ticketDetail.party_name}</div>
                      <span className="font-mono text-[#004c8f] font-bold">{ticketDetail.party_code}</span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Route & Shift</span>
                      <div className="font-bold text-slate-800 mt-0.5">{ticketDetail.route_name || ticketDetail.route}</div>
                      <span className="text-slate-500 font-medium">{ticketDetail.dispatch_slot || 'Morning'}</span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Quantity</span>
                      <div className="text-base font-bold text-amber-600 mt-0.5">{ticketDetail.qty_in_pick_ticket} Cartons</div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Picker</span>
                      <div className="font-bold text-slate-800 mt-0.5">{ticketDetail.picker?.name || ticketDetail.picker_name || 'Unassigned'}</div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Salesman</span>
                      <div className="font-bold text-slate-800 mt-0.5">{ticketDetail.salesman || '—'}</div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Aging / Pending</span>
                      <div className="font-bold text-red-600 mt-0.5">{ticketDetail.aging_formatted || 'Normal'}</div>
                    </div>
                  </div>

                  {/* Stage Progression Timeline */}
                  <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <h4 className="text-xs font-bold uppercase text-[#003366] tracking-wider">Operational Timeline</h4>
                    <div className="relative pl-6 space-y-4 border-l-2 border-slate-200 ml-3">
                      {(ticketDetail.timeline || []).map((step, idx) => (
                        <div key={idx} className="relative group">
                          <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 ${
                            step.state === 'completed'
                              ? 'bg-emerald-500 border-emerald-500'
                              : step.state === 'current'
                              ? 'bg-amber-500 border-amber-500 animate-pulse'
                              : 'bg-white border-slate-300'
                          }`}></div>
                          <div className="flex items-center justify-between">
                            <span className={`font-bold text-xs ${
                              step.state === 'completed' ? 'text-emerald-700' : step.state === 'current' ? 'text-amber-700' : 'text-slate-400'
                            }`}>
                              {step.stage}
                            </span>
                            <span className="text-[11px] font-mono text-slate-500 font-medium">
                              {step.timestamp || '—'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Billing Details if present */}
                  {ticketDetail.billing && (
                    <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-900">Invoice Bill Generated</span>
                        <span className="font-mono font-bold text-emerald-700">{ticketDetail.billing.bill_no}</span>
                      </div>
                      <div className="flex justify-between text-emerald-800 text-[11px]">
                        <span>Invoice Amount: ₹{ticketDetail.billing.invoice_amount?.toLocaleString() || 0}</span>
                        <span>Billed Qty: {ticketDetail.billing.billed_qty}</span>
                      </div>
                    </div>
                  )}

                  {/* Dispatch details if present */}
                  {ticketDetail.dispatch && (
                    <div className="bg-purple-50 border border-purple-200 p-4 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-900">Trip Dispatched</span>
                        <span className="font-mono font-bold text-purple-700">{ticketDetail.dispatch.dispatch_no}</span>
                      </div>
                      <div className="flex justify-between text-purple-800 text-[11px]">
                        <span>Driver: {ticketDetail.dispatch.driver_name}</span>
                        <span>Vehicle: {ticketDetail.dispatch.vehicle_number}</span>
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => { setSelectedTicketId(null); setTicketDetail(null); }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer transition-colors"
              >
                Close
              </button>
              {ticketDetail && !ticketDetail.billing && (
                <button
                  type="button"
                  onClick={() => { setSelectedTicketId(null); navigate('/billing'); }}
                  className="px-5 py-2 rounded-xl bg-[#004c8f] hover:bg-[#003366] text-white font-bold text-xs shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
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
