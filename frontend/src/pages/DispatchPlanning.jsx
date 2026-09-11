import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import {
  Truck,
  UserCheck,
  CheckCircle2,
  Plus,
  Search,
  Route as RouteIcon,
  Package,
  Layers,
  Receipt,
  RotateCcw,
  CheckSquare,
  Square,
  Clock,
  AlertTriangle,
  AlertCircle,
  PlayCircle,
  Calendar,
  ArrowRight,
  Activity,
  Filter,
  RefreshCw,
  ChevronRight,
  Zap,
  Check,
  ShieldAlert,
  Flame,
  TrendingUp,
  SlidersHorizontal,
  X
} from 'lucide-react';

export default function DispatchPlanning() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('console'); // 'console' | 'builder'

  // Operations Console State
  const [consoleData, setConsoleData] = useState({
    operationalDate: '',
    dayOfWeek: '',
    currentTime: '',
    timezone: 'Asia/Kolkata (+05:30)',
    kpis: {
      totalDispatches: 0,
      upcoming: 0,
      completed: 0,
      atRisk: 0,
      delayed: 0,
      totalPendingTickets: 0,
      billingPending: 0,
      packingPending: 0,
      criticalRoutes: 0
    },
    nextDispatch: null,
    criticalAlerts: [],
    todayTimeline: [],
    routeMatrix: [],
    onDemandQueue: []
  });
  const [consoleLoading, setConsoleLoading] = useState(true);
  const [matrixFilter, setMatrixFilter] = useState('ALL'); // 'ALL' | 'CRITICAL' | 'SCHEDULED' | 'ON_DEMAND'
  const [matrixSearch, setMatrixSearch] = useState('');
  const [liveTick, setLiveTick] = useState(0);

  // On-Demand Modal State
  const [onDemandModal, setOnDemandModal] = useState(null);
  const [onDemandTripName, setOnDemandTripName] = useState('Express On-Demand Run');
  const [onDemandNotes, setOnDemandNotes] = useState('');
  const [creatingOnDemand, setCreatingOnDemand] = useState(false);

  // Trip Dispatch Builder State
  const [data, setData] = useState({ routes: [], drivers: [], vehicles: [], pendingBillings: [] });
  const [selectedBills, setSelectedBills] = useState([]);
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [routeFilter, setRouteFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Fetch initial data
  useEffect(() => {
    fetchConsoleData();
    fetchPlanningData();

    // Auto-refresh console every 20 seconds
    const interval = setInterval(() => {
      fetchConsoleData(false);
    }, 20000);

    // Live clock & ticking timer every 1s
    const clockInterval = setInterval(() => {
      setLiveTick((t) => t + 1);
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(clockInterval);
    };
  }, []);

  const fetchConsoleData = async (showSpinner = true) => {
    if (showSpinner) setConsoleLoading(true);
    try {
      const res = await axios.get('/api/dispatch-planning/console-data');
      if (res.data) {
        setConsoleData(res.data);
      }
    } catch (err) {
      console.error('Error loading operations console:', err);
    } finally {
      if (showSpinner) setConsoleLoading(false);
    }
  };

  const fetchPlanningData = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/dispatch-planning/data');
      setData(res.data);
      if (res.data.drivers?.length > 0 && !driverId) setDriverId(res.data.drivers[0].id.toString());
      if (res.data.vehicles?.length > 0 && !vehicleId) setVehicleId(res.data.vehicles[0].id.toString());
    } catch (err) {
      console.error('Error loading planning data:', err);
      toast.error('Failed to load dispatch planning data.');
    } finally {
      setLoading(false);
    }
  };

  // Quick Plan Trip Handler -> Switches to Builder tab with route pre-selected
  const handleQuickPlanTrip = (routeName) => {
    setRouteFilter(routeName || '');
    setActiveTab('builder');
    toast.info(`Filtered invoices for route: ${routeName}`);
  };

  // Handle On-Demand creation
  const handleTriggerOnDemand = async (e) => {
    e.preventDefault();
    if (!onDemandModal) return;
    setCreatingOnDemand(true);
    try {
      const res = await axios.post('/api/dispatch-planning/create-on-demand', {
        route_id: onDemandModal.id,
        trip_name: onDemandTripName,
        notes: onDemandNotes
      });
      toast.success(res.data.message || 'On-Demand Dispatch triggered successfully!');
      setOnDemandModal(null);
      setOnDemandNotes('');
      fetchConsoleData();
      fetchPlanningData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error triggering on-demand dispatch.');
    } finally {
      setCreatingOnDemand(false);
    }
  };

  // Builder Invoices Filtering
  const filteredInvoices = useMemo(() => {
    return (data.pendingBillings || []).filter((b) => {
      const q = (searchQuery || '').trim().toLowerCase();
      const matchesSearch =
        !q ||
        (b.bill_no && String(b.bill_no).toLowerCase().includes(q)) ||
        (b.party_name && String(b.party_name).toLowerCase().includes(q)) ||
        (b.party_code && String(b.party_code).toLowerCase().includes(q)) ||
        (b.route_name && String(b.route_name).toLowerCase().includes(q)) ||
        (b.ticket_no && String(b.ticket_no).toLowerCase().includes(q)) ||
        (b.customer_order_no && String(b.customer_order_no).toLowerCase().includes(q));

      const matchesRoute =
        !routeFilter ||
        (b.route_name && b.route_name.toLowerCase() === routeFilter.toLowerCase());

      return matchesSearch && matchesRoute;
    });
  }, [data.pendingBillings, searchQuery, routeFilter]);

  const toggleBillSelect = (id) => {
    if (selectedBills.includes(id)) {
      setSelectedBills(selectedBills.filter((b) => b !== id));
    } else {
      setSelectedBills([...selectedBills, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedBills.length === filteredInvoices.length && filteredInvoices.length > 0) {
      setSelectedBills([]);
    } else {
      setSelectedBills(filteredInvoices.map((b) => b.id));
    }
  };

  // Builder Live Summary
  const selectedSummary = useMemo(() => {
    const selectedObjects = (data.pendingBillings || []).filter((b) => selectedBills.includes(b.id));
    const count = selectedObjects.length;
    const cartons = selectedObjects.reduce((acc, b) => acc + (Number(b.total_cartons) || 1), 0);
    const units = selectedObjects.reduce((acc, b) => acc + (Number(b.billed_qty) || Number(b.qty_in_pick_ticket) || 0), 0);
    const amount = selectedObjects.reduce((acc, b) => acc + (Number(b.invoice_amount) || 0), 0);
    return { count, cartons, units, amount };
  }, [data.pendingBillings, selectedBills]);

  const handleCreateTrip = async (e) => {
    e.preventDefault();
    if (selectedBills.length === 0) {
      toast.warning('Please select at least one pending invoice bill for dispatch!');
      return;
    }
    setSubmitting(true);
    try {
      const res = await axios.post('/api/dispatch-planning/create-trip', {
        driver_id: driverId,
        vehicle_id: vehicleId,
        billing_ids: selectedBills,
        notes
      });
      toast.success(res.data.message || 'Dispatch trip created successfully!');
      setSelectedBills([]);
      setNotes('');
      fetchPlanningData();
      fetchConsoleData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error creating dispatch trip.');
    } finally {
      setSubmitting(false);
    }
  };

  const uniqueRoutes = useMemo(() => {
    const routes = new Set();
    (data.pendingBillings || []).forEach((b) => {
      if (b.route_name) routes.add(b.route_name);
    });
    return Array.from(routes);
  }, [data.pendingBillings]);

  // Matrix Filtered List
  const filteredMatrix = useMemo(() => {
    return (consoleData.routeMatrix || []).filter((item) => {
      const matchesSearch =
        !matrixSearch ||
        (item.routeName && item.routeName.toLowerCase().includes(matrixSearch.toLowerCase())) ||
        (item.routeCode && item.routeCode.toLowerCase().includes(matrixSearch.toLowerCase())) ||
        (item.tripName && item.tripName.toLowerCase().includes(matrixSearch.toLowerCase()));

      if (!matchesSearch) return false;

      if (matrixFilter === 'CRITICAL') return item.priority?.score >= 3;
      if (matrixFilter === 'SCHEDULED') return item.dispatchType !== 'ON_DEMAND';
      if (matrixFilter === 'ON_DEMAND') return item.dispatchType === 'ON_DEMAND';

      return true;
    });
  }, [consoleData.routeMatrix, matrixSearch, matrixFilter]);

  // Helper Priority Pill
  const renderPriorityBadge = (p) => {
    if (!p) return null;
    const styles = {
      RED: 'bg-red-600 text-white shadow-xs',
      ORANGE: 'bg-amber-500 text-slate-900 shadow-xs font-black',
      YELLOW: 'bg-amber-100 text-amber-900 border border-amber-300',
      BLUE: 'bg-blue-100 text-blue-800 border border-blue-200',
      GREEN: 'bg-emerald-100 text-emerald-800 border border-emerald-200'
    };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase tracking-wide ${styles[p.level] || styles.BLUE}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${p.level === 'RED' ? 'bg-white animate-ping' : p.level === 'ORANGE' ? 'bg-slate-900' : 'bg-current'}`}></span>
        {p.badge || p.level}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header with Tab Switcher & Real-time IST Clock ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#003366] flex items-center justify-center text-white shadow-md">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Route Scheduling &amp; Dispatch Console
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                LIVE IST (+05:30)
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Automated Route Master timing calculations, live cutoff alerts, workload aging &amp; vehicle trip dispatching.
            </p>
          </div>
        </div>

        {/* Tab Navigation & Refresh Button */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
            <button
              onClick={() => setActiveTab('console')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === 'console'
                  ? 'bg-[#003366] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Operations Command Center</span>
              {consoleData.kpis?.criticalRoutes > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-mono px-1.5 py-0.2 rounded-full">
                  {consoleData.kpis.criticalRoutes}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('builder')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === 'builder'
                  ? 'bg-[#003366] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Trip Dispatch Builder</span>
              {(data.pendingBillings || []).length > 0 && (
                <span className="bg-blue-100 text-[#004c8f] text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {data.pendingBillings.length}
                </span>
              )}
            </button>
          </div>

          <button
            onClick={() => {
              fetchConsoleData();
              fetchPlanningData();
              toast.success('Operations data refreshed!');
            }}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold transition-all cursor-pointer"
            title="Refresh Real-time Console Data"
          >
            <RefreshCw className={`w-4 h-4 ${consoleLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          TAB 1: OPERATIONS COMMAND CENTER (DYNAMIC ROUTE SCHEDULING)
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'console' && (
        <div className="space-y-6">
          {/* ── Top Operational KPI Metric Ribbon ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-3">
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Total Dispatches</div>
              <div className="text-xl font-black text-slate-900 mt-1">{consoleData.kpis?.totalDispatches || 0}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Scheduled for today</div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-blue-200 shadow-2xs">
              <div className="text-[11px] font-extrabold text-blue-700 uppercase tracking-wider">Upcoming</div>
              <div className="text-xl font-black text-blue-900 mt-1">{consoleData.kpis?.upcoming || 0}</div>
              <div className="text-[10px] text-blue-500 mt-0.5">Departing later today</div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-2xs">
              <div className="text-[11px] font-extrabold text-emerald-700 uppercase tracking-wider">Completed</div>
              <div className="text-xl font-black text-emerald-900 mt-1">{consoleData.kpis?.completed || 0}</div>
              <div className="text-[10px] text-emerald-500 mt-0.5">Manifests dispatched</div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-amber-200 shadow-2xs">
              <div className="text-[11px] font-extrabold text-amber-700 uppercase tracking-wider">At Risk (&lt;30m)</div>
              <div className="text-xl font-black text-amber-900 mt-1">{consoleData.kpis?.atRisk || 0}</div>
              <div className="text-[10px] text-amber-600 mt-0.5">Approaching cut-off</div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-red-200 shadow-2xs">
              <div className="text-[11px] font-extrabold text-red-600 uppercase tracking-wider">Delayed / Overdue</div>
              <div className="text-xl font-black text-red-700 mt-1">{consoleData.kpis?.delayed || 0}</div>
              <div className="text-[10px] text-red-500 mt-0.5">Immediate action req.</div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Pending PTs</div>
              <div className="text-xl font-black text-purple-700 mt-1">{consoleData.kpis?.totalPendingTickets || 0}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Total pick tickets</div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Billing Pend.</div>
              <div className="text-xl font-black text-amber-600 mt-1">{consoleData.kpis?.billingPending || 0}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Need invoice generation</div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Packing Pend.</div>
              <div className="text-xl font-black text-cyan-600 mt-1">{consoleData.kpis?.packingPending || 0}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Under packing</div>
            </div>

            <div className="bg-white p-3.5 rounded-2xl border border-rose-300 bg-rose-50/50 shadow-2xs">
              <div className="text-[11px] font-extrabold text-rose-700 uppercase tracking-wider">Critical Routes</div>
              <div className="text-xl font-black text-rose-800 mt-1">{consoleData.kpis?.criticalRoutes || 0}</div>
              <div className="text-[10px] text-rose-500 mt-0.5">High urgency routes</div>
            </div>
          </div>

          {/* ── SPOTLIGHT HERO: NEXT UPCOMING DISPATCH ── */}
          {consoleData.nextDispatch ? (
            <div className="relative overflow-hidden bg-gradient-to-br from-[#002244] via-[#003366] to-[#004c8f] text-white rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-blue-400/30">
              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-400 text-slate-950 uppercase tracking-wider shadow">
                      <Flame className="w-3.5 h-3.5 fill-current" />
                      NEXT UPCOMING DISPATCH
                    </span>
                    <span className="font-mono text-xs font-bold bg-white/10 px-2.5 py-1 rounded-lg border border-white/20 text-blue-200">
                      Route Code: {consoleData.nextDispatch.routeCode}
                    </span>
                    {renderPriorityBadge(consoleData.nextDispatch.priority)}
                  </div>

                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                      <span>{consoleData.nextDispatch.routeName}</span>
                      <span className="text-blue-300 text-lg font-bold">({consoleData.nextDispatch.tripName})</span>
                    </h2>
                    <p className="text-xs text-blue-100/80 mt-1">
                      Target departure is fixed on Route Master. Workload is monitored in real-time.
                    </p>
                  </div>

                  {/* Cutoff & Dispatch Live Countdowns */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="bg-slate-900/60 backdrop-blur-md p-3.5 rounded-2xl border border-white/15">
                      <div className="text-[11px] font-extrabold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Cut-Off Deadline ({consoleData.nextDispatch.timing.cutoffTimeFormatted})
                      </div>
                      <div className="text-lg font-mono font-black text-white mt-1">
                        {consoleData.nextDispatch.timing.cutoffCountdown}
                      </div>
                      <div className="text-[11px] text-slate-300 mt-0.5">
                        {consoleData.nextDispatch.timing.isCutoffMissed
                          ? '⚠️ Cut-off has elapsed. Remaining orders may miss this trip.'
                          : 'Orders placed before cut-off will be fulfilled for this dispatch.'}
                      </div>
                    </div>

                    <div className="bg-slate-900/60 backdrop-blur-md p-3.5 rounded-2xl border border-white/15">
                      <div className="text-[11px] font-extrabold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5" />
                        Vehicle Dispatch Time ({consoleData.nextDispatch.timing.dispatchTimeFormatted})
                      </div>
                      <div className="text-lg font-mono font-black text-white mt-1">
                        {consoleData.nextDispatch.timing.dispatchCountdown}
                      </div>
                      <div className="text-[11px] text-slate-300 mt-0.5">
                        {consoleData.nextDispatch.timing.isDispatchOverdue
                          ? '🚨 Overdue departure. Prepare vehicle loading immediately.'
                          : 'Dock loading scheduled at cutoff completion.'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Workload Progress & Quick Action Button */}
                <div className="lg:w-80 bg-slate-900/70 backdrop-blur-md p-5 rounded-2xl border border-white/20 space-y-4 shrink-0">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-blue-200">Trip Workload</span>
                    <span className="text-xs font-mono font-bold text-amber-300">
                      {consoleData.nextDispatch.workload?.pendingTicketsCount || 0} Pending Items
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white/5 p-2 rounded-lg border border-white/10">
                      <span className="text-[10px] text-slate-300 block">Billing Pending</span>
                      <strong className="text-base text-amber-400 font-mono">
                        {consoleData.nextDispatch.workload?.billingPendingCount || 0}
                      </strong>
                    </div>
                    <div className="bg-white/5 p-2 rounded-lg border border-white/10">
                      <span className="text-[10px] text-slate-300 block">Packed &amp; Ready</span>
                      <strong className="text-base text-emerald-400 font-mono">
                        {consoleData.nextDispatch.workload?.readyCount || 0}
                      </strong>
                    </div>
                  </div>

                  {consoleData.nextDispatch.workload?.oldestPendingMinutes > 0 && (
                    <div className="text-[11px] font-mono text-amber-200 bg-amber-950/40 p-2 rounded-lg border border-amber-500/30 flex items-center justify-between">
                      <span>Oldest In-Queue:</span>
                      <strong>{consoleData.nextDispatch.workload.oldestPendingFormatted}</strong>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleQuickPlanTrip(consoleData.nextDispatch.routeName)}
                    className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Zap className="w-4 h-4 fill-current" />
                    <span>Quick Plan This Dispatch</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 bg-white rounded-3xl border border-slate-200 shadow-sm text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <h3 className="text-base font-extrabold text-slate-800">All Scheduled Dispatches for Today Are Cleared</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No immediate upcoming departure found. Check the Route Matrix below or create an On-Demand dispatch.
              </p>
            </div>
          )}

          {/* ── CHRONOLOGICAL TODAY TIMELINE ── */}
          {consoleData.todayTimeline?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#003366]" />
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                    Today's Chronological Dispatch Schedule ({consoleData.dayOfWeek})
                  </h3>
                </div>
                <span className="text-xs font-mono text-slate-500">
                  Total Dispatches Today: {consoleData.todayTimeline.length}
                </span>
              </div>

              <div className="flex items-stretch gap-3 overflow-x-auto pb-2">
                {consoleData.todayTimeline.map((trip, idx) => {
                  const isNext = consoleData.nextDispatch?.scheduleId === trip.scheduleId;
                  return (
                    <div
                      key={trip.scheduleId || idx}
                      className={`min-w-[240px] max-w-[280px] p-4 rounded-2xl border transition-all flex flex-col justify-between shrink-0 ${
                        isNext
                          ? 'bg-blue-50/80 border-[#004c8f] shadow-md ring-2 ring-blue-400/40'
                          : 'bg-slate-50/70 border-slate-200 hover:border-slate-300 shadow-2xs'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                            Trip #{idx + 1}
                          </span>
                          {renderPriorityBadge(trip.priority)}
                        </div>

                        <div>
                          <div className="text-sm font-extrabold text-slate-900 leading-tight">
                            {trip.routeName}
                          </div>
                          <div className="text-xs font-semibold text-slate-500 mt-0.5">
                            {trip.tripName}
                          </div>
                        </div>

                        <div className="text-xs font-mono space-y-1 pt-1 border-t border-slate-200">
                          <div className="flex justify-between text-slate-600">
                            <span>Cutoff:</span>
                            <strong className="text-amber-700">{trip.timing.cutoffTimeFormatted}</strong>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>Dispatch:</span>
                            <strong className="text-blue-700">{trip.timing.dispatchTimeFormatted}</strong>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>Pending PTs:</span>
                            <strong className="text-purple-700 font-bold">{trip.workload?.pendingTicketsCount || 0}</strong>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleQuickPlanTrip(trip.routeName)}
                        className="mt-3 w-full py-1.5 rounded-lg bg-white hover:bg-blue-50 border border-slate-300 text-[#004c8f] text-xs font-bold cursor-pointer transition-colors flex items-center justify-center gap-1"
                      >
                        <span>Plan Trip</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── ROUTE-WISE DISPATCH MATRIX TABLE ── */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden space-y-0">
            <div className="bg-[#003366] border-b-4 border-[#ed1c24] px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <RouteIcon className="w-4 h-4 text-emerald-400" />
                  Route Dispatch Operations Matrix
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Real-time status calculated automatically from Route Master configuration.
                </p>
              </div>

              {/* Filter Tabs & Search */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="bg-white/10 p-1 rounded-xl flex items-center gap-1">
                  {[
                    { id: 'ALL', label: `All (${consoleData.routeMatrix?.length || 0})` },
                    { id: 'CRITICAL', label: `🚨 Urgent (${(consoleData.routeMatrix || []).filter(m => m.priority?.score >= 3).length})` },
                    { id: 'SCHEDULED', label: `📅 Scheduled (${(consoleData.routeMatrix || []).filter(m => m.dispatchType !== 'ON_DEMAND').length})` },
                    { id: 'ON_DEMAND', label: `⚡ On-Demand (${(consoleData.routeMatrix || []).filter(m => m.dispatchType === 'ON_DEMAND').length})` }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setMatrixFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                        matrixFilter === tab.id
                          ? 'bg-white text-[#003366] shadow'
                          : 'text-slate-300 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={matrixSearch}
                    onChange={(e) => setMatrixSearch(e.target.value)}
                    placeholder="Filter routes..."
                    className="bg-white/10 border border-white/20 text-white placeholder:text-slate-400 text-xs rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:bg-white focus:text-slate-900 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3.5 text-left text-xs font-extrabold text-slate-700 uppercase tracking-wider">Route &amp; Code</th>
                    <th className="px-4 py-3.5 text-left text-xs font-extrabold text-slate-700 uppercase tracking-wider">Trip &amp; Frequency</th>
                    <th className="px-4 py-3.5 text-left text-xs font-extrabold text-slate-700 uppercase tracking-wider">Cutoff Timing &amp; Status</th>
                    <th className="px-4 py-3.5 text-left text-xs font-extrabold text-slate-700 uppercase tracking-wider">Dispatch Timing &amp; Status</th>
                    <th className="px-4 py-3.5 text-center text-xs font-extrabold text-slate-700 uppercase tracking-wider">Pending PTs</th>
                    <th className="px-4 py-3.5 text-center text-xs font-extrabold text-slate-700 uppercase tracking-wider">Billing / Packing</th>
                    <th className="px-4 py-3.5 text-center text-xs font-extrabold text-slate-700 uppercase tracking-wider">Oldest Age</th>
                    <th className="px-4 py-3.5 text-center text-xs font-extrabold text-slate-700 uppercase tracking-wider">Priority</th>
                    <th className="px-4 py-3.5 text-right text-xs font-extrabold text-slate-700 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {consoleLoading ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-400 text-xs font-bold">
                        Recalculating real-time dispatch matrix...
                      </td>
                    </tr>
                  ) : filteredMatrix.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12 text-slate-400 text-xs font-bold">
                        No routes found matching current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredMatrix.map((item, i) => {
                      return (
                        <tr key={item.scheduleId || i} className="hover:bg-blue-50/40 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-extrabold text-slate-900 text-xs">{item.routeName}</div>
                            <span className="font-mono text-[11px] text-slate-500">{item.routeCode}</span>
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-bold text-slate-800 text-xs block">{item.tripName}</span>
                            <span className="text-[10px] font-extrabold text-indigo-700 uppercase">{item.frequency}</span>
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
                            {item.timing.isOnDemand ? (
                              <span className="text-slate-400 italic">No Cut-off (On-Demand)</span>
                            ) : (
                              <div>
                                <span className="font-bold text-slate-800">{item.timing.cutoffTimeFormatted}</span>
                                <div className="text-[11px] font-semibold mt-0.5">
                                  <span className={item.timing.isCutoffMissed ? 'text-red-600 font-bold' : 'text-amber-700'}>
                                    {item.timing.cutoffCountdown}
                                  </span>
                                </div>
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
                            {item.timing.isOnDemand ? (
                              <span className="text-slate-400 italic">Trigger as needed</span>
                            ) : (
                              <div>
                                <span className="font-bold text-slate-800">{item.timing.dispatchTimeFormatted}</span>
                                <div className="text-[11px] font-semibold mt-0.5">
                                  <span className={item.timing.isDispatchOverdue ? 'text-red-600 font-bold' : 'text-blue-700'}>
                                    {item.timing.dispatchCountdown}
                                  </span>
                                </div>
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3 text-center whitespace-nowrap font-mono font-bold text-xs">
                            <span className={`px-2 py-0.5 rounded-lg border ${
                              (item.workload?.pendingTicketsCount || 0) > 0
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-slate-50 text-slate-400 border-slate-200'
                            }`}>
                              {item.workload?.pendingTicketsCount || 0}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-center whitespace-nowrap font-mono text-xs">
                            <span className="text-amber-700 font-bold">{item.workload?.billingPendingCount || 0}</span>
                            <span className="text-slate-400 mx-1">/</span>
                            <span className="text-cyan-700 font-bold">{item.workload?.packingPendingCount || 0}</span>
                          </td>

                          <td className="px-4 py-3 text-center whitespace-nowrap font-mono text-xs">
                            {item.workload?.oldestPendingMinutes > 0 ? (
                              <span className={`px-2 py-0.5 rounded-lg font-bold border ${
                                item.workload.oldestPendingMinutes > 120
                                  ? 'bg-red-50 text-red-700 border-red-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {item.workload.oldestPendingFormatted}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            {renderPriorityBadge(item.priority)}
                          </td>

                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleQuickPlanTrip(item.routeName)}
                              className="px-3 py-1.5 rounded-xl bg-[#003366] hover:bg-[#004c8f] text-white text-xs font-bold shadow-xs cursor-pointer transition-colors inline-flex items-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Plan Trip</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── ON-DEMAND ROUTES SECTION ── */}
          {consoleData.onDemandQueue?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500 fill-current" />
                  <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">
                    On-Demand Routes Backlog &amp; Instant Trigger
                  </h3>
                </div>
                <span className="text-xs text-slate-500">
                  Routes without fixed daily departure times
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {consoleData.onDemandQueue.map((route) => (
                  <div key={route.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-slate-300 transition-all space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-extrabold text-slate-900 text-sm">{route.route_name}</div>
                        <div className="font-mono text-xs text-slate-500">{route.route_code}</div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-900 uppercase">
                        On-Demand
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono bg-white p-2.5 rounded-xl border border-slate-200">
                      <span className="text-slate-500">Pending Orders:</span>
                      <strong className="text-purple-700 font-bold">
                        {(data.pendingBillings || []).filter(b => b.route_name === route.route_name).length} Invoices
                      </strong>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setOnDemandModal(route);
                          setOnDemandTripName(`On-Demand Run - ${route.route_name}`);
                        }}
                        className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-extrabold cursor-pointer transition-colors text-center shadow-xs"
                      >
                        ⚡ Trigger Dispatch
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickPlanTrip(route.route_name)}
                        className="px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                      >
                        Plan
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TAB 2: TRIP DISPATCH BUILDER (INVOICE SELECTION & MANIFEST)
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'builder' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Pending Invoices Selection Table */}
          <div className="lg:col-span-2 space-y-3">
            {/* Filter Bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Invoice Bill No, Party Name or Code..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#004c8f]"
                  />
                </div>

                {uniqueRoutes.length > 0 && (
                  <select
                    value={routeFilter}
                    onChange={(e) => setRouteFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#004c8f] shrink-0"
                  >
                    <option value="">All Routes</option>
                    {uniqueRoutes.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <button
                type="button"
                onClick={toggleSelectAll}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
              >
                {selectedBills.length === filteredInvoices.length && filteredInvoices.length > 0 ? (
                  <>
                    <CheckSquare className="w-4 h-4 text-[#004C8F]" />
                    <span>Deselect All</span>
                  </>
                ) : (
                  <>
                    <Square className="w-4 h-4 text-slate-500" />
                    <span>Select All ({filteredInvoices.length})</span>
                  </>
                )}
              </button>
            </div>

            {/* Pending Invoices Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="max-h-[540px] overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="sticky top-0 z-10 bg-[#003366] text-white">
                    <tr>
                      <th className="w-12 text-center py-3.5 px-3">
                        <input
                          type="checkbox"
                          checked={selectedBills.length === filteredInvoices.length && filteredInvoices.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded border-slate-300 text-[#004C8F] focus:ring-[#004C8F]"
                        />
                      </th>
                      <th className="px-4 py-3.5 text-xs font-extrabold uppercase tracking-wider">Invoice / Bill No</th>
                      <th className="px-4 py-3.5 text-xs font-extrabold uppercase tracking-wider min-w-[180px]">Customer Party</th>
                      <th className="px-4 py-3.5 text-xs font-extrabold uppercase tracking-wider">Route</th>
                      <th className="px-4 py-3.5 text-right text-xs font-extrabold uppercase tracking-wider">Cartons</th>
                      <th className="px-4 py-3.5 text-right text-xs font-extrabold uppercase tracking-wider">Invoice Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-16 text-slate-400 text-xs font-bold">
                          No pending unassigned invoices available for dispatch on this route.
                        </td>
                      </tr>
                    ) : (
                      filteredInvoices.map((b) => {
                        const isSelected = selectedBills.includes(b.id);
                        return (
                          <tr
                            key={b.id}
                            onClick={() => toggleBillSelect(b.id)}
                            className={`cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/80 font-semibold' : 'hover:bg-slate-50'}`}
                          >
                            <td className="text-center py-3 px-3" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleBillSelect(b.id)}
                                className="rounded border-slate-300 text-[#004C8F] focus:ring-[#004C8F]"
                              />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="font-mono font-bold text-[#004C8F] text-xs">
                                {b.bill_no}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-bold text-slate-900 text-xs">{b.party_name}</div>
                              <span className="text-[11px] font-mono text-slate-500">{b.party_code}</span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="text-xs text-slate-700 font-semibold">
                                {b.route_name || 'Direct Route'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-xs text-slate-700 whitespace-nowrap">
                              {b.total_cartons || 1}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-xs text-emerald-700 whitespace-nowrap">
                              ₹{Number(b.invoice_amount || 0).toLocaleString('en-IN')}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                <span>Showing {filteredInvoices.length} of {data.pendingBillings?.length || 0} invoices</span>
                <span className="font-extrabold text-[#003366]">
                  {selectedBills.length} Selected for Manifest Trip
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Trip Assignment & Live Summary Card */}
          <div className="space-y-4">
            <form onSubmit={handleCreateTrip} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="border-b border-slate-200 pb-3">
                <h3 className="text-sm font-extrabold text-[#003366] flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#004C8F]" />
                  Trip Resource Assignment
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Assign fleet driver and vehicle to manifest this trip</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Assigned Driver <span className="text-red-500 font-bold ml-0.5">*</span>
                </label>
                <select
                  value={driverId}
                  onChange={(e) => setDriverId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#004c8f]"
                  required
                >
                  {data.drivers?.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.phone ? `(${d.phone})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Assigned Vehicle <span className="text-red-500 font-bold ml-0.5">*</span>
                </label>
                <select
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#004c8f]"
                  required
                >
                  {data.vehicles?.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.vehicle_number} — {v.capacity_tons || 10} Tons ({v.vehicle_type || 'Truck'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Trip Instructions / Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#004c8f]"
                  placeholder="Enter dispatch notes or special delivery instructions..."
                />
              </div>

              {/* Live Selected Invoice Summary Checkpoint */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                <div className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center justify-between">
                  <span>Trip Load Summary</span>
                  <span className="text-[#004C8F] font-black">{selectedSummary.count} Invoices</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Total Cartons</span>
                    <span className="font-mono font-bold text-slate-900 text-base">{selectedSummary.cartons}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Total Units</span>
                    <span className="font-mono font-bold text-slate-900 text-base">{selectedSummary.units}</span>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600">Total Billed Value:</span>
                  <span className="font-mono font-black text-base text-emerald-700">
                    ₹{selectedSummary.amount.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || selectedBills.length === 0}
                className="w-full py-3 bg-[#003366] hover:bg-[#004c8f] text-white rounded-xl text-xs font-extrabold uppercase tracking-wider shadow-md disabled:opacity-50 cursor-pointer transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>{submitting ? 'Generating Trip...' : 'Create Dispatch Trip'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          ON-DEMAND DISPATCH CREATOR MODAL
      ═══════════════════════════════════════════════════════════════ */}
      {onDemandModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-md border border-slate-200 shadow-2xl overflow-hidden">
            <div className="bg-[#003366] px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-slate-950 font-bold">
                  <Zap className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Trigger On-Demand Dispatch</h3>
                  <p className="text-[11px] text-slate-300">{onDemandModal.route_name}</p>
                </div>
              </div>
              <button
                onClick={() => setOnDemandModal(null)}
                className="text-white/80 hover:text-white text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleTriggerOnDemand} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Trip Name / Identifier *
                </label>
                <input
                  type="text"
                  value={onDemandTripName}
                  onChange={(e) => setOnDemandTripName(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#004c8f]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Operational Notes / Trigger Reason
                </label>
                <textarea
                  value={onDemandNotes}
                  onChange={(e) => setOnDemandNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. High backlog reached, customer emergency request..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-[#004c8f]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setOnDemandModal(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingOnDemand}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider shadow cursor-pointer transition-all"
                >
                  {creatingOnDemand ? 'Triggering...' : 'Trigger Run'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
