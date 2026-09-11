import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import {
  Receipt,
  Plus,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Search,
  Edit2,
  Trash2,
  Clock,
  Truck,
  FileText,
  DollarSign,
  UserCheck,
  X
} from 'lucide-react';

export default function Billing() {
  const toast = useToast();
  const [billings, setBillings] = useState([]);
  const [pendingTickets, setPendingTickets] = useState([]);
  const [checkers, setCheckers] = useState([]);
  const [helpers, setHelpers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [deleteBilling, setDeleteBilling] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState({
    pick_ticket_id: '',
    billing_date: new Date().toISOString().split('T')[0],
    billing_time: new Date().toTimeString().split(' ')[0].substring(0, 5),
    prefix: 'RS/',
    bill_no: '',
    billed_qty: 0,
    checker_id: '',
    helper_id: '',
    start_time: new Date(Date.now() - 30 * 60000).toISOString().substring(0, 16),
    end_time: new Date().toISOString().substring(0, 16),
    invoice_amount: 0,
    short_qty: 0,
    excess_qty: 0,
    damage_qty: 0,
    billing_remarks: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        axios.get('/api/billings'),
        axios.get('/api/billings/pending-tickets'),
        axios.get('/api/masters/workers')
      ]);
      const [bRes, tRes, wRes] = results;
      setBillings(bRes.status === 'fulfilled' && Array.isArray(bRes.value?.data) ? bRes.value.data : []);
      setPendingTickets(tRes.status === 'fulfilled' && Array.isArray(tRes.value?.data) ? tRes.value.data : []);

      const workers = wRes.status === 'fulfilled' && Array.isArray(wRes.value?.data) ? wRes.value.data : [];
      const ch = workers.filter(w => w?.role === 'Checker');
      const hl = workers.filter(w => w?.role === 'Helper');
      setCheckers(ch);
      setHelpers(hl);
    } catch (err) {
      console.error('Error loading billing data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestedBillNo = async (prefix) => {
    if (prefix === 'FREE') {
      setFormData(prev => ({ ...prev, bill_no: '' }));
      return;
    }
    try {
      const res = await axios.get(`/api/billings/suggest-next-no?prefix=${encodeURIComponent(prefix)}`);
      setFormData(prev => ({ ...prev, bill_no: res.data.suggestedNo }));
    } catch (e) {}
  };

  const handleOpenCreateModal = async () => {
    setEditingId(null);
    setSelectedTicket(null);

    const now = new Date();
    const startTimeStr = new Date(now.getTime() - 30 * 60000).toISOString().substring(0, 16);
    const endTimeStr = now.toISOString().substring(0, 16);

    const yearSuffix = new Date().getFullYear().toString().substring(2);
    let defaultBillNo = `RS/${yearSuffix}000001`;
    try {
      const res = await axios.get('/api/billings/suggest-next-no?prefix=RS/');
      defaultBillNo = res.data.suggestedNo;
    } catch (e) {}

    setFormData({
      pick_ticket_id: '',
      billing_date: new Date().toISOString().split('T')[0],
      billing_time: new Date().toTimeString().split(' ')[0].substring(0, 5),
      prefix: 'RS/',
      bill_no: defaultBillNo,
      billed_qty: 0,
      checker_id: checkers.length > 0 ? checkers[0].id : '',
      helper_id: helpers.length > 0 ? helpers[0].id : '',
      start_time: startTimeStr,
      end_time: endTimeStr,
      invoice_amount: 0,
      short_qty: 0,
      excess_qty: 0,
      damage_qty: 0,
      billing_remarks: ''
    });
    setShowModal(true);
  };

  const formatForDateTimeLocal = (dt) => {
    if (!dt) return new Date().toISOString().substring(0, 16);
    if (typeof dt === 'string') {
      const clean = dt.replace(' ', 'T').substring(0, 16);
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(clean)) return clean;
    }
    const d = new Date(dt);
    if (isNaN(d.getTime())) return new Date().toISOString().substring(0, 16);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleOpenEditModal = (b) => {
    setEditingId(b.id);
    setSelectedTicket({
      ticket_no: b.ticket_no,
      party_code: b.party_code,
      party_name: b.party_name,
      route: b.route,
      salesman: b.salesman,
      picker_name: b.picker_name || 'Floor Picker',
      qty_in_pick_ticket: b.qty_in_pick_ticket || b.billed_qty
    });

    let detectedPrefix = 'FREE';
    if (b.bill_no) {
      if (b.bill_no.startsWith('RS/')) detectedPrefix = 'RS/';
      else if (b.bill_no.startsWith('STI/')) detectedPrefix = 'STI/';
      else if (b.bill_no.startsWith('CSI/')) detectedPrefix = 'CSI/';
    }

    setFormData({
      pick_ticket_id: b.pick_ticket_id,
      billing_date: b.billing_date || (b.created_at ? b.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
      billing_time: b.billing_time || '10:00',
      prefix: detectedPrefix,
      bill_no: b.bill_no,
      billed_qty: b.billed_qty || 0,
      checker_id: b.checker_id || (checkers.length > 0 ? checkers[0].id : ''),
      helper_id: b.helper_id || (helpers.length > 0 ? helpers[0].id : ''),
      start_time: formatForDateTimeLocal(b.start_time),
      end_time: formatForDateTimeLocal(b.end_time),
      invoice_amount: b.invoice_amount || 0,
      short_qty: b.short_qty || 0,
      excess_qty: b.excess_qty || 0,
      damage_qty: b.damage_qty || 0,
      billing_remarks: b.billing_remarks || ''
    });
    setShowModal(true);
  };

  const handleTicketSelect = (ticketId) => {
    const ticket = pendingTickets.find(t => t.id === parseInt(ticketId, 10));
    setSelectedTicket(ticket || null);
    if (ticket) {
      const pickQty = ticket.qty_in_pick_ticket || 1;
      setFormData(prev => ({
        ...prev,
        pick_ticket_id: ticket.id,
        billed_qty: pickQty,
        short_qty: 0,
        excess_qty: 0
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        pick_ticket_id: '',
        billed_qty: 0,
        short_qty: 0,
        excess_qty: 0
      }));
    }
  };

  const handleBilledQtyChange = (val) => {
    const bQty = parseInt(val, 10) || 0;
    const ticketQty = selectedTicket ? selectedTicket.qty_in_pick_ticket : bQty;
    const diff = ticketQty - bQty;

    let sQty = 0;
    let eQty = 0;
    if (diff > 0) sQty = diff;
    else if (diff < 0) eQty = Math.abs(diff);

    setFormData(prev => ({
      ...prev,
      billed_qty: bQty,
      short_qty: sQty,
      excess_qty: eQty
    }));
  };

  const handleConfirmDelete = async () => {
    if (!deleteBilling) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/billings/${deleteBilling.id}`);
      toast.success('Billing record deleted successfully!');
      setDeleteBilling(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error deleting billing record.');
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        const res = await axios.put(`/api/billings/${editingId}`, formData);
        toast.success(res.data?.message || 'Invoice billing updated successfully!');
      } else {
        const res = await axios.post('/api/billings', formData);
        toast.success(res.data?.message || 'Invoice billing created successfully!');
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.details || err.message || 'Error saving invoice billing.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredBillings = billings.filter(b =>
    b.bill_no?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    b.party_name?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    b.ticket_no?.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const totalPages = Math.ceil(filteredBillings.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredBillings.length);
  const paginatedBillings = filteredBillings.slice(startIndex, startIndex + pageSize);

  return (
    <div className="space-y-3 w-full">
      {/* Top Action & Search Bar Aligned on Right */}
      <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between gap-2.5">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:block">
          Total Invoices: <span className="text-[#003366] font-extrabold">{filteredBillings.length}</span>
        </div>

        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => { setSearchFilter(e.target.value); setCurrentPage(1); }}
              placeholder="Search Bill, Ticket, Party..."
              className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-7 py-1.5 text-xs text-slate-800 font-medium placeholder:text-slate-400 focus:border-[#004c8f] focus:outline-none transition-colors shadow-xs"
            />
            {searchFilter && (
              <button
                type="button"
                onClick={() => setSearchFilter('')}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                title="Clear Search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-[#004c8f] hover:bg-[#003a6d] text-white text-xs font-extrabold uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Create Billing
          </button>
        </div>
      </div>

      {/* Main Billing Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#003366] border-b-2 border-[#ed1c24] text-white font-bold uppercase tracking-wider text-[11px]">
                <th className="px-3 py-3 whitespace-nowrap">Billing Date</th>
                <th className="px-3 py-3 whitespace-nowrap">Bill No</th>
                <th className="px-3 py-3 whitespace-nowrap">Pick Ticket No</th>
                <th className="px-3 py-3 whitespace-nowrap">Party</th>
                <th className="px-2 py-3 text-center whitespace-nowrap">Billed Qty</th>
                <th className="px-3 py-3 whitespace-nowrap">Checker</th>
                <th className="px-3 py-3 whitespace-nowrap">Helper</th>
                <th className="px-3 py-3 whitespace-nowrap">Invoice Amount</th>
                <th className="px-2 py-3 text-center whitespace-nowrap">Short / Damage</th>
                <th className="px-3 py-3 whitespace-nowrap">Remarks</th>
                <th className="px-3 py-3 text-center whitespace-nowrap">Status</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={12} className="text-center py-10 text-slate-400 text-xs">
                    Loading billing invoices...
                  </td>
                </tr>
              ) : filteredBillings.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-10 text-slate-400 text-xs font-semibold">
                    No billing invoices found.
                  </td>
                </tr>
              ) : paginatedBillings.map((b) => {
                const isDispatched = b.ticket_status === 'Dispatched' || b.ticket_status === 'Delivered';
                return (
                  <tr key={b.id} className="hover:bg-blue-50/60 transition-colors">
                    {/* Billing Date */}
                    <td className="px-3 py-2.5 text-slate-600 font-mono font-medium whitespace-nowrap">
                      {b.billing_date || (b.created_at ? b.created_at.split('T')[0] : '—')}
                    </td>

                    {/* Bill No */}
                    <td className="px-3 py-2.5 font-mono font-extrabold text-cyan-700 whitespace-nowrap">
                      <span className="inline-block bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded text-xs">
                        {b.bill_no}
                      </span>
                    </td>

                    {/* Pick Ticket No */}
                    <td className="px-3 py-2.5 font-mono font-bold text-[#004c8f] whitespace-nowrap">
                      <span>{b.ticket_no}</span>
                    </td>

                    {/* Party */}
                    <td className="px-3 py-2.5">
                      <div className="font-bold text-slate-900 line-clamp-1 max-w-[170px]" title={b.party_name}>{b.party_name}</div>
                      <span className="text-[10px] font-mono text-slate-400">{b.party_code}</span>
                    </td>

                    {/* Billed Qty */}
                    <td className="px-2 py-2.5 text-center font-extrabold text-[#004c8f] whitespace-nowrap">
                      {b.billed_qty}
                    </td>

                    {/* Checker */}
                    <td className="px-3 py-2.5 font-medium text-slate-700 whitespace-nowrap">
                      {b.checker_name || '—'}
                    </td>

                    {/* Helper */}
                    <td className="px-3 py-2.5 font-medium text-slate-700 whitespace-nowrap">
                      {b.helper_name || '—'}
                    </td>

                    {/* Invoice Amount */}
                    <td className="px-3 py-2.5 font-black text-emerald-700 whitespace-nowrap">
                      ₹{(b.invoice_amount || 0).toLocaleString()}
                    </td>

                    {/* Short / Damage */}
                    <td className="px-2 py-2.5 text-center whitespace-nowrap">
                      {(b.short_qty > 0 || b.damage_qty > 0 || b.excess_qty > 0) ? (
                        <div className="text-[10px] font-bold space-y-0.5">
                          {b.short_qty > 0 && <span className="text-red-600 block">Short: {b.short_qty}</span>}
                          {b.damage_qty > 0 && <span className="text-amber-600 block">Dmg: {b.damage_qty}</span>}
                          {b.excess_qty > 0 && <span className="text-blue-600 font-bold block">Excess: +{b.excess_qty}</span>}
                        </div>
                      ) : (
                        <span className="text-slate-400 font-normal">None</span>
                      )}
                    </td>

                    {/* Remarks */}
                    <td className="px-3 py-2.5 text-slate-500 max-w-[110px] truncate" title={b.billing_remarks}>
                      {b.billing_remarks || '—'}
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      {isDispatched ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1 whitespace-nowrap">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Dispatched
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1 whitespace-nowrap">
                          <Clock className="w-3 h-3 text-amber-600" /> Pending Dispatch
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {isDispatched ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-400 border border-slate-200">
                          Dispatched
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(b)}
                            className="p-1 rounded bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 cursor-pointer transition-colors"
                            title="Edit Invoice"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteBilling(b)}
                            className="p-1 rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 cursor-pointer transition-colors"
                            title="Delete Invoice"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls Footer */}
        {filteredBillings.length > 0 && (
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 text-xs">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer text-xs"
            >
              Previous
            </button>
            <span className="font-bold text-slate-800 px-1 text-xs">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer text-xs"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteBilling && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-3xl w-full max-w-md border border-slate-200 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-[#1c2d42]">Delete Billing Invoice?</h3>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Are you sure you want to delete invoice <strong className="text-slate-900 font-mono">{deleteBilling.bill_no}</strong> ({deleteBilling.party_name})? This will reset the linked pick ticket status to "Picked" and remove checking logs.
            </p>
            <div className="flex justify-center gap-3 pt-3 border-t border-slate-200">
              <button
                onClick={() => setDeleteBilling(null)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Billing Entry Modal (Form No 2) */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-5xl border border-slate-200 shadow-2xl my-3 sm:my-8 overflow-hidden max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-[#003366] border-b-4 border-[#ed1c24] px-4 sm:px-8 py-3.5 sm:py-5 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#004c8f] flex items-center justify-center shadow shrink-0">
                  <Receipt className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                    {editingId ? 'Edit Billing Entry' : 'Billing Entry (Form No 2)'}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400 font-medium">Generate shipping invoice and record item checking operations</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold cursor-pointer"
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 sm:p-8 overflow-y-auto flex-1">
              <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Pick Ticket Context Panel */}
                <div className="bg-slate-50 p-5 rounded-2xl space-y-5 border border-slate-200 h-fit">
                  <div className="border-b border-slate-200 pb-3">
                    <h4 className="text-xs font-bold text-[#004c8f] uppercase tracking-wider">Pick Ticket Context</h4>
                    <p className="text-[10px] text-slate-500">Select a pending pick ticket to load details</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Select Pending Ticket <span className="text-red-500 font-bold ml-0.5">*</span></label>
                    <select
                      value={formData.pick_ticket_id}
                      onChange={(e) => handleTicketSelect(e.target.value)}
                      required
                      disabled={!!editingId}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 font-semibold focus:border-[#004c8f] focus:outline-none disabled:bg-slate-100"
                    >
                      <option value="">-- Choose Pending Ticket --</option>
                      {editingId && selectedTicket && (
                        <option value={formData.pick_ticket_id}>
                          {selectedTicket.ticket_no} - {selectedTicket.party_name} ({selectedTicket.qty_in_pick_ticket} Qty)
                        </option>
                      )}
                      {pendingTickets.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.ticket_no} - {t.party_name} ({t.qty_in_pick_ticket} Qty)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Prefilled Ticket Context Details Box */}
                  <div className={`p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-2.5 text-xs transition-opacity ${selectedTicket ? 'opacity-100' : 'opacity-50'}`}>
                    <div className="flex justify-between"><span className="text-slate-500">Ticket No:</span><span className="font-bold text-[#004c8f] font-mono">{selectedTicket?.ticket_no || '-'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Party Code:</span><span className="font-mono text-slate-700 font-semibold">{selectedTicket?.party_code || '-'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Party Name:</span><span className="font-semibold text-slate-800 truncate max-w-[150px]">{selectedTicket?.party_name || '-'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Route:</span><span className="text-slate-700">{selectedTicket?.route || '-'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Salesman:</span><span className="text-slate-700">{selectedTicket?.salesman || '-'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Picker:</span><span className="font-medium text-slate-800">{selectedTicket?.picker_name || '-'}</span></div>
                    <div className="flex justify-between border-t border-slate-200 pt-2 mt-2">
                      <span className="text-[#004c8f] font-bold">Pick Ticket Qty:</span>
                      <span className="font-extrabold text-[#004c8f] text-sm">{selectedTicket?.qty_in_pick_ticket || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Billing Operational Inputs */}
                <div className="lg:col-span-2 space-y-5">
                  <div className="border-b border-slate-200 pb-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Billing Operational Parameters</h4>
                    <p className="text-[10px] text-slate-500">Complete verification details for this invoice</p>
                  </div>

                  {/* Row 1: Billing Date & Time */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Billing Date <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <input
                        type="date"
                        value={formData.billing_date}
                        onChange={(e) => setFormData({ ...formData, billing_date: e.target.value })}
                        required
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 font-semibold focus:border-[#004c8f] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Billing Time <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <input
                        type="text"
                        value={formData.billing_time}
                        onChange={(e) => setFormData({ ...formData, billing_time: e.target.value })}
                        required
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 font-semibold focus:border-[#004c8f] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Row 2: Invoice Bill No with Prefix Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Invoice Bill No <span className="text-red-500 font-bold ml-0.5">*</span></label>
                    <div className="flex gap-2">
                      <select
                        value={formData.prefix}
                        onChange={(e) => {
                          const pr = e.target.value;
                          setFormData({ ...formData, prefix: pr });
                          loadSuggestedBillNo(pr);
                        }}
                        className="bg-slate-100 border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-800 w-32 focus:border-[#004c8f] focus:outline-none cursor-pointer"
                      >
                        <option value="RS/">RS/</option>
                        <option value="STI/">STI/</option>
                        <option value="CSI/">CSI/</option>
                        <option value="FREE">Free Text</option>
                      </select>

                      <input
                        type="text"
                        value={formData.bill_no}
                        onChange={(e) => setFormData({ ...formData, bill_no: e.target.value.toUpperCase() })}
                        required
                        placeholder="RS/26000156"
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-[#004c8f] font-mono font-bold uppercase focus:border-[#004c8f] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Row 3: Checker, Helper, Billed Qty */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Checker <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <select
                        value={formData.checker_id}
                        onChange={(e) => setFormData({ ...formData, checker_id: e.target.value })}
                        required
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 font-semibold focus:border-[#004c8f] focus:outline-none"
                      >
                        <option value="">-- Choose Checker --</option>
                        {checkers.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Helper <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <select
                        value={formData.helper_id}
                        onChange={(e) => setFormData({ ...formData, helper_id: e.target.value })}
                        required
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 font-semibold focus:border-[#004c8f] focus:outline-none"
                      >
                        <option value="">-- Choose Helper --</option>
                        {helpers.map(h => (
                          <option key={h.id} value={h.id}>{h.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Billed Quantity <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <input
                        type="number"
                        value={formData.billed_qty}
                        onChange={(e) => handleBilledQtyChange(e.target.value)}
                        required
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 font-bold focus:border-[#004c8f] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Row 4: Timings & Invoice Amount */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Checking Start Time <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <input
                        type="datetime-local"
                        value={formData.start_time}
                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                        required
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 font-semibold focus:border-[#004c8f] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Checking End Time <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <input
                        type="datetime-local"
                        value={formData.end_time}
                        onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                        required
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 font-semibold focus:border-[#004c8f] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Invoice Amount (₹) <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.invoice_amount}
                        onChange={(e) => setFormData({ ...formData, invoice_amount: parseFloat(e.target.value) || 0 })}
                        required
                        placeholder="0.00"
                        className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-[#004c8f] font-extrabold focus:border-[#004c8f] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Operational Variance Calculator Box */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between font-bold text-xs">
                      <span className="text-slate-700">Operational Variance Check:</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                        formData.short_qty > 0 ? 'bg-red-50 text-red-600 border border-red-200' :
                        formData.excess_qty > 0 ? 'bg-blue-50 text-blue-600 border border-blue-200' :
                        'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {formData.short_qty > 0 ? `Shortage Alert: ${formData.short_qty} short!` :
                         formData.excess_qty > 0 ? `Excess Alert: ${formData.excess_qty} excess!` :
                         'Qty Match'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-red-50 border border-red-200 p-2.5 rounded-xl">
                        <span className="block text-[10px] uppercase font-bold text-red-500">Shortage</span>
                        <span className="font-extrabold text-sm text-red-700">{formData.short_qty}</span>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-xl">
                        <span className="block text-[10px] uppercase font-bold text-blue-500">Excess</span>
                        <span className="font-extrabold text-sm text-blue-700">{formData.excess_qty}</span>
                      </div>

                      <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl">
                        <span className="block text-[10px] uppercase font-bold text-amber-600 mb-1">Damage</span>
                        <input
                          type="number"
                          min="0"
                          value={formData.damage_qty}
                          onChange={(e) => setFormData({ ...formData, damage_qty: parseInt(e.target.value, 10) || 0 })}
                          className="bg-transparent text-center font-extrabold text-sm text-amber-700 w-full focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Billing Remarks */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Billing Remarks</label>
                    <input
                      type="text"
                      value={formData.billing_remarks}
                      onChange={(e) => setFormData({ ...formData, billing_remarks: e.target.value })}
                      placeholder="Internal billing verification notes..."
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:border-[#004c8f] focus:outline-none"
                    />
                  </div>

                  {/* Form Buttons */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-6 py-2.5 rounded-xl bg-[#004c8f] hover:bg-[#003a6d] text-white text-xs font-bold uppercase tracking-wider shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                    >
                      <FileCheck className="w-4 h-4" />
                      {submitting ? 'Processing...' : editingId ? 'Save Changes' : 'Complete Billing'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
