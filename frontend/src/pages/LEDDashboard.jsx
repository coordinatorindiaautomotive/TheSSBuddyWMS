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
  Building2,
  Calendar,
  AlertTriangle,
  FileText,
  Check
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

    // From Raw Tickets
    rawTickets.forEach(t => {
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

  // SearchableSelect route options with inline pending badges
  const totalSystemPending = rawTickets.filter(t => !t.is_billed && t.current_stage !== 'Cancelled').length;
  const routeSelectOptions = useMemo(() => {
    return [
      {
        value: 'ALL',
        label: 'All Delivery Routes',
        sublabel: `${routesList.length} Active Routes`,
        badge: `${totalSystemPending} Pending`
      },
      ...routesList.map(r => ({
        value: r.route_name,
        label: r.route_name,
        sublabel: r.route_code ? `${r.route_code} • ${r.total_count} Total` : `${r.total_count} Total`,
        badge: r.unbilled_count > 0 ? `${r.unbilled_count} Pending` : '0'
      }))
    ];
  }, [routesList, totalSystemPending]);

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
  const filteredCartons = filteredTickets.reduce((sum, t) => sum + (t.cartons || 1), 0);
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

  // Accurate Shift Dispatch Cards Calculation
  const shiftCards = useMemo(() => {
    if (selectedRoute === 'ALL') {
      const allMorningTickets = rawTickets.filter(t => String(t.dispatch_slot || 'Morning').toLowerCase() === 'morning');
      const allEveningTickets = rawTickets.filter(t => String(t.dispatch_slot || '').toLowerCase() === 'evening');

      const mTotal = allMorningTickets.length;
      const mPending = allMorningTickets.filter(t => !t.is_billed && t.current_stage !== 'Cancelled').length;
      const mReady = allMorningTickets.filter(t => t.is_billed && t.current_stage !== 'Dispatched').length;
      const mDispatched = allMorningTickets.filter(t => t.current_stage === 'Dispatched').length;
      const mProgress = mTotal > 0 ? Math.round(((mReady + mDispatched) / mTotal) * 100) : 100;

      const eTotal = allEveningTickets.length;
      const ePending = allEveningTickets.filter(t => !t.is_billed && t.current_stage !== 'Cancelled').length;
      const eReady = allEveningTickets.filter(t => t.is_billed && t.current_stage !== 'Dispatched').length;
      const eDispatched = allEveningTickets.filter(t => t.current_stage === 'Dispatched').length;
      const eProgress = eTotal > 0 ? Math.round(((eReady + eDispatched) / eTotal) * 100) : 100;

      return [
        {
          id: 'morning_all',
          title: 'Morning Shift Dispatch',
          subtitle: 'All Routes (Morning)',
          slot: 'Morning',
          cutoff: '08:00 AM',
          dispatch: '10:00 AM',
          status: mPending > 0 ? 'In Progress' : 'Completed',
          statusColor: mPending > 0 ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200',
          progress: mProgress,
          metrics: { total: mTotal, pending: mPending, ready: mReady, dispatched: mDispatched }
        },
        {
          id: 'evening_all',
          title: 'Evening Shift Dispatch',
          subtitle: 'All Routes (Evening)',
          slot: 'Evening',
          cutoff: '04:00 PM',
          dispatch: '06:00 PM',
          status: ePending > 0 ? 'In Progress' : (eTotal > 0 ? 'Completed' : 'Upcoming'),
          statusColor: ePending > 0 ? 'bg-indigo-50 text-indigo-800 border-indigo-200' : 'bg-slate-100 text-slate-700 border-slate-200',
          progress: eProgress,
          metrics: { total: eTotal, pending: ePending, ready: eReady, dispatched: eDispatched }
        }
      ];
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

    const cards = [];

    const mTickets = routeTickets.filter(t => String(t.dispatch_slot || 'Morning').toLowerCase() === 'morning');
    const mTotal = mTickets.length;
    const mPending = mTickets.filter(t => !t.is_billed && t.current_stage !== 'Cancelled').length;
    const mReady = mTickets.filter(t => t.is_billed && t.current_stage !== 'Dispatched').length;
    const mDispatched = mTickets.filter(t => t.current_stage === 'Dispatched').length;
    const mProgress = mTotal > 0 ? Math.round(((mReady + mDispatched) / mTotal) * 100) : 100;

    const eTickets = routeTickets.filter(t => String(t.dispatch_slot || '').toLowerCase() === 'evening');
    const eTotal = eTickets.length;
    const ePending = eTickets.filter(t => !t.is_billed && t.current_stage !== 'Cancelled').length;
    const eReady = eTickets.filter(t => t.is_billed && t.current_stage !== 'Dispatched').length;
    const eDispatched = eTickets.filter(t => t.current_stage === 'Dispatched').length;
    const eProgress = eTotal > 0 ? Math.round(((eReady + eDispatched) / eTotal) * 100) : 100;

    if (rMorningCycle || mTotal > 0 || (!rEveningCycle && eTotal === 0)) {
      cards.push({
        id: 'morning_route',
        title: rMorningCycle?.trip_name || 'Morning Shift Dispatch',
        subtitle: selectedRouteObj?.route_name || selectedRoute,
        slot: 'Morning',
        cutoff: rMorningCycle?.cutoff_time_formatted || '08:00 AM',
        dispatch: rMorningCycle?.dispatch_time_formatted || '10:00 AM',
        status: rMorningCycle?.status || (mPending > 0 ? 'In Progress' : 'Ready'),
        statusColor: mPending > 0 ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200',
        progress: mProgress,
        metrics: { total: mTotal, pending: mPending, ready: mReady, dispatched: mDispatched }
      });
    }

    if (rEveningCycle || eTotal > 0) {
      cards.push({
        id: 'evening_route',
        title: rEveningCycle?.trip_name || 'Evening Shift Dispatch',
        subtitle: selectedRouteObj?.route_name || selectedRoute,
        slot: 'Evening',
        cutoff: rEveningCycle?.cutoff_time_formatted || '04:00 PM',
        dispatch: rEveningCycle?.dispatch_time_formatted || '06:00 PM',
        status: rEveningCycle?.status || (ePending > 0 ? 'In Progress' : 'Upcoming'),
        statusColor: ePending > 0 ? 'bg-indigo-50 text-indigo-800 border-indigo-200' : 'bg-slate-100 text-slate-700 border-slate-200',
        progress: eProgress,
        metrics: { total: eTotal, pending: ePending, ready: eReady, dispatched: eDispatched }
      });
    }

    return cards;
  }, [selectedRoute, selectedRouteObj, rawTickets, morningCycles, eveningCycles]);

  // Pagination for table
  const cappedTickets = (filteredTickets || []).slice(0, 100);
  const totalPages = Math.ceil(cappedTickets.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, cappedTickets.length);
  const paginatedTickets = cappedTickets.slice(startIndex, startIndex + pageSize);

  return (
    <div ref={containerRef} className="space-y-3 w-full max-w-full overflow-x-hidden">
      
      {/* ── Top Header Row with Right-Top Route Dropdown & Controls ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        
        {/* Left: Brand Title & Live Pulse */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-[#003366] flex items-center justify-center text-white shadow-xs shrink-0">
            <RouteIcon className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight whitespace-nowrap">
                Dispatch Control Panel
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> LIVE SYNC
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
              Route readiness, shift dispatch schedules &amp; fulfillment queue.
            </p>
          </div>
        </div>

        {/* Right-Top: Prominent Route Dropdown & Essential Status Tools */}
        <div className="flex flex-wrap items-center gap-2 shrink-0 ml-auto">
          
          {/* Route Selector Dropdown (Right Top) */}
          <div className="w-52 sm:w-60 md:w-64 min-w-[190px]">
            <SearchableSelect
              value={selectedRoute}
              onChange={(e) => {
                setSelectedRoute(e.target.value);
                setCurrentPage(1);
              }}
              options={routeSelectOptions}
              placeholder="-- Select Delivery Route --"
              searchPlaceholder="Search Route..."
              className="bg-slate-50 border-indigo-200 font-extrabold text-xs text-slate-900 shadow-2xs"
              minSearchItems={5}
            />
          </div>

          {/* Active Warehouse Badge */}
          <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-[#004c8f] font-extrabold text-[11px] uppercase flex items-center gap-1 shrink-0">
            <Building2 className="w-3.5 h-3.5 text-[#004c8f]" />
            <span>{activeWarehouse ? (activeWarehouse.warehouse_code || activeWarehouse.warehouse_name) : 'WH-MAIN'}</span>
          </div>

          {/* Real-time IST Digital Clock */}
          <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono font-bold text-xs flex items-center gap-1 shrink-0 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchDashboard()}
            className="px-2.5 py-1.5 rounded-xl bg-[#003366] hover:bg-[#002244] active:scale-95 text-white font-extrabold text-xs flex items-center gap-1 transition-all shadow-xs cursor-pointer shrink-0"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden lg:inline">({refreshCountdown}s)</span>
          </button>

          {/* Fullscreen TV Mode */}
          <button
            type="button"
            onClick={toggleFullScreen}
            className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer transition-colors shadow-2xs shrink-0"
            title={isFullScreen ? 'Exit Full Screen' : 'Full Screen View'}
          >
            {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ── Filter & Search Toolbar (100% Fully Responsive) ─────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
        
        {/* Left Group: Shift Selector & Stage Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Shift Slot Selector */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => { setSelectedSlot('ALL'); setCurrentPage(1); }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedSlot === 'ALL'
                  ? 'bg-[#003366] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Shifts
            </button>
            <button
              type="button"
              onClick={() => { setSelectedSlot('Morning'); setCurrentPage(1); }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                selectedSlot === 'Morning'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sun className="w-3 h-3 text-amber-500" /> Morning
            </button>
            <button
              type="button"
              onClick={() => { setSelectedSlot('Evening'); setCurrentPage(1); }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                selectedSlot === 'Evening'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Moon className="w-3 h-3 text-indigo-400" /> Evening
            </button>
          </div>

          {/* Quick Stage Tabs */}
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'Pending', label: `Pending (${filteredPending})` },
              { id: 'Picking', label: `Picking (${filteredPicking})` },
              { id: 'Ready', label: `Ready (${filteredReady})` },
              { id: 'Dispatched', label: `Dispatched (${filteredDispatched})` }
            ].map(st => (
              <button
                key={st.id}
                type="button"
                onClick={() => { setSelectedStage(st.id); setCurrentPage(1); }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                  selectedStage === st.id
                    ? 'bg-[#003366] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right Group: Search Box & Route Summary */}
        <div className="flex flex-wrap items-center gap-2 ml-auto w-full sm:w-auto">
          
          {/* Quick Search */}
          <div className="relative flex-1 sm:w-56 md:w-64 min-w-[160px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Ticket No, Party, PO..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-6 py-1.5 text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#004c8f] focus:outline-none shadow-2xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Active Context Chip */}
          <div className="text-[11px] text-slate-500 font-semibold hidden md:flex items-center gap-1.5 shrink-0 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200">
            <span>Viewing:</span>
            <span className="font-extrabold text-[#003366]">
              {selectedRouteObj ? selectedRouteObj.route_name : 'ALL ROUTES'}
            </span>
            <span>•</span>
            <span className="font-bold text-slate-800">{filteredTotal} Tickets ({filteredCartons} Ctn)</span>
          </div>
        </div>
      </div>

      {/* ── Next Dispatch Live Banner ─────────────────────────────── */}
      {nextDispatch && (
        <div className="bg-white border-l-4 border-l-[#003366] border border-slate-200 rounded-2xl px-4 py-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#004c8f] shrink-0">
              <Flame className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">Next Upcoming Dispatch:</span>
                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-[#004c8f] font-black text-xs border border-blue-200">
                  {nextDispatch.route_name} ({nextDispatch.slot})
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                  nextDispatch.is_delayed ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}>
                  {nextDispatch.status}
                </span>
              </div>
              <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 font-medium mt-0.5">
                <span>Cutoff: <strong className="text-slate-800 font-bold">{nextDispatch.cutoff_time_formatted}</strong></span>
                <span>•</span>
                <span>Dispatch: <strong className="text-slate-800 font-bold">{nextDispatch.dispatch_time_formatted}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <div className="text-right">
              <div className="text-[10px] text-slate-400 font-black uppercase">Time Remaining</div>
              <div className={`text-sm sm:text-base font-mono font-black ${nextDispatch.is_delayed ? 'text-red-600' : 'text-emerald-700'}`}>
                {nextDispatch.time_remaining}
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/dispatch-planning')}
              className="px-3.5 py-1.5 rounded-xl bg-[#003366] hover:bg-[#002244] text-white font-extrabold text-xs flex items-center gap-1 cursor-pointer transition-all shadow-xs"
            >
              <span>Plan Trip</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Shift Readiness & Dispatch Cards (Accurate & Dynamic) ───── */}
      <div className={`grid grid-cols-1 ${shiftCards.length > 1 ? 'md:grid-cols-2' : ''} gap-3`}>
        {shiftCards.map((card) => (
          <div key={card.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                  card.slot === 'Morning' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                }`}>
                  {card.slot === 'Morning' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-1.5">
                    {card.title}
                    <span className="text-[11px] text-indigo-700 font-bold">({card.subtitle})</span>
                  </h3>
                  <span className="text-[10px] sm:text-[11px] text-slate-500 font-medium">
                    Cutoff: <strong className="text-slate-800">{card.cutoff}</strong> | Dispatch: <strong className="text-slate-800">{card.dispatch}</strong>
                  </span>
                </div>
              </div>

              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${card.statusColor}`}>
                {card.status}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-0.5">
              <div className="flex justify-between text-[10px] font-bold text-slate-500">
                <span>Readiness Progress</span>
                <span className="text-indigo-700 font-mono font-black">{card.progress}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 via-indigo-600 to-emerald-500 transition-all duration-500"
                  style={{ width: `${card.progress}%` }}
                ></div>
              </div>
            </div>

            {/* Stage breakdown numbers */}
            <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-slate-100 text-center">
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                <div className="text-[9px] text-slate-500 font-black uppercase">Total</div>
                <div className="text-sm sm:text-base font-black text-slate-900">{card.metrics.total}</div>
              </div>
              <div className="bg-red-50/60 p-2 rounded-xl border border-red-200">
                <div className="text-[9px] text-red-600 font-black uppercase">Pending</div>
                <div className="text-sm sm:text-base font-black text-red-700">{card.metrics.pending}</div>
              </div>
              <div className="bg-emerald-50/60 p-2 rounded-xl border border-emerald-200">
                <div className="text-[9px] text-emerald-600 font-black uppercase">Ready</div>
                <div className="text-sm sm:text-base font-black text-emerald-700">{card.metrics.ready}</div>
              </div>
              <div className="bg-purple-50/60 p-2 rounded-xl border border-purple-200">
                <div className="text-[9px] text-purple-600 font-black uppercase">Dispatched</div>
                <div className="text-sm sm:text-base font-black text-purple-700">{card.metrics.dispatched}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Dense Live Ticket Matrix (Data Table) ──────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs space-y-0 w-full">
        
        {/* Table Action Header */}
        <div className="bg-[#003366] border-b-4 border-[#ed1c24] px-4 py-3 flex flex-wrap items-center justify-between gap-2.5 text-white">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
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
            <span className="text-xs text-blue-100 font-semibold">
              Showing {filteredPending} Pending • {filteredReady} Ready • {filteredCartons} Cartons
            </span>
          </div>
        </div>

        {/* Data Table with Smooth Horizontal Scrolling Container */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-black uppercase tracking-wider text-[11px]">
                <th className="px-3.5 py-2.5 whitespace-nowrap text-center w-12">#</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Ticket No</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Party Name &amp; Code</th>
                <th className="px-2.5 py-2.5 text-center whitespace-nowrap">Qty / Cartons</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Route</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Shift</th>
                <th className="px-3.5 py-2.5 whitespace-nowrap">Assigned Picker</th>
                <th className="px-3.5 py-2.5 text-center whitespace-nowrap">Aging / Waiting Time</th>
                <th className="px-3.5 py-2.5 text-center whitespace-nowrap">Status</th>
                <th className="px-3.5 py-2.5 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-slate-400 font-bold">
                    <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-[#004c8f]" />
                    Loading live pick tickets...
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-16 text-slate-400">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
                    <div className="text-base font-bold text-slate-800">No Tickets Found in View</div>
                    <p className="text-xs text-slate-400 mt-1 font-medium">
                      No pick tickets match the selected route or filter options.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedTickets.map((t, idx) => {
                  const isCritical = t.aging_minutes >= 60;
                  const isWarning = t.aging_minutes >= 30 && t.aging_minutes < 60;

                  return (
                    <tr key={t.id} className="hover:bg-indigo-50/40 transition-colors">
                      {/* # Index */}
                      <td className="px-3.5 py-2.5 text-slate-400 font-mono font-bold whitespace-nowrap text-center">
                        {startIndex + idx + 1}
                      </td>

                      {/* Ticket No */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openTicketModal(t.id)}
                          className="font-mono font-bold text-[#004c8f] hover:text-[#003366] hover:underline cursor-pointer bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-lg border border-blue-200 transition-colors"
                        >
                          {t.pick_ticket_no}
                        </button>
                        {t.customer_order_no && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">PO: {t.customer_order_no}</div>
                        )}
                      </td>

                      {/* Party */}
                      <td className="px-3.5 py-2.5">
                        <div className="font-extrabold text-slate-900 line-clamp-1 max-w-[220px]" title={t.party_name}>
                          {t.party_name}
                        </div>
                        <span className="text-[10px] font-mono font-bold text-indigo-700">{t.party_code}</span>
                      </td>

                      {/* Qty */}
                      <td className="px-2.5 py-2.5 text-center whitespace-nowrap font-black text-slate-900 text-sm">
                        {t.cartons}
                      </td>

                      {/* Route */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold border border-slate-200 text-xs">
                          {t.route_name}
                        </span>
                      </td>

                      {/* Slot */}
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
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
                      <td className="px-3.5 py-2.5 whitespace-nowrap font-semibold text-slate-700">
                        {t.picker_name || t.assigned_to || '—'}
                      </td>

                      {/* Aging / Waiting Time */}
                      <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                        <div className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          isCritical
                            ? 'bg-red-50 text-red-700 border-red-200 animate-pulse'
                            : isWarning
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          <Clock className="w-3 h-3" />
                          <span>{t.aging_formatted || `${t.aging_minutes}m`}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                        {t.current_stage === 'Cancelled' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200 line-through">
                            Cancelled
                          </span>
                        ) : t.current_stage === 'Dispatched' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 inline-flex items-center gap-1">
                            <Truck className="w-3 h-3" /> Dispatched
                          </span>
                        ) : t.is_billed ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Billed ({t.bill_no || 'Ready'})
                          </span>
                        ) : t.current_stage === 'Picking' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                            <PackageCheck className="w-3 h-3 text-amber-600" /> In Picking
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-red-600" /> Pending Billing
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {!t.is_billed ? (
                            <button
                              type="button"
                              onClick={() => navigate('/billing')}
                              className="px-2.5 py-1 rounded-lg bg-[#003366] hover:bg-[#002244] text-white text-[11px] font-extrabold shadow-2xs transition-all cursor-pointer flex items-center gap-1"
                              title="Go to Billing desk"
                            >
                              <Receipt className="w-3 h-3" /> Bill Now
                            </button>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold border border-slate-200">
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
          <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 font-medium">
              Showing <strong className="text-slate-900 font-bold">{cappedTickets.length > 0 ? startIndex + 1 : 0}</strong> to <strong className="text-slate-900 font-bold">{endIndex}</strong> of <strong className="text-slate-900 font-bold">{cappedTickets.length}</strong> tickets
              {filteredTickets.length > 100 && (
                <span className="text-[11px] text-slate-400 font-normal ml-1.5">(capped at max 100 — filter by route/shift)</span>
              )}
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
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
                className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
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
                  <p className="text-xs text-blue-100 font-medium">Lifecycle tracking &amp; operational stage progression</p>
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
                      <div className="font-bold text-red-600 mt-0.5">{ticketDetail.aging_formatted || 'Normal'}</div>
                    </div>
                  </div>

                  {/* Operational Progression Timeline */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Progression Stages</h4>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                      <div className="p-3 rounded-xl border bg-emerald-50 border-emerald-200">
                        <div className="text-[10px] font-bold text-emerald-800 uppercase">1. Created</div>
                        <div className="font-bold text-slate-800 mt-1">{ticketDetail.date || '—'}</div>
                        <div className="text-[10px] text-slate-500">{ticketDetail.time || '—'}</div>
                      </div>

                      <div className={`p-3 rounded-xl border ${
                        ['Picking', 'Billing', 'Ready', 'Dispatched'].includes(ticketDetail.current_stage)
                          ? 'bg-emerald-50 border-emerald-200'
                          : 'bg-slate-50 border-slate-200 opacity-60'
                      }`}>
                        <div className="text-[10px] font-bold text-slate-700 uppercase">2. Picking</div>
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
                        <div className="text-[10px] font-bold text-slate-700 uppercase">3. Billing</div>
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
                        <div className="text-[10px] font-bold text-slate-700 uppercase">4. Dispatch</div>
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
