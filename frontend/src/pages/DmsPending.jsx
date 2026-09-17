import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import {
  AlertCircle,
  FileCheck,
  Search,
  CheckCircle2,
  RefreshCw,
  Eye,
  Undo2,
  Coins,
  ArrowRight,
  X
} from 'lucide-react';

export default function DmsPending() {
  const toast = useToast();
  const { activeWarehouse } = useAuth();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [search, setSearch] = useState('');

  // Quick DMS Update Modal
  const [selectedItem, setSelectedItem] = useState(null);
  const [strNo, setStrNo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchDmsPending();
  }, [activeWarehouse]);

  const fetchDmsPending = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/returns?is_dms=0&limit=100');
      const list = Array.isArray(res.data)
        ? res.data
        : (Array.isArray(res.data?.data)
          ? res.data.data
          : (Array.isArray(res.data?.returns) ? res.data.returns : []));
      setData(list);
    } catch (err) {
      setData([]);
      toast.show('Failed to fetch pending DMS queue.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDms = async (e) => {
    e.preventDefault();
    if (!strNo || !strNo.trim()) {
      toast.show('STR No. is required.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      await axios.put(`/api/returns/${selectedItem.id}/dms`, { str_no: strNo.trim() });
      toast.show(`DMS Received confirmed for ${selectedItem.return_no}!`, 'success');
      setSelectedItem(null);
      setStrNo('');
      fetchDmsPending();
    } catch (err) {
      toast.show(err.response?.data?.message || 'Error updating DMS status.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const safeData = Array.isArray(data) ? data : [];
  const filtered = safeData.filter((r) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (r.return_no && r.return_no.toLowerCase().includes(s)) ||
      (r.party_name && r.party_name.toLowerCase().includes(s)) ||
      (r.party_code && r.party_code.toLowerCase().includes(s)) ||
      (r.remark_name && r.remark_name.toLowerCase().includes(s))
    );
  });

  const safeFiltered = Array.isArray(filtered) ? filtered : [];
  const totalValuePending = safeFiltered.reduce((acc, r) => acc + (parseFloat(r.total_value) || 0), 0);

  return (
    <div className="space-y-4 pb-12">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shadow-sm">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-[#003366] tracking-tight">
              Pending DMS Allocation Queue
            </h2>
            <p className="text-xs text-slate-500 font-semibold">
              Returns pending STR generation in Dealer Management System (DMS)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/return/register"
            className="px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            All Returns Register
          </Link>
          <Link
            to="/return/new"
            className="px-3 py-2 rounded-xl text-xs font-bold text-white bg-[#003366] hover:bg-[#004c8f] shadow-md border-r-4 border-[#ed1c24] transition-all cursor-pointer"
          >
            + New Return
          </Link>
        </div>
      </div>

      {/* Summary Banner */}
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-4 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/20 rounded-xl">
            <AlertCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-black text-sm uppercase tracking-wide">
              {safeFiltered.length} Returns Awaiting STR Settlement
            </h3>
            <p className="text-xs text-amber-100">
              Total Outstanding Return Value: ₹{totalValuePending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Quick search pending returns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white text-slate-800 text-xs font-bold focus:outline-hidden shadow-xs"
          />
        </div>
      </div>

      {/* Queue Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#003366] text-white font-extrabold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3">Return No</th>
                <th className="p-3">Return Date</th>
                <th className="p-3 min-w-[180px]">Party Name</th>
                <th className="p-3">Reason</th>
                <th className="p-3 text-right">Total Qty</th>
                <th className="p-3 text-right">Total Value (₹)</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center w-36">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-bold">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#003366]" />
                    Loading Pending DMS Queue...
                  </td>
                </tr>
              ) : safeFiltered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-emerald-600 font-bold">
                    <CheckCircle2 className="w-6 h-6 mx-auto mb-2" />
                    All material returns are reconciled! No pending DMS queue.
                  </td>
                </tr>
              ) : (
                safeFiltered.map((r) => (
                  <tr key={r.id} className="hover:bg-amber-50/40 transition-colors">
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
                    <td className="p-3 text-right font-bold text-slate-800">{r.total_qty}</td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-700">
                      ₹{Number(r.total_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        Pending DMS
                      </span>
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => { setSelectedItem(r); setStrNo(''); }}
                        className="flex items-center gap-1 mx-auto px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] shadow-xs cursor-pointer"
                      >
                        <FileCheck className="w-3.5 h-3.5" />
                        Record STR No
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* STR Record Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-[#003366]">
                <FileCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-sm">Enter DMS / STR Allocation Number</h3>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Return No:</span>
                  <span className="font-mono font-bold text-[#003366]">{selectedItem.return_no}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Party:</span>
                  <span className="font-bold text-slate-800">{selectedItem.party_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Value:</span>
                  <span className="font-bold text-emerald-700">₹{selectedItem.total_value}</span>
                </div>
              </div>

              <form onSubmit={handleConfirmDms} className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    STR Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. STR-2026-00492"
                    value={strNo}
                    onChange={(e) => setStrNo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-[#003366] focus:outline-hidden"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#003366] hover:bg-[#004c8f] cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Confirm STR & DMS Received'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
