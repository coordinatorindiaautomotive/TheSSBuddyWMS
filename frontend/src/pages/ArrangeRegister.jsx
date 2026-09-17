import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from '../components/SearchableSelect';
import {
  Boxes,
  Plus,
  Search,
  Eye,
  Edit2,
  Trash2,
  Download,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X,
  Sparkles,
  ClipboardList
} from 'lucide-react';

export default function ArrangeRegister() {
  const navigate = useNavigate();
  const toast = useToast();
  const { activeWarehouse } = useAuth();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [teams, setTeams] = useState([]);

  // Filters
  const [search, setSearch] = useState('');
  const [arrangeForFilter, setArrangeForFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Pick Ticket Generation state
  const [convertingId, setConvertingId] = useState(null);

  // Delete modal
  const [deleteModalItem, setDeleteModalItem] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchTeams();
  }, [activeWarehouse]);

  useEffect(() => {
    fetchArranges();
  }, [page, pageSize, arrangeForFilter, teamFilter, statusFilter, fromDate, toDate, activeWarehouse]);

  const fetchTeams = async () => {
    try {
      const res = await axios.get('/api/masters/arrange-teams');
      const teamList = Array.isArray(res.data)
        ? res.data
        : (Array.isArray(res.data?.data) ? res.data.data : []);
      setTeams(teamList);
    } catch (err) {
      console.error('Error fetching teams:', err);
      setTeams([]);
    }
  };

  const fetchArranges = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        limit: pageSize
      });
      if (search) params.append('search', search);
      if (arrangeForFilter) params.append('arrange_for', arrangeForFilter);
      if (teamFilter) params.append('team_id', teamFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (fromDate) params.append('from_date', fromDate);
      if (toDate) params.append('to_date', toDate);

      const res = await axios.get(`/api/arranges?${params.toString()}`);
      const list = Array.isArray(res.data)
        ? res.data
        : (Array.isArray(res.data?.data) ? res.data.data : []);
      setData(list);
      setTotalPages(res.data?.pagination?.totalPages || (list.length ? 1 : 1));
      setTotalRecords(res.data?.pagination?.totalRecords || list.length);
    } catch (err) {
      console.error('Error loading arranges:', err);
      setData([]);
      toast.show('Failed to load arranges list.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchArranges();
  };

  const handleClearFilters = () => {
    setSearch('');
    setArrangeForFilter('');
    setTeamFilter('');
    setStatusFilter('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const handleConvertToPickTicket = async (arr) => {
    setConvertingId(arr.id);
    try {
      const res = await axios.post(`/api/arranges/${arr.id}/convert-to-pick-ticket`);
      toast.show(res.data.message || 'Pick Ticket generated successfully!', 'success');
      fetchArranges();
    } catch (err) {
      toast.show(err.response?.data?.message || 'Error generating pick ticket.', 'error');
    } finally {
      setConvertingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteModalItem) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/arranges/${deleteModalItem.id}`);
      toast.show('Arrange record deleted.', 'info');
      setDeleteModalItem(null);
      fetchArranges();
    } catch (err) {
      toast.show('Error deleting arrange record.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const safeData = Array.isArray(data) ? data : [];
  const safeTeams = Array.isArray(teams) ? teams : [];

  const exportCSV = () => {
    if (safeData.length === 0) {
      toast.show('No data available to export.', 'warning');
      return;
    }
    const headers = ['Arrange No', 'Date', 'STI No', 'STR No', 'Team', 'Arrange For', 'Destination', 'Total Qty', 'Pick Ticket No', 'Status'];
    const rows = safeData.map((r) => [
      `"${r.arrange_no || ''}"`,
      `"${r.arrange_date || ''}"`,
      `"${r.sti_no || ''}"`,
      `"${r.str_no || ''}"`,
      `"${(r.arrange_by_team_name || '').replace(/"/g, '""')}"`,
      `"${r.arrange_for || ''}"`,
      `"${(r.destination_name || '').replace(/"/g, '""')}"`,
      r.total_qty || 0,
      `"${r.pick_ticket_no || ''}"`,
      `"${r.status || ''}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Arrange_Register_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    toast.show('Export downloaded successfully!', 'success');
  };

  const totalUnitsSummary = safeData.reduce((acc, r) => acc + (parseInt(r.total_qty, 10) || 0), 0);
  const ptCreatedCount = safeData.filter((r) => r.pick_ticket_no).length;

  return (
    <div className="space-y-4 pb-12">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#004C8F] flex items-center justify-center font-bold shadow-sm">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-[#003366] tracking-tight">
              Material Arrangement Register
            </h2>
            <p className="text-xs text-slate-500 font-semibold">
              Requisitions tracking, STI-to-Pick Ticket fulfillment velocity &amp; team performance
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export CSV
          </button>
          <Link
            to="/arrange/reports"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#004C8F] bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
          >
            Fulfillment Velocity
          </Link>
          <Link
            to="/arrange/new"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#003366] hover:bg-[#004c8f] shadow-md border-r-4 border-[#ed1c24] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Arrange Entry
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Arranges</span>
          <div className="text-lg font-black text-[#003366]">{totalRecords} Records</div>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Required Units</span>
          <div className="text-lg font-black text-indigo-700">{totalUnitsSummary} Units</div>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pick Tickets Generated</span>
          <div className="text-lg font-black text-emerald-700">{ptCreatedCount} Linked</div>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Pick Ticket</span>
          <div className="text-lg font-black text-amber-600">{data.length - ptCreatedCount} Pending</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Quick Search */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search Arrange No, STI No, STR No, Destination..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#003366] focus:outline-hidden"
            />
          </div>

          {/* Arrange For Filter */}
          <div>
            <select
              value={arrangeForFilter}
              onChange={(e) => { setArrangeForFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-[#003366] focus:outline-hidden"
            >
              <option value="">All Destinations</option>
              <option value="Party">Party</option>
              <option value="Retail Outlet">Retail Outlet</option>
              <option value="Stock">Stock Replenishment</option>
            </select>
          </div>

          {/* Team Filter */}
          <div>
            <select
              value={teamFilter}
              onChange={(e) => { setTeamFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-[#003366] focus:outline-hidden"
            >
              <option value="">All Arrange Teams</option>
              {safeTeams.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.team_name}
                </option>
              ))}
            </select>
          </div>

          {/* From Date */}
          <div>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-[#003366] focus:outline-hidden"
            />
          </div>

          {/* To Date */}
          <div>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-[#003366] focus:outline-hidden"
            />
          </div>
        </form>

        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
          <div className="text-slate-500 font-semibold">
            Showing <span className="text-slate-900 font-bold">{safeData.length}</span> of {totalRecords} arrangements
          </div>
          {(search || arrangeForFilter || teamFilter || statusFilter || fromDate || toDate) && (
            <button
              onClick={handleClearFilters}
              className="text-xs font-bold text-red-600 hover:text-red-800 flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Clear All Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#003366] text-white font-extrabold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3">Arrange No</th>
                <th className="p-3">Date</th>
                <th className="p-3">STI No</th>
                <th className="p-3">STR No</th>
                <th className="p-3">Team</th>
                <th className="p-3 min-w-[180px]">Arrange For / Destination</th>
                <th className="p-3 text-right">Required Qty</th>
                <th className="p-3">Linked Pick Ticket</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 font-bold">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#003366]" />
                    Loading Arrange records...
                  </td>
                </tr>
              ) : safeData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 font-medium">
                    No arrangement records found.
                  </td>
                </tr>
              ) : (
                safeData.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-mono font-bold text-[#003366] whitespace-nowrap">
                      <Link to={`/arrange/view/${r.id}`} className="hover:underline">
                        {r.arrange_no}
                      </Link>
                    </td>
                    <td className="p-3 text-slate-600 font-medium whitespace-nowrap">{r.arrange_date}</td>
                    <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">{r.sti_no}</td>
                    <td className="p-3 font-mono font-bold text-amber-800 whitespace-nowrap">{r.str_no}</td>
                    <td className="p-3 text-slate-700 font-semibold">{r.arrange_by_team_name || '—'}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{r.destination_name || 'General Stock'}</div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">
                        [{r.arrange_for}] {r.destination_code ? `(${r.destination_code})` : ''}
                      </span>
                    </td>
                    <td className="p-3 text-right font-black text-sm text-[#003366] whitespace-nowrap">
                      {r.total_qty} <span className="text-[10px] font-normal text-slate-400">({r.item_count} parts)</span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {r.pick_ticket_no ? (
                        <Link
                          to="/pick-tickets"
                          className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 hover:underline inline-flex items-center gap-1"
                        >
                          <ClipboardList className="w-3 h-3" />
                          {r.pick_ticket_no}
                        </Link>
                      ) : (
                        <button
                          onClick={() => handleConvertToPickTicket(r)}
                          disabled={convertingId === r.id}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] border border-indigo-200 cursor-pointer disabled:opacity-50"
                        >
                          <Sparkles className="w-3 h-3 text-indigo-500" />
                          {convertingId === r.id ? 'Generating...' : '+ Gen Pick Ticket'}
                        </button>
                      )}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          r.status === 'Completed' || r.status === 'Pick Ticket Created'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : r.status === 'Cancelled'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-blue-50 text-[#004C8F] border border-blue-200'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          to={`/arrange/view/${r.id}`}
                          className="p-1.5 text-slate-500 hover:text-[#003366] hover:bg-slate-100 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          to={`/arrange/edit/${r.id}`}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Requisition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => setDeleteModalItem(r)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-semibold">Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(1); }}
              className="px-2 py-1 border border-slate-200 rounded-lg font-bold bg-white text-slate-700 focus:outline-hidden"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-slate-700">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      {deleteModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Delete Arrange Requisition?</h3>
                <p className="text-xs text-slate-500">{deleteModalItem.arrange_no}</p>
              </div>
            </div>
            <p className="text-xs text-slate-600">
              Are you sure you want to permanently delete this arrangement entry?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteModalItem(null)}
                className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
