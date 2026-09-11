import React, { useEffect, useState, useRef } from 'react';
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
  Calendar,
  Sun,
  Moon,
  Truck,
  Eye,
  X,
  FileCheck,
  ChevronRight,
  Layers,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  AlertTriangle
} from 'lucide-react';

export default function LEDDashboard() {
  const navigate = useNavigate();
  const { user, activeWarehouse } = useAuth();
  const { socket } = useSocket();
  const toast = useToast();

  // Primary State
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const [refreshCountdown, setRefreshCountdown] = useState(30);

  // Filters State
  const [date, setDate] = useState('ALL'); // 'ALL' loads all pending tickets across all dates
  const [selectedRouteId, setSelectedRouteId] = useState('ALL');
  const [selectedSlot, setSelectedSlot] = useState('ALL'); // 'ALL' | 'Morning' | 'Evening'
  const [showUnbilledOnly, setShowUnbilledOnly] = useState(true);
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

  // Real-time Clock
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Dashboard Data
  useEffect(() => {
    fetchDashboard();
  }, [date, selectedRouteId, selectedSlot, activeWarehouse]);

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
  }, [date, selectedRouteId, selectedSlot, activeWarehouse]);

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

  const fetchDashboard = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await axios.get('/api/led/dashboard', {
        params: {
          date: date || 'ALL',
          route_id: selectedRouteId,
          dispatch_slot: selectedSlot,
          page: 1,
          limit: 200
        }
      });
      setData(res.data);
      setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    } catch (err) {
      console.error('Error loading LED dashboard:', err);
    } finally {
      if (!silent) setLoading(false);
    }
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

  // Master Routes Fallback State
  const [masterRoutes, setMasterRoutes] = useState([]);

  useEffect(() => {
    axios.get('/api/masters/routes')
      .then(res => setMasterRoutes(res.data || []))
      .catch(() => {});
  }, [activeWarehouse]);

  // Aggregate all available routes to ensure dropdown is NEVER empty
  const routesMap = new Map();

  // 1. From API data.routes
  (data?.routes || []).forEach(r => {
    const name = String(r.route_name || r.name || '').trim();
    if (name) {
      routesMap.set(name.toLowerCase(), {
        id: r.id || name,
        route_name: name,
        route_code: r.route_code || name.substring(0, 10).toUpperCase(),
        unbilled_count: r.unbilled_count || 0
      });
    }
  });

  // 2. From Master Routes API
  masterRoutes.forEach(mr => {
    const name = String(mr.route_name || mr.name || '').trim();
    if (name && !routesMap.has(name.toLowerCase())) {
      routesMap.set(name.toLowerCase(), {
        id: mr.id || name,
        route_name: name,
        route_code: mr.route_code || name.substring(0, 10).toUpperCase(),
        unbilled_count: 0
      });
    }
  });

  // 3. From any loaded Pick Tickets
  (data?.tickets?.items || []).forEach(t => {
    const name = String(t.route_name || t.route || '').trim();
    if (name && !routesMap.has(name.toLowerCase())) {
      routesMap.set(name.toLowerCase(), {
        id: name,
        route_name: name,
        route_code: name.substring(0, 10).toUpperCase(),
        unbilled_count: !t.is_billed ? 1 : 0
      });
    }
  });

  const routesList = Array.from(routesMap.values()).sort((a, b) => a.route_name.localeCompare(b.route_name));

  const selectedRouteObj = selectedRouteId !== 'ALL' 
    ? routesList.find(r => String(r.id) === String(selectedRouteId) || String(r.route_name || '').toLowerCase() === String(selectedRouteId).toLowerCase())
    : null;

  // Extract selected route object and slot cycles
  const morningCycle = data?.morningDispatch?.cycles?.[0] || null;
  const eveningCycle = data?.eveningDispatch?.cycles?.[0] || null;

  // Determine available slots for the selected route
  const selectedMasterRoute = masterRoutes.find(mr => String(mr.id) === String(selectedRouteId) || String(mr.route_name || '').toLowerCase() === String(selectedRouteId).toLowerCase());
  
  const hasMorningConfigured = selectedRouteId === 'ALL'
    ? true
    : (data?.morningDispatch?.cycles || []).some(c => (String(c.route_id) === String(selectedRouteObj?.id) || (c.route_name && selectedRouteObj?.route_name && c.route_name.toLowerCase() === selectedRouteObj.route_name.toLowerCase())) && String(c.slot).toLowerCase() === 'morning') ||
      (selectedMasterRoute ? (selectedMasterRoute.schedules || []).some(s => (s.trip_name || '').toLowerCase().includes('morning') && s.is_active) : false);

  const hasEveningConfigured = selectedRouteId === 'ALL'
    ? true
    : (data?.eveningDispatch?.cycles || []).some(c => (String(c.route_id) === String(selectedRouteObj?.id) || (c.route_name && selectedRouteObj?.route_name && c.route_name.toLowerCase() === selectedRouteObj.route_name.toLowerCase())) && String(c.slot).toLowerCase() === 'evening') ||
      (selectedMasterRoute ? (selectedMasterRoute.schedules || []).some(s => (s.trip_name || '').toLowerCase().includes('evening') && s.is_active) : false);

  // Fallback if route has no explicit schedule configuration in DB
  const showMorningSlot = hasMorningConfigured || (!hasMorningConfigured && !hasEveningConfigured);
  const showEveningSlot = hasEveningConfigured || (!hasMorningConfigured && !hasEveningConfigured);

  // Auto adjust selected slot if current selection is not available for this route
  useEffect(() => {
    if (selectedRouteId !== 'ALL') {
      if (selectedSlot === 'Morning' && !showMorningSlot && showEveningSlot) {
        setSelectedSlot('Evening');
      } else if (selectedSlot === 'Evening' && !showEveningSlot && showMorningSlot) {
        setSelectedSlot('Morning');
      }
    }
  }, [selectedRouteId, showMorningSlot, showEveningSlot]);

  // Filter tickets list based on Search & Unbilled Toggle
  const allTickets = data?.tickets?.items || [];
  const filteredTickets = allTickets.filter((t) => {
    // Route Filter
    if (selectedRouteId !== 'ALL') {
      const targetRoute = (selectedRouteObj?.route_name || selectedRouteId).trim().toLowerCase();
      const ticketRoute = String(t.route_name || t.route || '').trim().toLowerCase();
      if (ticketRoute !== targetRoute && !ticketRoute.includes(targetRoute) && !targetRoute.includes(ticketRoute)) {
        return false;
      }
    }

    // Slot Filter
    if (selectedSlot !== 'ALL') {
      if (String(t.dispatch_slot || '').toLowerCase() !== selectedSlot.toLowerCase()) return false;
    }

    // Unbilled filter
    if (showUnbilledOnly && t.is_billed) return false;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchNo = t.pick_ticket_no?.toLowerCase().includes(term);
      const matchParty = t.party_name?.toLowerCase().includes(term) || t.party_code?.toLowerCase().includes(term);
      const matchRoute = t.route_name?.toLowerCase().includes(term);
      if (!matchNo && !matchParty && !matchRoute) return false;
    }

    return true;
  });

  // Calculate Metrics for Current View
  const unbilledTickets = allTickets.filter(t => !t.is_billed);
  const routeUnbilledTickets = selectedRouteId === 'ALL'
    ? unbilledTickets
    : unbilledTickets.filter(t => {
        const targetRoute = (selectedRouteObj?.route_name || selectedRouteId).trim().toLowerCase();
        const ticketRoute = String(t.route_name || t.route || '').trim().toLowerCase();
        return ticketRoute === targetRoute || ticketRoute.includes(targetRoute) || targetRoute.includes(ticketRoute);
      });

  const unbilledCount = routeUnbilledTickets.length;
  const morningPendingCount = routeUnbilledTickets.filter(t => String(t.dispatch_slot || '').toLowerCase() === 'morning').length;
  const eveningPendingCount = routeUnbilledTickets.filter(t => String(t.dispatch_slot || '').toLowerCase() === 'evening').length;

  const billedCount = allTickets.filter(t => t.is_billed).length;
  const totalCartons = filteredTickets.reduce((sum, t) => sum + (t.cartons || 1), 0);
  const criticalDelayedCount = filteredTickets.filter(t => t.aging_level === 'Critical' || t.aging_minutes > 60).length;

  // Pagination for table
  const totalPages = Math.ceil(filteredTickets.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedTickets = filteredTickets.slice(startIndex, startIndex + pageSize);

  return (
    <div ref={containerRef} className="space-y-3 w-full p-1 sm:p-2 min-h-screen">
      {/* ── Step 1 & 2: Route & Slot Selection Dashboard Bar (Compact) ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-sm space-y-3.5">
        {/* Compact Title & Live Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-sm sm:text-base font-extrabold text-[#003366] flex items-center gap-1.5">
              <RouteIcon className="w-4 h-4 text-[#004c8f]" />
              Dispatch Control - Live Monitor
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> ALL PENDING
            </span>
            {activeWarehouse && (
              <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase bg-blue-50 text-[#003366] border border-blue-200">
                WH: {activeWarehouse.warehouse_code || activeWarehouse.warehouse_name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs font-bold">
            {/* Clock */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-lg text-slate-700 font-mono text-[11px]">
              <Clock className="w-3 h-3 text-amber-600" />
              <span>{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
            </div>

            {/* Refresh */}
            <button
              onClick={() => fetchDashboard()}
              className="bg-[#004c8f] hover:bg-[#003a6d] text-white px-2.5 py-1 rounded-lg flex items-center gap-1 text-[11px] font-extrabold cursor-pointer transition-colors shadow-xs"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh ({refreshCountdown}s)</span>
            </button>

            {/* Full Screen */}
            <button
              onClick={toggleFullScreen}
              className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
            >
              {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Step 1: Route Selector */}
          <div className="lg:col-span-4 space-y-1.5">
            <label className="text-xs font-extrabold text-[#003366] uppercase tracking-wider flex items-center gap-1.5">
              <RouteIcon className="w-4 h-4 text-[#004c8f]" /> Step 1: Select Route
            </label>
            <div className="relative">
              <select
                value={selectedRouteId}
                onChange={(e) => {
                  setSelectedRouteId(e.target.value);
                  setSelectedSlot('ALL');
                  setCurrentPage(1);
                }}
                className="w-full bg-blue-50/50 border-2 border-blue-200 hover:border-[#004c8f] rounded-xl p-2.5 text-xs sm:text-sm font-extrabold text-[#003366] focus:border-[#004c8f] focus:bg-white focus:outline-none cursor-pointer transition-all shadow-xs"
              >
                <option value="ALL">🌟 All Routes ({routesList.length} Routes)</option>
                {routesList.map((r) => {
                  const rUnbilled = allTickets.filter(t => !t.is_billed && String(t.route_name || t.route || '').trim().toLowerCase() === String(r.route_name || '').trim().toLowerCase()).length;
                  return (
                    <option key={r.id || r.route_name} value={String(r.route_name || r.id)}>
                      {r.route_name} {rUnbilled > 0 ? `(⏳ ${rUnbilled} Pending)` : '(✓ 0 Pending)'}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Step 2: Slot Selection Buttons (Dynamic based on route config) */}
          <div className="lg:col-span-8 space-y-1.5">
            <label className="text-xs font-extrabold text-[#003366] uppercase tracking-wider flex items-center gap-1.5">
              <Sun className="w-4 h-4 text-amber-500" /> Step 2: Select Dispatch Slot
              {selectedRouteObj && (
                <span className="text-[10px] text-slate-400 font-normal lowercase">
                  ({showMorningSlot && showEveningSlot ? 'morning & evening configured' : (showEveningSlot ? 'evening only' : 'morning only')})
                </span>
              )}
            </label>
            <div className={`grid grid-cols-1 ${showMorningSlot && showEveningSlot ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-2.5`}>
              {/* All Shifts Button */}
              <button
                type="button"
                onClick={() => { setSelectedSlot('ALL'); setCurrentPage(1); }}
                className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center justify-between gap-2 border transition-all cursor-pointer ${
                  selectedSlot === 'ALL'
                    ? 'bg-[#003366] text-white border-[#003366] shadow-sm ring-2 ring-blue-300'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" /> All Slots
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  selectedSlot === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
                }`}>
                  {unbilledCount} Pending
                </span>
              </button>

              {/* Morning Slot (Only shown if configured for route) */}
              {showMorningSlot && (
                <button
                  type="button"
                  onClick={() => { setSelectedSlot('Morning'); setCurrentPage(1); }}
                  className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center justify-between gap-2 border transition-all cursor-pointer ${
                    selectedSlot === 'Morning'
                      ? 'bg-amber-500 text-white border-amber-500 shadow-sm ring-2 ring-amber-300'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-amber-50/50'
                  }`}
                >
                  <div className="flex flex-col text-left min-w-0">
                    <span className="flex items-center gap-1.5 truncate">
                      <Sun className="w-3.5 h-3.5 text-amber-200 shrink-0" /> Morning Slot
                    </span>
                    <span className="text-[10px] font-normal opacity-90 truncate">
                      {morningCycle ? `Cut: ${morningCycle.cutoff_time_formatted} | Disp: ${morningCycle.dispatch_time_formatted}` : '08:00 AM - 10:00 AM'}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                    selectedSlot === 'Morning' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {morningPendingCount} Pending
                  </span>
                </button>
              )}

              {/* Evening Slot (Only shown if configured for route) */}
              {showEveningSlot && (
                <button
                  type="button"
                  onClick={() => { setSelectedSlot('Evening'); setCurrentPage(1); }}
                  className={`px-3 py-2 rounded-xl text-xs font-extrabold flex items-center justify-between gap-2 border transition-all cursor-pointer ${
                    selectedSlot === 'Evening'
                      ? 'bg-indigo-700 text-white border-indigo-700 shadow-sm ring-2 ring-indigo-300'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50/50'
                  }`}
                >
                  <div className="flex flex-col text-left min-w-0">
                    <span className="flex items-center gap-1.5 truncate">
                      <Moon className="w-3.5 h-3.5 text-indigo-200 shrink-0" /> Evening Slot
                    </span>
                    <span className="text-[10px] font-normal opacity-90 truncate">
                      {eveningCycle ? `Cut: ${eveningCycle.cutoff_time_formatted} | Disp: ${eveningCycle.dispatch_time_formatted}` : '04:00 PM - 06:00 PM'}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                    selectedSlot === 'Evening' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-800'
                  }`}>
                    {eveningPendingCount} Pending
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Summary KPI Pills for Selected Route & Slot ─────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          <div className="bg-red-50/70 border border-red-200 p-3 rounded-xl flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0 font-black">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xl font-black text-red-700 leading-none">{unbilledCount}</div>
              <div className="text-[11px] font-bold text-red-900/80 mt-0.5">Unbilled Pick Tickets</div>
            </div>
          </div>

          <div className="bg-blue-50/70 border border-blue-200 p-3 rounded-xl flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-black">
              <PackageCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xl font-black text-blue-700 leading-none">{totalCartons}</div>
              <div className="text-[11px] font-bold text-blue-900/80 mt-0.5">Total Cartons / Qty</div>
            </div>
          </div>

          <div className="bg-amber-50/70 border border-amber-200 p-3 rounded-xl flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 font-black">
              <AlertOctagon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xl font-black text-amber-700 leading-none">{criticalDelayedCount}</div>
              <div className="text-[11px] font-bold text-amber-900/80 mt-0.5">Delayed (&gt;60m Waiting)</div>
            </div>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200 p-3 rounded-xl flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-black">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xl font-black text-emerald-700 leading-none">{billedCount}</div>
              <div className="text-[11px] font-bold text-emerald-900/80 mt-0.5">Billed & Ready</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Step 3: Tabular View of Pending Pick Tickets (Unbilled) ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden space-y-3">
        {/* Table Action Bar */}
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-extrabold text-[#003366] flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-[#ed1c24]" />
              {showUnbilledOnly ? 'Pending Pick Tickets (Awaiting Billing)' : 'All Pick Tickets'}
              <span className="px-2 py-0.5 rounded-full text-xs font-black bg-[#003366] text-white ml-1">
                {filteredTickets.length}
              </span>
            </h3>
            {selectedRouteObj && (
              <span className="px-2 py-0.5 bg-blue-100 text-[#004c8f] border border-blue-200 rounded-lg text-xs font-extrabold">
                Route: {selectedRouteObj.route_name}
              </span>
            )}
          </div>

          {/* Controls: Search & Unbilled Toggle */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search ticket, party..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="w-full bg-white border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:border-[#004c8f] focus:outline-none"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Toggle: Unbilled Only vs All */}
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 px-3 py-1.5 rounded-xl cursor-pointer hover:bg-slate-100 shrink-0 select-none">
              <input
                type="checkbox"
                checked={showUnbilledOnly}
                onChange={(e) => { setShowUnbilledOnly(e.target.checked); setCurrentPage(1); }}
                className="w-4 h-4 text-[#004c8f] rounded focus:ring-0 cursor-pointer"
              />
              <span>Unbilled Only</span>
            </label>
          </div>
        </div>

        {/* Dense Responsive Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#003366] text-white border-b-2 border-[#ed1c24] font-bold uppercase tracking-wider text-[11px]">
                <th className="px-3 py-3 whitespace-nowrap">#</th>
                <th className="px-3 py-3 whitespace-nowrap">Pick Ticket No</th>
                <th className="px-3 py-3 whitespace-nowrap">Party Name & Code</th>
                <th className="px-2 py-3 text-center whitespace-nowrap">Qty / Cartons</th>
                <th className="px-3 py-3 whitespace-nowrap">Route</th>
                <th className="px-3 py-3 whitespace-nowrap">Slot / Time</th>
                <th className="px-3 py-3 whitespace-nowrap">Assigned Picker</th>
                <th className="px-3 py-3 text-center whitespace-nowrap">Pending Time (Aging)</th>
                <th className="px-3 py-3 text-center whitespace-nowrap">Status</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-400 font-bold">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#004c8f]" />
                    Loading pending pick tickets...
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-400">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                    <div className="text-sm font-extrabold text-slate-700">No Pending Tickets Found!</div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {showUnbilledOnly
                        ? 'All pick tickets for this route and slot have been billed and processed.'
                        : 'No pick tickets match the selected filters.'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedTickets.map((t, idx) => {
                  const isCritical = t.aging_minutes >= 60;
                  const isWarning = t.aging_minutes >= 30 && t.aging_minutes < 60;

                  return (
                    <tr key={t.id} className="hover:bg-blue-50/50 transition-colors">
                      {/* # Index */}
                      <td className="px-3 py-2.5 text-slate-400 font-mono font-medium whitespace-nowrap">
                        {startIndex + idx + 1}
                      </td>

                      {/* Ticket No */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openTicketModal(t.id)}
                          className="font-mono font-black text-[#004c8f] hover:underline cursor-pointer bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg border border-blue-200 transition-colors"
                        >
                          {t.pick_ticket_no}
                        </button>
                      </td>

                      {/* Party */}
                      <td className="px-3 py-2.5">
                        <div className="font-extrabold text-slate-900 line-clamp-1 max-w-[200px]" title={t.party_name}>
                          {t.party_name}
                        </div>
                        <span className="text-[10px] font-mono font-bold text-slate-500">{t.party_code}</span>
                      </td>

                      {/* Qty */}
                      <td className="px-2 py-2.5 text-center whitespace-nowrap font-black text-[#003366] text-sm">
                        {t.cartons}
                      </td>

                      {/* Route */}
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-700 font-bold">
                        {t.route_name}
                      </td>

                      {/* Slot / Time */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                          t.dispatch_slot === 'Evening' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {t.dispatch_slot}
                        </span>
                        <span className="text-slate-400 font-mono text-[10px] ml-1.5">{t.time || '09:00'}</span>
                      </td>

                      {/* Picker / Salesman */}
                      <td className="px-3 py-2.5 whitespace-nowrap font-medium text-slate-700">
                        {t.picker_name || t.salesman || '—'}
                      </td>

                      {/* Aging / Pending Time */}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <div className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black border ${
                          isCritical
                            ? 'bg-red-100 text-red-700 border-red-300 animate-pulse'
                            : isWarning
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          <Clock className="w-3 h-3" />
                          <span>Pending {t.aging_formatted || `${t.aging_minutes}m`}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        {t.is_billed ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Billed ({t.bill_no || 'Ready'})
                          </span>
                        ) : t.current_stage === 'Picking' ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                            <PackageCheck className="w-3 h-3 text-amber-600" /> Picking In Progress
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-red-50 text-red-600 border border-red-200 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3 text-red-600" /> Pending Billing
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {!t.is_billed ? (
                            <button
                              type="button"
                              onClick={() => navigate('/billing')}
                              className="px-2.5 py-1 rounded-lg bg-[#004c8f] hover:bg-[#003a6d] text-white text-[11px] font-extrabold shadow-xs transition-colors cursor-pointer flex items-center gap-1"
                              title="Go to Billing to create invoice"
                            >
                              <Receipt className="w-3 h-3" /> Bill Now
                            </button>
                          ) : (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold border border-slate-200">
                              {t.bill_no || 'Billed'}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => openTicketModal(t.id)}
                            className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer"
                            title="View Timeline & Details"
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
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-semibold">
              Showing <strong className="text-slate-800">{startIndex + 1}</strong> to <strong className="text-slate-800">{Math.min(startIndex + pageSize, filteredTickets.length)}</strong> of <strong className="text-slate-800">{filteredTickets.length}</strong> tickets
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer"
              >
                Previous
              </button>
              <span className="font-extrabold text-[#003366] px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer"
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
          <div className="bg-white rounded-3xl w-full max-w-2xl border border-slate-200 shadow-2xl overflow-hidden space-y-4 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-[#003366] border-b-4 border-[#ed1c24] text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-mono font-black text-white">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-white font-mono">
                    Pick Ticket {ticketDetail?.pick_ticket_no || 'Details'}
                  </h3>
                  <p className="text-xs text-blue-200 font-medium">Lifecycle tracking & operational stage progression</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedTicketId(null); setTicketDetail(null); }}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
              {ticketModalLoading ? (
                <div className="text-center py-12 text-slate-400 font-bold">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#004c8f]" />
                  Loading ticket lifecycle details...
                </div>
              ) : ticketDetail ? (
                <>
                  {/* Context Info Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Party Name</span>
                      <div className="font-extrabold text-slate-900 mt-0.5">{ticketDetail.party_name}</div>
                      <span className="font-mono text-slate-500 font-bold">{ticketDetail.party_code}</span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Route & Shift</span>
                      <div className="font-extrabold text-[#004c8f] mt-0.5">{ticketDetail.route}</div>
                      <span className="text-slate-600">{ticketDetail.dispatch_slot || 'Morning'}</span>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Quantity</span>
                      <div className="text-base font-black text-[#003366] mt-0.5">{ticketDetail.qty_in_pick_ticket} Cartons</div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Picker</span>
                      <div className="font-bold text-slate-800 mt-0.5">{ticketDetail.picker_name || 'Unassigned'}</div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Salesman</span>
                      <div className="font-bold text-slate-800 mt-0.5">{ticketDetail.salesman || '—'}</div>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Aging / Pending</span>
                      <div className="font-black text-red-600 mt-0.5">{ticketDetail.aging?.agingFormatted || 'Normal'}</div>
                    </div>
                  </div>

                  {/* Stage Progression Timeline */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-extrabold uppercase text-[#003366] tracking-wider">Operational Timeline</h4>
                    <div className="relative pl-6 space-y-4 border-l-2 border-blue-200 ml-3">
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
                            <span className={`font-extrabold text-xs ${
                              step.state === 'completed' ? 'text-emerald-700' : step.state === 'current' ? 'text-amber-700' : 'text-slate-400'
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
                    <div className="bg-emerald-50/60 border border-emerald-200 p-4 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-emerald-800">Invoice Bill Generated</span>
                        <span className="font-mono font-black text-emerald-700">{ticketDetail.billing.bill_no}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700 text-[11px]">
                        <span>Invoice Amount: ₹{ticketDetail.billing.invoice_amount?.toLocaleString() || 0}</span>
                        <span>Billed Qty: {ticketDetail.billing.billed_qty}</span>
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => { setSelectedTicketId(null); setTicketDetail(null); }}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Close
              </button>
              {ticketDetail && !ticketDetail.billing && (
                <button
                  type="button"
                  onClick={() => { setSelectedTicketId(null); navigate('/billing'); }}
                  className="px-5 py-2 rounded-xl bg-[#004c8f] hover:bg-[#003a6d] text-white font-extrabold text-xs shadow-md cursor-pointer flex items-center gap-1.5"
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
