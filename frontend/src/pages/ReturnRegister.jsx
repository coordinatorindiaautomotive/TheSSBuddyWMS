import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from '../components/SearchableSelect';
import {
  Undo2,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  Download,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Coins,
  Package,
  Layers,
  FileCheck,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  X
} from 'lucide-react';

export default function ReturnRegister() {
  const navigate = useNavigate();
  const toast = useToast();
  const { activeWarehouse } = useAuth();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [parties, setParties] = useState([]);

  // Filters
  const [search, setSearch] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [dmsFilter, setDmsFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Quick DMS Update Modal
  const [dmsModalItem, setDmsModalItem] = useState(null);
  const [modalStrNo, setModalStrNo] = useState('');
  const [updatingDms, setUpdatingDms] = useState(false);

  // Delete Confirmation Modal
  const [deleteModalItem, setDeleteModalItem] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchParties();
  }, [activeWarehouse]);

  useEffect(() => {
    fetchReturns();
  }, [page, pageSize, partyFilter, dmsFilter, statusFilter, fromDate, toDate, activeWarehouse]);

  const fetchParties = async () => {
    try {
      const res = await axios.get('/api/parties');
      const partyList = Array.isArray(res.data)
        ? res.data
        : (Array.isArray(res.data?.data)
          ? res.data.data
          : (Array.isArray(res.data?.parties) ? res.data.parties : []));
      setParties(partyList);
    } catch (err) {
      console.error('Error fetching parties:', err);
      setParties([]);
    }
  };

  const fetchReturns = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        limit: pageSize
      });
      if (search) params.append('search', search);
      if (partyFilter) params.append('party', partyFilter);
      if (dmsFilter !== '') params.append('is_dms', dmsFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (fromDate) params.append('from_date', fromDate);
      if (toDate) params.append('to_date', toDate);

      const res = await axios.get(`/api/returns?${params.toString()}`);
      const returnList = Array.isArray(res.data)
        ? res.data
        : (Array.isArray(res.data?.data)
          ? res.data.data
          : (Array.isArray(res.data?.returns) ? res.data.returns : []));
      setData(returnList);
      setTotalPages(res.data?.pagination?.totalPages || (returnList.length ? 1 : 1));
      setTotalRecords(res.data?.pagination?.totalRecords || returnList.length);
    } catch (err) {
      console.error('Error loading returns:', err);
      setData([]);
      toast.show('Failed to load returns list.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchReturns();
  };

  const handleClearFilters = () => {
    setSearch('');
    setPartyFilter('');
    setDmsFilter('');
    setStatusFilter('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const handleConfirmDms = async (e) => {
    e.preventDefault();
    if (!modalStrNo || !modalStrNo.trim()) {
      toast.show('Please enter a valid STR No.', 'warning');
      return;
    }
    setUpdatingDms(true);
    try {
      await axios.put(`/api/returns/${dmsModalItem.id}/dms`, { str_no: modalStrNo.trim() });
      toast.show(`DMS Received confirmed with STR: ${modalStrNo}`, 'success');
      setDmsModalItem(null);
      setModalStrNo('');
      fetchReturns();
    } catch (err) {
      toast.show(err.response?.data?.message || 'Error updating DMS status.', 'error');
    } finally {
      setUpdatingDms(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteModalItem) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/returns/${deleteModalItem.id}`);
      toast.show('Return record deleted successfully.', 'info');
      setDeleteModalItem(null);
      fetchReturns();
    } catch (err) {
      toast.show('Error deleting return record.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const safeData = Array.isArray(data) ? data : [];
  const safeParties = Array.isArray(parties) ? parties : [];

  const exportCSV = () => {
    if (safeData.length === 0) {
      toast.show('No data available to export.', 'warning');
      return;
    }
    const headers = ['Return No', 'Date', 'Party Code', 'Party Name', 'Reason', 'DMS Status', 'STR No', 'Total Qty', 'Total Value (INR)', 'Status'];
    const rows = safeData.map((r) => [
      `"${r.return_no || ''}"`,
      `"${r.return_date || ''}"`,
      `"${r.party_code || ''}"`,
      `"${(r.party_name || '').replace(/"/g, '""')}"`,
      `"${(r.remark_name || '').replace(/"/g, '""')}"`,
      `"${r.is_dms_received ? 'DMS Received' : 'Pending DMS'}"`,
      `"${r.str_no || ''}"`,
      r.total_qty || 0,
      r.total_value || 0,
      `"${r.status || ''}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Return_Register_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    toast.show('Export downloaded successfully!', 'success');
  };

  // KPIs
  const totalValSummary = safeData.reduce((acc, r) => acc + (parseFloat(r.total_value) || 0), 0);
  const totalUnitsSummary = safeData.reduce((acc, r) => acc + (parseInt(r.total_qty, 10) || 0), 0);
  const pendingDmsCount = safeData.filter((r) => !r.is_dms_received).length;

  return (
    <div className="space-y-4 pb-12">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold shadow-sm">
            <Undo2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-[#003366] tracking-tight">
              Material Return Register
            </h2>
            <p className="text-xs text-slate-500 font-semibold">
              Master log of all return entries, reference invoices &amp; DMS STR settlements
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
            to="/return/reports"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[#004C8F] bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
          >
            Analytics &amp; Reports
          </Link>
          <Link
            to="/return/new"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#003366] hover:bg-[#004c8f] shadow-md border-r-4 border-[#ed1c24] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            New Return Entry
          </Link>
        </div>
      </div>

      {/* KPI Cards Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Returns</span>
          <div className="text-lg font-black text-[#003366]">{totalRecords} Records</div>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Page Units Returned</span>
          <div className="text-lg font-black text-indigo-700">{totalUnitsSummary} Units</div>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Page Total Value</span>
          <div className="text-lg font-black text-emerald-700">₹{totalValSummary.toLocaleString('en-IN')}</div>
        </div>
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending DMS (Page)</span>
          <div className="text-lg font-black text-amber-600">{pendingDmsCount} Pending</div>
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
              placeholder="Search Return No, STR No, Reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#003366] focus:outline-hidden"
            />
          </div>

          {/* Party Filter */}
          <div>
            <SearchableSelect
              value={partyFilter}
              onChange={(val) => { setPartyFilter(val); setPage(1); }}
              placeholder="Filter by Party..."
              options={[
                { value: '', label: 'All Parties' },
                ...safeParties.map((p) => ({
                  value: p.party_code,
                  label: `${p.party_name} (${p.party_code})`
                }))
              ]}
            />
          </div>

          {/* DMS Status Filter */}
          <div>
            <select
              value={dmsFilter}
              onChange={(e) => { setDmsFilter(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-[#003366] focus:outline-hidden"
            >
              <option value="">All DMS Status</option>
              <option value="1">DMS Received (Yes)</option>
              <option value="0">Pending DMS (No)</option>
            </select>
          </div>

          {/* From Date */}
          <div>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-[#003366] focus:outline-hidden"
              title="From Date"
            />
          </div>

          {/* To Date */}
          <div>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 bg-white focus:ring-2 focus:ring-[#003366] focus:outline-hidden"
              title="To Date"
            />
          </div>
        </form>

        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
          <div className="text-slate-500 font-semibold">
            Showing <span className="text-slate-900 font-bold">{safeData.length}</span> of {totalRecords} returns
          </div>
          {(search || partyFilter || dmsFilter !== '' || statusFilter || fromDate || toDate) && (
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
                <th className="p-3">Return No</th>
                <th className="p-3">Date</th>
                <th className="p-3 min-w-[180px]">Customer Party</th>
                <th className="p-3">Reason / Remark</th>
                <th className="p-3 text-center">DMS Status</th>
                <th className="p-3">STR No</th>
                <th className="p-3 text-right">Qty (Parts)</th>
                <th className="p-3 text-right">Total Value (₹)</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 font-bold">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#003366]" />
                    Loading Return records...
                  </td>
                </tr>
              ) : safeData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 font-medium">
                    No return entries found matching your criteria.
                  </td>
                </tr>
              ) : (
                safeData.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-mono font-bold text-[#003366] whitespace-nowrap">
                      <Link to={`/return/view/${r.id}`} className="hover:underline">
                        {r.return_no}
                      </Link>
                    </td>
                    <td className="p-3 text-slate-600 font-medium whitespace-nowrap">{r.return_date}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900">{r.party_name}</div>
                      <span className="text-[10px] font-mono text-slate-400">({r.party_code})</span>
                    </td>
                    <td className="p-3 text-slate-700 font-medium">{r.remark_name || '—'}</td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          r.is_dms_received
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                      >
                        {r.is_dms_received ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" /> DMS Received
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3 h-3" /> Pending DMS
                          </>
                        )}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-xs text-slate-700 whitespace-nowrap font-bold">
                      {r.str_no ? (
                        <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {r.str_no}
                        </span>
                      ) : (
                        <button
                          onClick={() => { setDmsModalItem(r); setModalStrNo(''); }}
                          className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                        >
                          + Add STR No
                        </button>
                      )}
                    </td>
                    <td className="p-3 text-right font-bold text-slate-800 whitespace-nowrap">
                      {r.total_qty} <span className="text-slate-400 font-normal">({r.item_count} parts)</span>
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                      ₹{Number(r.total_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          r.status === 'Completed' || r.status === 'DMS Received'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : r.status === 'Cancelled'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          to={`/return/view/${r.id}`}
                          className="p-1.5 text-slate-500 hover:text-[#003366] hover:bg-slate-100 rounded-lg transition-colors"
                          title="View Details & Print Slip"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          to={`/return/edit/${r.id}`}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Return Entry"
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

      {/* Quick DMS Allocation Modal */}
      {dmsModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-[#003366]">
                <FileCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-sm">Confirm DMS Receipt &amp; Enter STR No</h3>
              </div>
              <button
                onClick={() => setDmsModalItem(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Return No:</span>
                  <span className="font-mono font-bold text-[#003366]">{dmsModalItem.return_no}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Party:</span>
                  <span className="font-bold text-slate-800">{dmsModalItem.party_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Value:</span>
                  <span className="font-bold text-emerald-700">₹{dmsModalItem.total_value}</span>
                </div>
              </div>

              <form onSubmit={handleConfirmDms} className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Enter DMS / STR Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. STR-2026-9041"
                    value={modalStrNo}
                    onChange={(e) => setModalStrNo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#003366] focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDmsModalItem(null)}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updatingDms}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#003366] hover:bg-[#004c8f] cursor-pointer disabled:opacity-50"
                  >
                    {updatingDms ? 'Saving...' : 'Confirm DMS Receipt'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Delete Return Entry?</h3>
                <p className="text-xs text-slate-500">{deleteModalItem.return_no}</p>
              </div>
            </div>
            <p className="text-xs text-slate-600">
              Are you sure you want to permanently delete this return entry and its item details?
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
