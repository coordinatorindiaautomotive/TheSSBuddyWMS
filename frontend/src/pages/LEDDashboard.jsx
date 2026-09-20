import React, { useEffect, useState, useRef, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import SearchableSelect from '../components/SearchableSelect';
import {
  Route as RouteIcon,
  Clock,
  PackageCheck,
  Receipt,
  CheckCircle2,
  Search,
  RefreshCw,
  Maximize2,
  Minimize2,
  Sun,
  Moon,
  Truck,
  Eye,
  X,
  Layers,
  ArrowRight,
  Flame,
  Filter,
  Check,
  Sparkles,
  Package,
  Activity,
  ArrowUpRight,
  Timer,
  ChevronRight
} from 'lucide-react';

export default function LEDDashboard() {
  const navigate = useNavigate();
  const { activeWarehouse } = useAuth();
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
        containerRef.current.requestFullscreen();
      }
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullScreen(false);
    }
  };

  const normalizeRouteKey = (r) => {
    if (!r) return '';
    return String(r).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  const checkRoutesMatch = (r1, r2, c1, c2) => {
    const keys1 = [normalizeRouteKey(r1), normalizeRouteKey(c1)].filter(k => k && k !== 'unassigned');
    const keys2 = [normalizeRouteKey(r2), normalizeRouteKey(c2)].filter(k => k && k !== 'unassigned');
    if (keys1.length === 0 || keys2.length === 0) return false;
    return keys1.some(k1 => keys2.some(k2 => k1 === k2));
  };

  // Extract all tickets
  const rawTickets = data?.tickets?.allItems || data?.tickets?.items || [];

  // Build unified authoritative route list
  const routesList = useMemo(() => {
    const routesMap = new Map();

    // From Master Routes
    (Array.isArray(masterRoutes) ? masterRoutes : []).forEach(mr => {
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

    // From Raw Tickets
    (Array.isArray(rawTickets) ? rawTickets : []).forEach(t => {
      const name = String(t.route_name || t.party_route || t.ticket_route || '').trim();
      const k = normalizeRouteKey(name);
      if (k && k !== 'unassigned' && k !== 'directroute' && !routesMap.has(k)) {
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
        checkRoutesMatch(t.route_name, r.route_name, null, r.route_code)
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
    ? routesList.find(r => checkRoutesMatch(r.route_name, selectedRoute, r.route_code, selectedRoute))
    : null;

  // Clean SearchableSelect route options without overcrowded text
  const totalSystemPending = rawTickets.filter(t => !t.is_billed && t.current_stage !== 'Cancelled').length;
  const routeSelectOptions = useMemo(() => {
    return [
      {
        value: 'ALL',
        label: 'All Delivery Routes',
        sublabel: `${routesList.length} Routes`
      },
      ...routesList.map(r => ({
        value: r.route_name,
        label: r.route_name,
        sublabel: r.unbilled_count > 0 ? `${r.unbilled_count} Pending` : `${r.total_count} Tickets`
      }))
    ];
  }, [routesList]);

  // Filter tickets based on selection
  const filteredTickets = useMemo(() => {
    return rawTickets.filter(t => {
      // Route Filter
      if (selectedRoute !== 'ALL') {
        const targetRouteName = selectedRouteObj ? selectedRouteObj.route_name : selectedRoute;
        const targetRouteCode = selectedRouteObj ? selectedRouteObj.route_code : selectedRoute;
        const isMatch = checkRoutesMatch(t.route_name, targetRouteName, null, targetRouteCode);
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
        } else if (selectedStage === 'Picking') {
          if (t.current_stage !== 'Picking') return false;
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
  }, [rawTickets, selectedRoute, selectedRouteObj, selectedSlot, selectedStage, searchTerm]);

  // Filtered Set KPIs
  const filteredCartons = filteredTickets.reduce((sum, t) => sum + (Number(t.cartons) || 1), 0);
  const filteredTotal = filteredTickets.length;
  const filteredPending = filteredTickets.filter(t => !t.is_billed && t.current_stage !== 'Cancelled').length;
  const filteredPicking = filteredTickets.filter(t => t.current_stage === 'Picking').length;
  const filteredReady = filteredTickets.filter(t => t.is_billed && t.current_stage !== 'Dispatched').length;
  const filteredDispatched = filteredTickets.filter(t => t.current_stage === 'Dispatched').length;

  // Next Dispatch Details
  const nextDispatch = data?.nextDispatch || null;

  // Cycles from API
  const morningCycles = data?.morningDispatch?.cycles || [];
  const eveningCycles = data?.eveningDispatch?.cycles || [];

  // Accurate Shift Dispatch Cards Calculation (Progress clamped 0-100%)
  const shiftCards = useMemo(() => {
    if (selectedRoute === 'ALL') {
      const allMorningTickets = rawTickets.filter(t => String(t.dispatch_slot || 'Morning').toLowerCase() !== 'evening');
      const allEveningTickets = rawTickets.filter(t => String(t.dispatch_slot || '').toLowerCase() === 'evening');

      const mTotal = allMorningTickets.length;
      const mPending = allMorningTickets.filter(t => !t.is_billed && t.current_stage !== 'Cancelled').length;
      const mReady = allMorningTickets.filter(t => t.is_billed && t.current_stage !== 'Dispatched').length;
      const mDispatched = allMorningTickets.filter(t => t.current_stage === 'Dispatched').length;
      const mCalculated = mTotal > 0 ? Math.round(((mReady + mDispatched) / mTotal) * 100) : 100;
      const mProgress = Math.min(100, Math.max(0, mCalculated));

      const eTotal = allEveningTickets.length;
      const ePending = allEveningTickets.filter(t => !t.is_billed && t.current_stage !== 'Cancelled').length;
      const eReady = allEveningTickets.filter(t => t.is_billed && t.current_stage !== 'Dispatched').length;
      const eDispatched = allEveningTickets.filter(t => t.current_stage === 'Dispatched').length;
      const eCalculated = eTotal > 0 ? Math.round(((eReady + eDispatched) / eTotal) * 100) : 100;
      const eProgress = Math.min(100, Math.max(0, eCalculated));

      const mCutoff = morningCycles[0]?.cutoff_time_formatted || '08:00 AM';
      const mDispatch = morningCycles[0]?.dispatch_time_formatted || '10:00 AM';
      const eCutoff = eveningCycles[0]?.cutoff_time_formatted || '04:00 PM';
      const eDispatch = eveningCycles[0]?.dispatch_time_formatted || '06:00 PM';

      const cards = [];

      if (selectedSlot === 'ALL' || selectedSlot === 'Morning') {
        if (morningCycles.length > 0 || mTotal > 0 || selectedSlot === 'Morning') {
          cards.push({
            id: 'morning_all',
            title: morningCycles[0]?.trip_name || 'Morning Shift Dispatch',
            subtitle: 'All Routes',
            slot: 'Morning',
            cutoff: mCutoff,
            dispatch: mDispatch,
            status: morningCycles[0]?.statusBadge || (mPending > 0 ? 'In Progress' : 'Ready / Complete'),
            statusColor: morningCycles[0]?.statusClass || (mPending > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'),
            progress: mProgress,
            metrics: { total: mTotal, pending: mPending, ready: mReady, dispatched: mDispatched }
          });
        }
      }

      if (selectedSlot === 'ALL' || selectedSlot === 'Evening') {
        if (eveningCycles.length > 0 || eTotal > 0 || selectedSlot === 'Evening') {
          cards.push({
            id: 'evening_all',
            title: eveningCycles[0]?.trip_name || 'Evening Shift Dispatch',
            subtitle: 'All Routes',
            slot: 'Evening',
            cutoff: eCutoff,
            dispatch: eDispatch,
            status: eveningCycles[0]?.statusBadge || (ePending > 0 ? 'In Progress' : (eTotal > 0 ? 'Completed' : 'Scheduled')),
            statusColor: eveningCycles[0]?.statusClass || (ePending > 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-700 border-slate-200'),
            progress: eProgress,
            metrics: { total: eTotal, pending: ePending, ready: eReady, dispatched: eDispatched }
          });
        }
      }

      return cards;
    }

    const routeTickets = rawTickets.filter(t =>
      checkRoutesMatch(t.route_name, selectedRouteObj?.route_name || selectedRoute, null, selectedRouteObj?.route_code || selectedRoute)
    );

    const rMorningCycle = morningCycles.find(c =>
      checkRoutesMatch(c.route_name, selectedRouteObj?.route_name || selectedRoute, c.route_code, selectedRouteObj?.route_code || selectedRoute)
    );
    const rEveningCycle = eveningCycles.find(c =>
      checkRoutesMatch(c.route_name, selectedRouteObj?.route_name || selectedRoute, c.route_code, selectedRouteObj?.route_code || selectedRoute)
    );

    const hasMorningSched = !!rMorningCycle;
    const hasEveningSched = !!rEveningCycle;

    let mTickets = [];
    let eTickets = [];

    if (hasMorningSched && !hasEveningSched) {
      mTickets = routeTickets;
      eTickets = [];
    } else if (hasEveningSched && !hasMorningSched) {
      mTickets = [];
      eTickets = routeTickets;
    } else {
      mTickets = routeTickets.filter(t => String(t.dispatch_slot || 'Morning').toLowerCase() !== 'evening');
      eTickets = routeTickets.filter(t => String(t.dispatch_slot || '').toLowerCase() === 'evening');
    }

    const cards = [];

    const mTotal = mTickets.length;
    const mPending = mTickets.filter(t => !t.is_billed && t.current_stage !== 'Cancelled').length;
    const mReady = mTickets.filter(t => t.is_billed && t.current_stage !== 'Dispatched').length;
    const mDispatched = mTickets.filter(t => t.current_stage === 'Dispatched').length;
    const mCalculated = mTotal > 0 ? Math.round(((mReady + mDispatched) / mTotal) * 100) : 100;
    const mProgress = Math.min(100, Math.max(0, mCalculated));

    const eTotal = eTickets.length;
    const ePending = eTickets.filter(t => !t.is_billed && t.current_stage !== 'Cancelled').length;
    const eReady = eTickets.filter(t => t.is_billed && t.current_stage !== 'Dispatched').length;
    const eDispatched = eTickets.filter(t => t.current_stage === 'Dispatched').length;
    const eCalculated = eTotal > 0 ? Math.round(((eReady + eDispatched) / eTotal) * 100) : 100;
    const eProgress = Math.min(100, Math.max(0, eCalculated));

    const showMorning = (selectedSlot === 'ALL' || selectedSlot === 'Morning') && (
      hasMorningSched || (!hasEveningSched && (mTotal > 0 || eTotal === 0))
    );

    const showEvening = (selectedSlot === 'ALL' || selectedSlot === 'Evening') && (
      hasEveningSched || (!hasMorningSched && eTotal > 0)
    );

    if (showMorning) {
      cards.push({
        id: 'morning_route',
        title: rMorningCycle?.trip_name || 'Morning Shift Dispatch',
        subtitle: selectedRouteObj?.route_name || selectedRoute,
        slot: 'Morning',
        cutoff: rMorningCycle?.cutoff_time_formatted || '08:00 AM',
        dispatch: rMorningCycle?.dispatch_time_formatted || '10:00 AM',
        status: rMorningCycle?.statusBadge || rMorningCycle?.status || (mPending > 0 ? 'In Progress' : 'Ready'),
        statusColor: rMorningCycle?.statusClass || (mPending > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'),
        progress: mProgress,
        metrics: { total: mTotal, pending: mPending, ready: mReady, dispatched: mDispatched }
      });
    }

    if (showEvening) {
      cards.push({
        id: 'evening_route',
        title: rEveningCycle?.trip_name || 'Evening Shift Dispatch',
        subtitle: selectedRouteObj?.route_name || selectedRoute,
        slot: 'Evening',
        cutoff: rEveningCycle?.cutoff_time_formatted || '04:00 PM',
        dispatch: rEveningCycle?.dispatch_time_formatted || '06:00 PM',
        status: rEveningCycle?.statusBadge || rEveningCycle?.status || (ePending > 0 ? 'In Progress' : 'Scheduled'),
        statusColor: rEveningCycle?.statusClass || (ePending > 0 ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-700 border-slate-200'),
        progress: eProgress,
        metrics: { total: eTotal, pending: ePending, ready: eReady, dispatched: eDispatched }
      });
    }

    return cards;
  }, [selectedRoute, selectedRouteObj, selectedSlot, rawTickets, morningCycles, eveningCycles]);

  // Pagination for table
  const cappedTickets = (filteredTickets || []).slice(0, 150);
  const totalPages = Math.ceil(cappedTickets.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, cappedTickets.length);
  const paginatedTickets = cappedTickets.slice(startIndex, startIndex + pageSize);

  return (
    <div ref={containerRef} className="space-y-3.5 w-full max-w-full overflow-x-hidden font-sans pb-6">
      
      {/* ── TOP CONTROL HEADER (Clean, Uncluttered, High-End SaaS) ── */}
      <div className="relative z-30 bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          
          {/* Left: Brand / Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#002855] to-[#004c8f] flex items-center justify-center text-white shadow-sm shadow-blue-900/10 shrink-0">
              <RouteIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Dispatch Control Panel
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  LIVE
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Route readiness, shift dispatch schedules &amp; live fulfillment queue
              </p>
            </div>
          </div>

          {/* Right: Route Selector & Action Controls */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            
            {/* Route Selector Dropdown */}
            <div className="flex-1 sm:w-64 md:w-72 min-w-[200px]">
              <SearchableSelect
                value={selectedRoute}
                onChange={(e) => {
                  setSelectedRoute(e.target.value);
                  setCurrentPage(1);
                }}
                options={routeSelectOptions}
                placeholder="Select Delivery Route..."
                searchPlaceholder="Search Route..."
                renderSelected={(opt) => (
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-slate-400 font-bold text-[11px] shrink-0">Route:</span>
                    <span className="font-extrabold text-slate-900 truncate text-xs">{opt.label}</span>
                  </div>
                )}
                className="bg-slate-50 hover:bg-slate-100/70 border-slate-300 font-bold text-xs text-slate-900 rounded-xl shadow-2xs transition-all h-[38px] py-1"
                minSearchItems={5}
              />
            </div>

            {/* Refresh Button with Countdown */}
            <button
              type="button"
              onClick={() => fetchDashboard()}
              className="h-[38px] px-3 rounded-xl bg-[#003366] hover:bg-[#002244] active:scale-95 text-white font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer shrink-0"
              title="Refresh Live Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="text-[11px]">({refreshCountdown}s)</span>
            </button>

            {/* Fullscreen Focus Mode Toggle */}
            <button
              type="button"
              onClick={toggleFullScreen}
              className="h-[38px] w-[38px] rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center cursor-pointer transition-all shadow-2xs shrink-0 active:scale-95"
              title={isFullScreen ? 'Exit Full Screen' : 'Full Screen View'}
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4 text-indigo-600" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── FILTER & SEARCH TOOLBAR (Clean Segmented Tabs & Responsive Search) ── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-2.5 sm:p-3 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-2.5">
        
        {/* Left: Shift & Stage Filter Groups */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Shift Slot Selector */}
          <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200/70 shrink-0">
            <button
              type="button"
              onClick={() => { setSelectedSlot('ALL'); setCurrentPage(1); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedSlot === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Shifts
            </button>
            <button
              type="button"
              onClick={() => { setSelectedSlot('Morning'); setCurrentPage(1); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 ${
                selectedSlot === 'Morning'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sun className="w-3 h-3 text-amber-200" /> Morning
            </button>
            <button
              type="button"
              onClick={() => { setSelectedSlot('Evening'); setCurrentPage(1); }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1 ${
                selectedSlot === 'Evening'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Moon className="w-3 h-3 text-indigo-200" /> Evening
            </button>
          </div>

          {/* Quick Stage Tabs */}
          <div className="inline-flex flex-wrap items-center bg-slate-100 p-1 rounded-xl border border-slate-200/70 gap-1">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'Pending', label: `Pending (${filteredPending})`, dot: 'bg-rose-500' },
              { id: 'Picking', label: `Picking (${filteredPicking})`, dot: 'bg-amber-500' },
              { id: 'Ready', label: `Ready (${filteredReady})`, dot: 'bg-emerald-500' },
              { id: 'Dispatched', label: `Dispatched (${filteredDispatched})`, dot: 'bg-purple-500' }
            ].map(st => (
              <button
                key={st.id}
                type="button"
                onClick={() => { setSelectedStage(st.id); setCurrentPage(1); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
                  selectedStage === st.id
                    ? 'bg-[#003366] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st.dot && selectedStage !== st.id && (
                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}></span>
                )}
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search Ticket, Party, PO, Picker..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-7 py-1.5 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#004c8f] focus:ring-1 focus:ring-[#004c8f] focus:outline-none transition-all shadow-2xs"
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

      {/* ── NEXT UPCOMING DISPATCH BANNER (Modern SaaS Hero Strip) ── */}
      {nextDispatch && (
        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-[#002855] to-slate-900 rounded-2xl p-4 text-white shadow-md border border-slate-800">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Flame className="w-5 h-5 text-amber-400 animate-pulse" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                    Next Upcoming Dispatch:
                  </span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-white/10 text-cyan-300 font-black text-xs border border-white/15 backdrop-blur-xs">
                    {nextDispatch.route_name} ({nextDispatch.slot})
                  </span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                    nextDispatch.is_delayed ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {nextDispatch.status}
                  </span>
                </div>
                <div className="text-xs text-slate-300 flex flex-wrap items-center gap-3 font-medium mt-1">
                  <span>Cutoff: <strong className="text-white font-bold">{nextDispatch.cutoff_time_formatted}</strong></span>
                  <span className="text-slate-500">•</span>
                  <span>Dispatch: <strong className="text-white font-bold">{nextDispatch.dispatch_time_formatted}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 justify-between md:justify-end border-t md:border-t-0 border-white/10 pt-3 md:pt-0">
              <div className="text-left md:text-right">
                <div className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Time Remaining</div>
                <div className={`text-base sm:text-lg font-mono font-black ${nextDispatch.is_delayed ? 'text-red-400' : 'text-emerald-400'}`}>
                  {nextDispatch.time_remaining || 'On Schedule'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SHIFT READINESS & DISPATCH CARDS (Premium Grid Layout) ── */}
      <div className={`grid grid-cols-1 ${shiftCards.length > 1 ? 'lg:grid-cols-2' : ''} gap-4`}>
        {shiftCards.map((card) => {
          const isMorning = card.slot === 'Morning';
          return (
            <div
              key={card.id}
              className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all space-y-4 relative overflow-hidden"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-xs ${
                    isMorning
                      ? 'bg-amber-50 text-amber-600 border border-amber-200'
                      : 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                  }`}>
                    {isMorning ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
                      {card.title}
                      <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                        {card.subtitle}
                      </span>
                    </h3>
                    <div className="text-[11px] text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                      <span>Cutoff: <strong className="text-slate-800">{card.cutoff}</strong></span>
                      <span>•</span>
                      <span>Dispatch: <strong className="text-slate-800">{card.dispatch}</strong></span>
                    </div>
                  </div>
                </div>

                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border shadow-2xs ${card.statusColor}`}>
                  {card.status}
                </span>
              </div>

              {/* Progress Bar & Status percentage */}
              <div className="space-y-1.5 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                  <span className="flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-indigo-600" />
                    Readiness Progress
                  </span>
                  <span className="text-indigo-800 font-mono font-black text-xs bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                    {card.progress}% Ready
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-200/70 rounded-full overflow-hidden p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      card.progress >= 90
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        : card.progress >= 50
                        ? 'bg-gradient-to-r from-amber-500 via-indigo-500 to-emerald-500'
                        : 'bg-gradient-to-r from-rose-500 to-amber-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(4, card.progress))}%` }}
                  ></div>
                </div>
              </div>

              {/* Stage Breakdown Metric Quadrants */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center">
                {/* Total */}
                <div className="bg-slate-50 hover:bg-slate-100/80 transition-colors p-2.5 rounded-xl border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Total</div>
                  <div className="text-base sm:text-lg font-black text-slate-900 mt-0.5">{card.metrics.total}</div>
                  <div className="text-[9px] text-slate-400 font-medium">Pick Tickets</div>
                </div>

                {/* Pending */}
                <div className="bg-rose-50/70 hover:bg-rose-50 transition-colors p-2.5 rounded-xl border border-rose-200/80">
                  <div className="text-[10px] text-rose-700 font-extrabold uppercase tracking-wider">Pending</div>
                  <div className="text-base sm:text-lg font-black text-rose-700 mt-0.5">{card.metrics.pending}</div>
                  <div className="text-[9px] text-rose-500 font-medium">To Be Billed</div>
                </div>

                {/* Ready */}
                <div className="bg-emerald-50/70 hover:bg-emerald-50 transition-colors p-2.5 rounded-xl border border-emerald-200/80">
                  <div className="text-[10px] text-emerald-700 font-extrabold uppercase tracking-wider">Ready</div>
                  <div className="text-base sm:text-lg font-black text-emerald-700 mt-0.5">{card.metrics.ready}</div>
                  <div className="text-[9px] text-emerald-500 font-medium">In Invoicing</div>
                </div>

                {/* Dispatched */}
                <div className="bg-purple-50/70 hover:bg-purple-50 transition-colors p-2.5 rounded-xl border border-purple-200/80">
                  <div className="text-[10px] text-purple-700 font-extrabold uppercase tracking-wider">Dispatched</div>
                  <div className="text-base sm:text-lg font-black text-purple-700 mt-0.5">{card.metrics.dispatched}</div>
                  <div className="text-[9px] text-purple-500 font-medium">Loaded &amp; Out</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── LIVE PICK TICKETS QUEUE MATRIX (Enterprise Modern Table) ── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-sm space-y-0 w-full">
        
        {/* Table Header Bar */}
        <div className="bg-gradient-to-r from-slate-900 via-[#002855] to-slate-900 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-cyan-300">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                Live Pick Tickets Queue
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                  {filteredTickets.length}
                </span>
              </h3>
            </div>
            {selectedRouteObj && (
              <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-200 border border-blue-400/30 rounded-lg text-xs font-bold hidden sm:inline-block">
                Route: {selectedRouteObj.route_name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-300 font-medium hidden sm:inline">
              Showing <strong className="text-white font-bold">{filteredPending}</strong> Pending • <strong className="text-emerald-400 font-bold">{filteredReady}</strong> Ready • <strong className="text-amber-300 font-bold">{filteredCartons}</strong> Cartons
            </span>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50/90 text-slate-600 border-b border-slate-200 font-black uppercase tracking-wider text-[11px]">
                <th className="px-3.5 py-3 whitespace-nowrap text-center w-12">#</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Ticket No</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Party Name &amp; Code</th>
                <th className="px-2.5 py-3 text-center whitespace-nowrap">Cartons</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Route</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Shift</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Assigned Picker</th>
                <th className="px-3.5 py-3 text-center whitespace-nowrap">Aging / Waiting</th>
                <th className="px-3.5 py-3 text-center whitespace-nowrap">Status</th>
                <th className="px-3.5 py-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-20 text-slate-400 font-bold">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-[#004c8f]" />
                    <span className="text-sm text-slate-600">Loading live pick tickets queue...</span>
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-slate-400">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500 opacity-80" />
                    <div className="text-sm font-bold text-slate-800">No Pick Tickets Found</div>
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                      No pick tickets match the selected route or filter stage.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedTickets.map((t, idx) => {
                  const isCritical = t.aging_minutes >= 60;
                  const isWarning = t.aging_minutes >= 30 && t.aging_minutes < 60;

                  return (
                    <tr
                      key={t.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* # Index */}
                      <td className="px-3.5 py-3 text-slate-400 font-mono font-bold whitespace-nowrap text-center text-[11px]">
                        {startIndex + idx + 1}
                      </td>

                      {/* Ticket No */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openTicketModal(t.id)}
                          className="font-mono font-bold text-[#004c8f] group-hover:text-[#002244] hover:underline cursor-pointer bg-blue-50/80 hover:bg-blue-100 px-2 py-1 rounded-lg border border-blue-200 transition-colors inline-flex items-center gap-1"
                        >
                          <span>{t.pick_ticket_no}</span>
                        </button>
                        {t.customer_order_no && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">PO: {t.customer_order_no}</div>
                        )}
                      </td>

                      {/* Party */}
                      <td className="px-3.5 py-3">
                        <div className="font-extrabold text-slate-900 line-clamp-1 max-w-[220px]" title={t.party_name}>
                          {t.party_name}
                        </div>
                        <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100/60">
                          {t.party_code}
                        </span>
                      </td>

                      {/* Cartons Qty */}
                      <td className="px-2.5 py-3 text-center whitespace-nowrap font-black text-slate-900 text-sm">
                        <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/70 font-mono">
                          {t.cartons}
                        </span>
                      </td>

                      {/* Route */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-bold border border-slate-200 text-xs">
                          {t.route_name}
                        </span>
                      </td>

                      {/* Slot / Shift */}
                      <td className="px-3.5 py-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold inline-flex items-center gap-1 ${
                          t.dispatch_slot === 'Evening'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {t.dispatch_slot === 'Evening' ? '🌙 Evening' : '☀️ Morning'}
                        </span>
                        <span className="text-slate-400 font-mono text-[10px] ml-1.5">{t.time || '09:00'}</span>
                      </td>

                      {/* Assigned Picker */}
                      <td className="px-3.5 py-3 whitespace-nowrap font-semibold text-slate-700">
                        {t.picker_name || t.assigned_to || (
                          <span className="text-slate-400 italic font-normal">Unassigned</span>
                        )}
                      </td>

                      {/* Aging / Waiting Time */}
                      <td className="px-3.5 py-3 text-center whitespace-nowrap">
                        <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          isCritical
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : isWarning
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
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
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-rose-600" /> Pending Billing
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
                              className="px-2.5 py-1 rounded-lg bg-[#003366] hover:bg-[#002244] text-white text-[11px] font-extrabold shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1 active:scale-95"
                              title="Go to Billing desk"
                            >
                              <Receipt className="w-3 h-3" /> Bill Now
                            </button>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold border border-slate-200 font-mono">
                              {t.bill_no || 'Billed'}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => openTicketModal(t.id)}
                            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer transition-colors shadow-2xs hover:text-[#004c8f]"
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
          <div className="px-4 sm:px-6 py-3 bg-slate-50/90 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-slate-500 font-medium">
              Showing <strong className="text-slate-900 font-bold">{cappedTickets.length > 0 ? startIndex + 1 : 0}</strong> to <strong className="text-slate-900 font-bold">{endIndex}</strong> of <strong className="text-slate-900 font-bold">{cappedTickets.length}</strong> tickets
              {filteredTickets.length > 150 && (
                <span className="text-[11px] text-slate-400 font-normal ml-1.5">(view capped at 150)</span>
              )}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-all"
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
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── SINGLE PICK TICKET TIMELINE MODAL DRAWER ── */}
      {selectedTicketId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl w-full max-w-2xl border border-slate-200 shadow-2xl overflow-hidden space-y-0 max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-[#002855] to-slate-900 p-4 sm:p-5 flex items-center justify-between shrink-0 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-mono font-bold text-cyan-300 border border-white/15">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white font-mono">
                    Pick Ticket {ticketDetail?.pick_ticket_no || 'Details'}
                  </h3>
                  <p className="text-xs text-blue-200 font-medium">Lifecycle tracking &amp; operational stage progression</p>
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
                <div className="text-center py-16 text-slate-400 font-bold">
                  <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-[#004c8f]" />
                  Loading ticket lifecycle details...
                </div>
              ) : ticketDetail ? (
                <>
                  {/* Context Info Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Party Name</span>
                      <div className="font-bold text-slate-900 mt-0.5 line-clamp-1">{ticketDetail.party_name}</div>
                      <span className="font-mono text-[#004c8f] font-bold">{ticketDetail.party_code}</span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Route &amp; Shift</span>
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
                      <div className="font-bold text-rose-600 mt-0.5">{ticketDetail.aging_formatted || 'Normal'}</div>
                    </div>
                  </div>

                  {/* Operational Progression Timeline */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Progression Stages
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                      <div className="p-3 rounded-xl border bg-emerald-50 border-emerald-200">
                        <div className="text-[10px] font-bold text-emerald-800 uppercase flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600" /> 1. Created
                        </div>
                        <div className="font-bold text-slate-800 mt-1">{ticketDetail.date || '—'}</div>
                        <div className="text-[10px] text-slate-500">{ticketDetail.time || '—'}</div>
                      </div>

                      <div className={`p-3 rounded-xl border ${
                        ['Picking', 'Billing', 'Ready', 'Dispatched'].includes(ticketDetail.current_stage)
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-slate-50 border-slate-200 opacity-60'
                      }`}>
                        <div className="text-[10px] font-bold text-slate-700 uppercase flex items-center gap-1">
                          {['Picking', 'Billing', 'Ready', 'Dispatched'].includes(ticketDetail.current_stage) ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : null}
                          2. Picking
                        </div>
                        <div className="font-bold text-slate-800 mt-1">{ticketDetail.picker?.name || 'In Progress'}</div>
                        <div className="text-[10px] text-slate-500">
                          {ticketDetail.current_stage === 'Picking' ? 'Active Picking' : 'Completed'}
                        </div>
                      </div>

                      <div className={`p-3 rounded-xl border ${
                        ticketDetail.is_billed || ['Ready', 'Dispatched'].includes(ticketDetail.current_stage)
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-slate-50 border-slate-200 opacity-60'
                      }`}>
                        <div className="text-[10px] font-bold text-slate-700 uppercase flex items-center gap-1">
                          {ticketDetail.is_billed || ['Ready', 'Dispatched'].includes(ticketDetail.current_stage) ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : null}
                          3. Billing
                        </div>
                        <div className="font-bold text-slate-800 mt-1">
                          {ticketDetail.billing?.bill_no || (ticketDetail.is_billed ? 'Billed' : 'Pending')}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {ticketDetail.billing?.billed_qty ? `Qty: ${ticketDetail.billing.billed_qty}` : 'Pending Desk'}
                        </div>
                      </div>

                      <div className={`p-3 rounded-xl border ${
                        ticketDetail.current_stage === 'Dispatched'
                          ? 'bg-purple-50 border-purple-200'
                          : 'bg-slate-50 border-slate-200 opacity-60'
                      }`}>
                        <div className="text-[10px] font-bold text-slate-700 uppercase flex items-center gap-1">
                          {ticketDetail.current_stage === 'Dispatched' ? (
                            <Check className="w-3 h-3 text-purple-600" />
                          ) : null}
                          4. Dispatch
                        </div>
                        <div className="font-bold text-slate-800 mt-1">
                          {ticketDetail.current_stage === 'Dispatched' ? 'Dispatched' : 'Awaiting Trip'}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {ticketDetail.dispatch_party?.status || 'Pending Loading'}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
