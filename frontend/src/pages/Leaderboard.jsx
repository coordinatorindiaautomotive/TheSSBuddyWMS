import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  Trophy,
  Award,
  Clock,
  Calendar,
  CalendarDays,
  CalendarRange,
  ShoppingBag,
  ClipboardCheck,
  Handshake,
  Ghost,
  RefreshCw,
  Sparkles,
  Search,
  Users,
  Flame,
  Zap,
  Phone,
  CheckCircle2,
  X,
  Printer
} from 'lucide-react';
import SearchableSelect from '../components/SearchableSelect';


const initials = (name = '') =>
  name
    .split(' ')
    .map(w => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

const roleColors = {
  Picker: { main: '#6366f1', light: '#eef2ff', text: '#4338ca', border: 'border-indigo-200' },
  Checker: { main: '#0284c7', light: '#f0f9ff', text: '#0369a1', border: 'border-sky-200' },
  Helper: { main: '#059669', light: '#ecfdf5', text: '#047857', border: 'border-emerald-200' }
};

export default function Leaderboard() {
  const [period, setPeriod] = useState('weekly');
  const [refreshSpeed, setRefreshSpeed] = useState('900000'); // 15 mins default
  const [search, setSearch] = useState('');
  const [data, setData] = useState({
    pickers: [],
    checkers: [],
    helpers: [],
    summary: {
      totalUnitsPicked: 0,
      totalQtyChecked: 0,
      totalQtyAssisted: 0,
      totalActiveStaff: 0,
      topPicker: null,
      topChecker: null,
      topHelper: null
    },
    generatedAt: '--'
  });
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState(null);

  useEffect(() => {
    fetchLeaderboard(period);

    const ms = parseInt(refreshSpeed, 10);
    if (ms > 0) {
      const timer = setInterval(() => fetchLeaderboard(period), ms);
      return () => clearInterval(timer);
    }
  }, [period, refreshSpeed]);

  const fetchLeaderboard = async (selectedPeriod) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/leaderboard?period=${selectedPeriod || period}`);
      setData(res.data);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterStaff = (list = []) => {
    const safeList = Array.isArray(list) ? list : [];
    if (!search || !search.trim()) return safeList;
    const q = search.toLowerCase().trim();
    return safeList.filter(
      s =>
        (s.name && String(s.name).toLowerCase().includes(q)) ||
        (s.employee_code && String(s.employee_code).toLowerCase().includes(q))
    );
  };

  const renderRankList = (entries, role) => {
    const filteredEntries = filterStaff(entries);

    if (!filteredEntries || filteredEntries.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-50/50 rounded-xl m-4 border border-dashed border-slate-200">
          <Ghost className="w-10 h-10 text-slate-300 mb-2" />
          <p className="text-xs text-slate-500 font-bold">
            {search ? 'No staff matching search query' : 'No activity logged for this timeframe'}
          </p>
        </div>
      );
    }

    const theme = roleColors[role] || roleColors.Picker;

    return (
      <div className="p-4 space-y-3">
        {filteredEntries.map((entry, idx) => {
          const rank = entry.rank || idx + 1;
          const rankLabel = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

          const rankBg =
            rank === 1
              ? 'bg-amber-500 text-white font-black shadow-md shadow-amber-500/30'
              : rank === 2
              ? 'bg-slate-400 text-white font-black shadow-md shadow-slate-400/30'
              : rank === 3
              ? 'bg-amber-700 text-white font-black shadow-md shadow-amber-700/30'
              : 'bg-slate-200 text-slate-700 font-bold';

          return (
            <div
              key={entry.id || idx}
              onClick={() => setSelectedStaff({ ...entry, role })}
              className="flex items-center gap-3.5 p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 hover:bg-blue-50/60 hover:border-blue-300 hover:shadow-md transition-all duration-200 shadow-xs cursor-pointer group"
            >
              {/* Rank Badge */}
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 ${rankBg}`}>
                {rankLabel}
              </span>

              {/* Initials Avatar */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shrink-0 shadow-xs group-hover:scale-105 transition-transform"
                style={{
                  backgroundColor: theme.light,
                  color: theme.text,
                  border: `1px solid ${theme.main}44`
                }}
              >
                {initials(entry.name)}
              </div>

              {/* Staff Details & Metric Bar */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-xs font-bold text-slate-900 truncate group-hover:text-[#004c8f] transition-colors">
                      {entry.name}
                    </span>
                    {entry.employee_code && (
                      <span className="text-[10px] font-mono font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                        {entry.employee_code}
                      </span>
                    )}
                  </div>
                  <span
                    className="text-xs font-black ml-2 shrink-0 px-2.5 py-0.5 rounded-lg shadow-xs"
                    style={{ backgroundColor: theme.light, color: theme.text }}
                  >
                    {entry.score.toLocaleString()} {role === 'Picker' ? 'Units' : role === 'Checker' ? 'Qty' : 'Qty'}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.max(entry.barWidth || 0, 8)}%`,
                      backgroundColor: theme.main
                    }}
                  ></div>
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1 font-semibold">
                  <span>
                    {entry.metric} &bull; {entry.count} transaction(s)
                  </span>
                  <span className="text-indigo-600 font-extrabold group-hover:underline">View details &rarr;</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const summary = data.summary || {};

  return (
    <div className="space-y-6">
      {/* Top Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Period Selector Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-white border border-slate-200 p-1.5 rounded-2xl shadow-sm">
          <button
            onClick={() => setPeriod('hourly')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
              period === 'hourly'
                ? 'bg-[#004c8f] text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> 1 Hour
          </button>

          <button
            onClick={() => setPeriod('today')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
              period === 'today'
                ? 'bg-[#004c8f] text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400" /> Today's Shift
          </button>

          <button
            onClick={() => setPeriod('weekly')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
              period === 'weekly'
                ? 'bg-[#004c8f] text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" /> This Week
          </button>

          <button
            onClick={() => setPeriod('monthly')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
              period === 'monthly'
                ? 'bg-[#004c8f] text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <CalendarRange className="w-3.5 h-3.5" /> This Month
          </button>

          <button
            onClick={() => setPeriod('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
              period === 'all'
                ? 'bg-[#004c8f] text-white shadow-md'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-300" /> All-Time
          </button>
        </div>

        {/* Live Indicator, Refresh Interval Dropdown & Manual Refresh Button */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Refresh Frequency Dropdown */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-3.5 py-1.5 rounded-2xl shadow-sm">
            <Clock className="w-3.5 h-3.5 text-[#004c8f] shrink-0" />
            <span className="text-xs font-bold text-slate-700 shrink-0">Auto Sync:</span>
            <div className="w-36">
              <SearchableSelect
                value={refreshSpeed}
                onChange={(val) => setRefreshSpeed(val)}
                options={[
                  { value: '30000', label: '30 Seconds' },
                  { value: '60000', label: '1 Minute' },
                  { value: '300000', label: '5 Minutes' },
                  { value: '900000', label: '15 Minutes' },
                  { value: '0', label: 'Manual Only' }
                ]}
                placeholder="Sync Interval..."
                className="py-1 text-xs font-extrabold"
              />
            </div>
          </div>

          {/* Live Status & Manual Refresh Button */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-2xl text-xs font-bold text-slate-700 shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>
              Synced: <strong className="text-slate-900 font-black">{data.generatedAt || '--'}</strong>
            </span>
            <button
              onClick={() => fetchLeaderboard(period)}
              disabled={loading}
              className="ml-2 px-3 py-1 bg-[#004c8f] hover:bg-[#003a6d] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
              title="Manual Refresh Leaderboard Anytime"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer print:hidden"
            title="Print Floor Leaderboard"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            Print
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Top Picker */}
        <div className="bg-white border border-indigo-100 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center font-bold shrink-0">
            <Trophy className="w-6 h-6 text-amber-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Top Picker</p>
            <h4 className="text-sm font-black text-slate-900 truncate">
              {summary.topPicker?.name || '—'}
            </h4>
            <p className="text-xs font-bold text-indigo-600">
              {summary.topPicker ? `${summary.topPicker.score.toLocaleString()} Units` : '0 Units'}
            </p>
          </div>
        </div>

        {/* Top Checker */}
        <div className="bg-white border border-sky-100 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center font-bold shrink-0">
            <Award className="w-6 h-6 text-sky-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Top Checker</p>
            <h4 className="text-sm font-black text-slate-900 truncate">
              {summary.topChecker?.name || '—'}
            </h4>
            <p className="text-xs font-bold text-sky-600">
              {summary.topChecker ? `${summary.topChecker.score.toLocaleString()} Qty Checked` : '0 Qty'}
            </p>
          </div>
        </div>

        {/* Top Helper */}
        <div className="bg-white border border-emerald-100 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center font-bold shrink-0">
            <Zap className="w-6 h-6 text-emerald-500" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Top Helper</p>
            <h4 className="text-sm font-black text-slate-900 truncate">
              {summary.topHelper?.name || '—'}
            </h4>
            <p className="text-xs font-bold text-emerald-600">
              {summary.topHelper ? `${summary.topHelper.score.toLocaleString()} Qty Assisted` : '0 Qty'}
            </p>
          </div>
        </div>

        {/* Total Floor Volume */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#004c8f] border border-blue-100 flex items-center justify-center font-bold shrink-0">
            <Users className="w-6 h-6 text-[#004c8f]" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Staff</p>
            <h4 className="text-sm font-black text-slate-900">
              {summary.totalActiveStaff || 0} Floor Workers
            </h4>
            <p className="text-xs font-bold text-slate-600">
              {(summary.totalUnitsPicked || 0).toLocaleString()} Total Units
            </p>
          </div>
        </div>
      </div>

      {/* Staff Search Bar */}
      <div className="bg-white border border-slate-200 shadow-sm p-3 rounded-2xl flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter staff by name or employee code..."
          className="flex-1 bg-transparent text-xs text-slate-800 font-bold placeholder:text-slate-400 focus:outline-none"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="text-slate-400 hover:text-slate-700 cursor-pointer text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-100"
          >
            Clear
          </button>
        )}
      </div>

      {/* Leaderboard Panels Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. Pickers Panel */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-[#003366] border-b-4 border-[#ed1c24] px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ShoppingBag className="w-5 h-5 text-indigo-300" />
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Pickers Leaderboard</h3>
                <p className="text-[10px] text-slate-300 font-medium">Ranked by total units picked</p>
              </div>
            </div>
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          {renderRankList(data.pickers, 'Picker')}
        </div>

        {/* 2. Checkers Panel */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-[#003366] border-b-4 border-[#ed1c24] px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <ClipboardCheck className="w-5 h-5 text-sky-300" />
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Checkers Leaderboard</h3>
                <p className="text-[10px] text-slate-300 font-medium">Ranked by total quantity checked</p>
              </div>
            </div>
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          {renderRankList(data.checkers, 'Checker')}
        </div>

        {/* 3. Helpers Panel */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-[#003366] border-b-4 border-[#ed1c24] px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Handshake className="w-5 h-5 text-emerald-300" />
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Helpers Leaderboard</h3>
                <p className="text-[10px] text-slate-300 font-medium">Ranked by quantity assisted</p>
              </div>
            </div>
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          {renderRankList(data.helpers, 'Helper')}
        </div>
      </div>

      {/* Staff Performance Details Modal */}
      {selectedStaff && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-3xl w-full max-w-md border border-slate-200 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black shadow-sm"
                  style={{
                    backgroundColor: roleColors[selectedStaff.role]?.light || '#f0f9ff',
                    color: roleColors[selectedStaff.role]?.text || '#0369a1'
                  }}
                >
                  {initials(selectedStaff.name)}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">{selectedStaff.name}</h3>
                  <p className="text-xs text-slate-500 font-semibold">
                    {selectedStaff.role} &bull; {selectedStaff.employee_code || `EMP-${selectedStaff.id}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStaff(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-center">
                <p className="text-[11px] font-bold text-slate-500 uppercase">Period Rank</p>
                <h4 className="text-2xl font-black text-amber-600">
                  {selectedStaff.rank === 1 ? '🥇 1st' : selectedStaff.rank === 2 ? '🥈 2nd' : selectedStaff.rank === 3 ? '🥉 3rd' : `#${selectedStaff.rank}`}
                </h4>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-center">
                <p className="text-[11px] font-bold text-slate-500 uppercase">Total Output</p>
                <h4 className="text-2xl font-black text-[#004c8f]">
                  {selectedStaff.score?.toLocaleString()}
                </h4>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-500 font-semibold">Transactions Logged:</span>
                <span className="font-bold text-slate-900">{selectedStaff.count} order(s)</span>
              </div>
              {selectedStaff.phone && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-semibold">Contact Mobile:</span>
                  <span className="font-mono font-bold text-slate-900">{selectedStaff.phone}</span>
                </div>
              )}
              {selectedStaff.total_invoice_val > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Invoices Value Checked:</span>
                  <span className="font-bold text-emerald-600">₹{selectedStaff.total_invoice_val.toLocaleString()}</span>
                </div>
              )}
              {selectedStaff.completed_tickets !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Completed vs Pending:</span>
                  <span className="font-bold text-slate-900">
                    {selectedStaff.completed_tickets} completed / {selectedStaff.pending_tickets} pending
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedStaff(null)}
              className="w-full py-2.5 bg-[#004c8f] hover:bg-[#003a6d] text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all"
            >
              Close Profile
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

