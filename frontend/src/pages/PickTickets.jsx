import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import {
  ClipboardList,
  Plus,
  CheckCircle2,
  XCircle,
  CloudDownload,
  Search,
  Edit2,
  Trash2,
  FileSignature,
  AlertTriangle,
  UserCheck,
  Store,
  Ban,
  MessageSquare,
  ChevronDown,
  Check
} from 'lucide-react';

function SearchablePartySelect({ parties = [], selectedCode, onSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  const safeParties = Array.isArray(parties) ? parties : [];
  const selectedParty = safeParties.find(p => p?.party_code === selectedCode);

  const filteredParties = safeParties.filter(p => {
    const s = search.toLowerCase().trim();
    if (!s) return true;
    return (
      (p?.party_name && p.party_name.toLowerCase().includes(s)) ||
      (p?.party_code && p.party_code.toLowerCase().includes(s))
    );
  });

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-xs text-slate-900 font-semibold flex items-center justify-between cursor-pointer hover:border-[#004c8f] transition-all shadow-xs"
      >
        {selectedParty ? (
          <div className="flex items-center gap-2 truncate">
            <span className="font-mono font-black text-[#004c8f] bg-blue-100 px-2 py-0.5 rounded text-xs shrink-0 border border-blue-200">
              {selectedParty.party_code}
            </span>
            <span className="font-extrabold text-slate-900 truncate text-xs">{selectedParty.party_name}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-400">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Search & Select Party by Code or Name...</span>
          </div>
        )}
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden text-xs">
          <div className="p-2.5 bg-slate-50 border-b border-slate-200 sticky top-0 z-10 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type Party Name or Code (e.g. ALFA, 4856, WRJ)..."
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-[#004c8f] focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-slate-400 hover:text-slate-700 text-[10px] font-bold px-1.5 py-0.5 bg-slate-200 rounded cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
            {filteredParties.length === 0 ? (
              <div className="p-4 text-center text-slate-400 font-medium">
                No matching parties found for "{search}"
              </div>
            ) : (
              filteredParties.slice(0, 100).map(p => {
                const isSelected = p.party_code === selectedCode;
                return (
                  <div
                    key={p.party_code}
                    onClick={() => {
                      onSelect(p.party_code);
                      setIsOpen(false);
                      setSearch('');
                    }}
                    className={`p-2.5 hover:bg-blue-50 cursor-pointer flex items-center justify-between transition-colors ${
                      isSelected ? 'bg-blue-50/90 font-bold border-l-4 border-[#004c8f]' : ''
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="font-extrabold text-slate-900 truncate text-xs">{p.party_name}</div>
                      <div className="text-[10px] text-slate-500 font-medium flex items-center gap-2 mt-0.5">
                        <span>Route: <strong className="text-slate-700">{p.route_name || 'Direct Route'}</strong></span>
                        <span>&bull;</span>
                        <span>Salesman: <strong className="text-slate-700">{p.salesman || 'General'}</strong></span>
                      </div>
                    </div>
                    <span className="font-mono font-black text-[#004c8f] bg-blue-100/80 text-[11px] px-2 py-0.5 rounded-md border border-blue-200 shrink-0">
                      {p.party_code}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <div className="px-3 py-1.5 bg-slate-100 border-t border-slate-200 text-[10px] font-bold text-slate-500 flex justify-between items-center">
            <span>Showing {Math.min(filteredParties.length, 100)} of {filteredParties.length} matching parties</span>
            <span className="text-[#004c8f]">Total {parties.length} in System</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PickTickets() {
  const toast = useToast();
  const [tickets, setTickets] = useState([]);
  const [pickers, setPickers] = useState([]);
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Custom Delete Modal State
  const [deleteTicket, setDeleteTicket] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Cancel Ticket Modal State
  const [cancelTicket, setCancelTicket] = useState(null);
  const [cancelRemark, setCancelRemark] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().split(' ')[0].substring(0, 5),
    priority: 'Normal',
    ticket_no: '',
    customer_order_no: '',
    party_code: '',
    party_name: '',
    route: '',
    salesman: '',
    picker_id: '',
    qty_in_pick_ticket: 1,
    remarks: ''
  });

  const [partyFetching, setPartyFetching] = useState(false);
  const [partyFetchStatus, setPartyFetchStatus] = useState(null);
  const [ticketNoValid, setTicketNoValid] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const results = await Promise.allSettled([
        axios.get('/api/pick-tickets'),
        axios.get('/api/masters/workers'),
        axios.get('/api/parties')
      ]);
      const [tRes, pRes, prtRes] = results;
      setTickets(tRes.status === 'fulfilled' && Array.isArray(tRes.value?.data) ? tRes.value.data : []);
      const workers = pRes.status === 'fulfilled' && Array.isArray(pRes.value?.data) ? pRes.value.data : [];
      const activePickers = workers.filter(w => w?.role === 'Picker');
      setPickers(activePickers);
      setParties(prtRes.status === 'fulfilled' && Array.isArray(prtRes.value?.data) ? prtRes.value.data : []);
    } catch (err) {
      console.error('Error loading pick tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = async () => {
    setEditingId(null);
    setPartyFetchStatus(null);
    setTicketNoValid(null);

    let suggestedNo = 'PIK26-000001';
    try {
      const res = await axios.get('/api/pick-tickets/suggest-next-no');
      suggestedNo = res.data.suggestedNo;
    } catch (e) {}

    const firstParty = parties.length > 0 ? parties[0] : null;

    setFormData({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0].substring(0, 5),
      priority: 'Normal',
      ticket_no: suggestedNo,
      customer_order_no: '',
      party_code: firstParty ? firstParty.party_code : 'PTY-1001',
      party_name: firstParty ? firstParty.party_name : 'Apex Electronics Pvt Ltd',
      route: firstParty ? (firstParty.route_name || 'Gurgaon - Manesar Industrial Line') : 'Gurgaon - Manesar Industrial Line',
      salesman: firstParty ? (firstParty.salesman || 'Rajesh Kumar') : 'Rajesh Kumar',
      picker_id: pickers.length > 0 ? pickers[0].id : '',
      qty_in_pick_ticket: 1,
      remarks: ''
    });
    setShowModal(true);
  };

  const handlePartySelect = (code) => {
    const selected = parties.find(p => p.party_code === code);
    if (selected) {
      setFormData(prev => ({
        ...prev,
        party_code: selected.party_code,
        party_name: selected.party_name,
        route: selected.route_name || 'Direct Route',
        salesman: selected.salesman || 'General Sales'
      }));
      setPartyFetchStatus('success');
    } else {
      setFormData(prev => ({
        ...prev,
        party_code: code
      }));
    }
  };

  const handleFetchParty = async () => {
    if (!formData.party_code) return;
    setPartyFetching(true);
    setPartyFetchStatus(null);
    try {
      const res = await axios.get(`/api/parties/code/${formData.party_code.trim()}`);
      setFormData(prev => ({
        ...prev,
        party_name: res.data.partyName,
        route: res.data.route,
        salesman: res.data.salesman
      }));
      setPartyFetchStatus('success');
    } catch (err) {
      setPartyFetchStatus('error');
    } finally {
      setPartyFetching(false);
    }
  };

  const handleValidateTicketNo = async (ticketNo) => {
    if (ticketNo.length < 5) return;
    try {
      const res = await axios.get(`/api/pick-tickets/validate-number?ticketNo=${ticketNo}`);
      setTicketNoValid(res.data.isUnique);
    } catch (e) {
      setTicketNoValid(true);
    }
  };

  const handleEditClick = (t) => {
    setEditingId(t.id);
    setPartyFetchStatus('success');
    setTicketNoValid(true);
    setFormData({
      date: t.date || new Date().toISOString().split('T')[0],
      time: t.time || '12:00',
      priority: t.priority || 'Normal',
      ticket_no: t.ticket_no,
      customer_order_no: t.customer_order_no || '',
      party_code: t.party_code,
      party_name: t.party_name,
      route: t.route,
      salesman: t.salesman,
      picker_id: t.picker_id || '',
      qty_in_pick_ticket: t.qty_in_pick_ticket || 1,
      remarks: t.remarks || ''
    });
    setShowModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTicket) return;
    setDeleting(true);
    try {
      await axios.delete(`/api/pick-tickets/${deleteTicket.id}`);
      toast.success('Pick ticket deleted successfully!');
      setDeleteTicket(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error deleting pick ticket.');
    } finally {
      setDeleting(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTicket) return;
    if (!cancelRemark.trim()) {
      toast.warning('Please enter a cancellation reason/remark before submitting.');
      return;
    }
    setCancelling(true);
    try {
      await axios.put(`/api/pick-tickets/${cancelTicket.id}`, {
        status: 'Cancelled',
        remarks: `[CANCELLED] ${cancelRemark.trim()}`
      });
      toast.success('Pick ticket cancelled successfully!');
      setCancelTicket(null);
      setCancelRemark('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error cancelling pick ticket.');
    } finally {
      setCancelling(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        await axios.put(`/api/pick-tickets/${editingId}`, formData);
        toast.success('Pick ticket updated successfully!');
      } else {
        await axios.post('/api/pick-tickets', formData);
        toast.success('Pick ticket created successfully!');
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving pick ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTickets = tickets.filter(t =>
    t.ticket_no?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    t.party_name?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    t.party_code?.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const totalPages = Math.ceil(filteredTickets.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredTickets.length);
  const paginatedTickets = filteredTickets.slice(startIndex, startIndex + pageSize);

  return (
    <div className="space-y-3">
      {/* Top Action & Search Bar Aligned on Right */}
      <div className="flex flex-col items-end gap-2.5">
        <button
          onClick={handleOpenCreateModal}
          className="px-5 py-2.5 bg-[#004c8f] hover:bg-[#003a6d] text-white text-xs font-extrabold uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Create Pick Ticket
        </button>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => { setSearchFilter(e.target.value); setCurrentPage(1); }}
            placeholder="Search Ticket No, Party Name or Code..."
            className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-8 py-2 text-xs text-slate-800 font-medium placeholder:text-slate-400 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors shadow-xs"
          />
          {searchFilter && (
            <button
              type="button"
              onClick={() => setSearchFilter('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              title="Clear Search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Pick Tickets Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden w-full">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#003366] border-b-2 border-[#ed1c24] text-white font-bold uppercase tracking-wider text-[11px]">
                <th className="px-3 py-3 whitespace-nowrap">Ticket No</th>
                <th className="px-3 py-3 whitespace-nowrap">Date &amp; Time</th>
                <th className="px-3 py-3 whitespace-nowrap">Customer Order</th>
                <th className="px-3 py-3 whitespace-nowrap">Party</th>
                <th className="px-3 py-3 whitespace-nowrap">Route / Salesman</th>
                <th className="px-3 py-3 whitespace-nowrap">Floor Picker</th>
                <th className="px-2 py-3 text-center whitespace-nowrap">Qty</th>
                <th className="px-3 py-3 whitespace-nowrap">Priority</th>
                <th className="px-3 py-3 whitespace-nowrap">Status</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedTickets.map((t, idx) => (
                <tr key={t.id} className={`transition-colors hover:bg-blue-50/60 ${t.status === 'Cancelled' ? 'opacity-70' : ''}`}>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="font-mono font-extrabold text-[#004c8f] text-xs tracking-tight bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block whitespace-nowrap">{t.ticket_no}</span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="font-semibold text-slate-800 text-xs">
                      {(() => {
                        if (!t.date) return '—';
                        if (t.date.startsWith('/Date(')) {
                          const ms = parseInt(t.date.replace(/\/Date\((\d+)\)\//, '$1'), 10);
                          return new Date(ms).toISOString().split('T')[0];
                        }
                        return t.date;
                      })()}
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium">{t.time}</div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="font-mono font-semibold text-slate-800 text-xs whitespace-nowrap">{t.customer_order_no || <span className="text-slate-400 font-normal">—</span>}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-bold text-slate-900 text-xs line-clamp-1 max-w-[170px]" title={t.party_name}>{t.party_name}</div>
                    <span className="text-[10px] font-mono font-bold text-[#004c8f] bg-blue-50 px-1 py-0.2 rounded inline-block">{t.party_code}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-slate-800 text-xs line-clamp-1 max-w-[140px]" title={t.route}>{t.route}</div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[100px]">{t.salesman}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <div className="font-medium text-slate-800 text-xs flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[100px]">{t.picker_name || <span className="text-slate-400 italic">Unassigned</span>}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-center whitespace-nowrap">
                    <span className="text-base font-black text-[#004c8f]">{t.qty_in_pick_ticket}</span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide whitespace-nowrap ${
                      t.priority === 'Urgent' ? 'bg-red-600 text-white' :
                      t.priority === 'High'   ? 'bg-amber-500 text-white' :
                      'bg-slate-200 text-slate-700'
                    }`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide whitespace-nowrap ${
                      t.status === 'Dispatched' ? 'bg-purple-600 text-white' :
                      t.status === 'Billed'     ? 'bg-emerald-600 text-white' :
                      t.status === 'Cancelled'  ? 'bg-red-100 text-red-700 border border-red-300 line-through' :
                      t.status === 'Assigned'   ? 'bg-[#004c8f] text-white' :
                      'bg-slate-600 text-white'
                    }`}>
                      {t.status}
                    </span>
                    {t.status === 'Cancelled' && t.remarks && t.remarks.startsWith('[CANCELLED]') && (
                      <div className="text-[9px] text-red-500 font-semibold mt-0.5 max-w-[110px] truncate" title={t.remarks.replace('[CANCELLED] ', '')}>
                        ↳ {t.remarks.replace('[CANCELLED] ', '')}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {['Created', 'Assigned', 'Picked'].includes(t.status) ? (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEditClick(t)}
                          className="p-1 rounded bg-blue-50 hover:bg-blue-100 text-[#004c8f] border border-blue-200 transition-colors cursor-pointer"
                          title="Edit Pick Ticket"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { setCancelTicket(t); setCancelRemark(''); }}
                          className="p-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 transition-colors cursor-pointer"
                          title="Cancel Pick Ticket"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTicket(t)}
                          className="p-1 rounded bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors cursor-pointer"
                          title="Delete Pick Ticket"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                        Locked ({t.status})
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredTickets.length === 0 ? (
          <div className="py-16 text-center">
            <ClipboardList className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-semibold text-sm">No pick tickets found</p>
            <p className="text-slate-400 text-xs mt-1">Try adjusting your search or create a new ticket</p>
          </div>
        ) : (
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 text-xs">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer"
            >
              Previous
            </button>
            <span className="font-bold text-slate-800 px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage >= totalPages}
              className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {deleteTicket && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-3xl w-full max-w-md border border-slate-200 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-[#1c2d42]">Delete Pick Ticket?</h3>
            <p className="text-xs text-slate-500 font-medium">
              Are you sure you want to delete Pick Ticket <strong className="text-slate-900 font-mono">{deleteTicket.ticket_no}</strong> ({deleteTicket.party_name})? This action cannot be undone.
            </p>
            <div className="flex justify-center gap-3 pt-3 border-t border-slate-200">
              <button
                onClick={() => setDeleteTicket(null)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Pick Ticket Modal */}
      {cancelTicket && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-3xl w-full max-w-md border border-slate-200 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#1c2d42]">Cancel Pick Ticket</h3>
                <p className="text-[11px] text-slate-500 font-medium">Pick ticket will be marked as Cancelled</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-900">{cancelTicket.ticket_no}</p>
                <p className="text-[11px] text-amber-700 font-medium">{cancelTicket.party_name} &bull; Qty: {cancelTicket.qty_in_pick_ticket} &bull; {cancelTicket.status}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5 text-amber-500" />
                Cancellation Reason / Remark <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={cancelRemark}
                onChange={(e) => setCancelRemark(e.target.value)}
                placeholder="Enter reason for cancellation (e.g. Customer refused, Order modified, Out of stock, Duplicate entry...)"
                className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-800 focus:border-amber-500 focus:outline-none resize-none"
              />
              {cancelRemark.trim() === '' && (
                <p className="text-[10px] text-red-500 font-semibold mt-1">Cancellation remark is mandatory before submitting.</p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                onClick={() => { setCancelTicket(null); setCancelRemark(''); }}
                className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                Go Back
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={cancelling || !cancelRemark.trim()}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <Ban className="w-3.5 h-3.5" />
                {cancelling ? 'Cancelling...' : 'Cancel This Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pick Ticket Entry / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-3xl border border-slate-200 shadow-2xl my-3 sm:my-8 overflow-hidden max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-[#003366] border-b-4 border-[#ed1c24] px-4 sm:px-8 py-3.5 sm:py-5 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#004c8f] flex items-center justify-center shadow shrink-0">
                  <FileSignature className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                    {editingId ? 'Edit Pick Ticket' : 'Pick Ticket Entry — Form No 1'}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400 font-medium">Initialize order fulfillment request on the warehouse floor</p>
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
            <div className="p-4 sm:p-6 sm:p-8 space-y-6 overflow-y-auto flex-1">

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Row 1: Date, Time, Priority (Equal 3-column grid) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Date *</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                    className="w-full h-11 bg-slate-50 border border-slate-300 rounded-xl px-3.5 text-xs text-slate-900 font-semibold focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Time *</label>
                  <input
                    type="text"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    required
                    className="w-full h-11 bg-slate-50 border border-slate-300 rounded-xl px-3.5 text-xs text-slate-900 font-semibold focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Order Priority *</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full h-11 bg-slate-50 border border-slate-300 rounded-xl px-3.5 text-xs text-slate-900 font-semibold focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors cursor-pointer"
                  >
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Row 2: PickTicketNo & CustomerOrderNo (Equal 2-column grid) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">Pick Ticket No *</label>
                    {ticketNoValid === true && <span className="text-[10px] text-emerald-600 font-bold">✓ Available</span>}
                    {ticketNoValid === false && <span className="text-[10px] text-red-600 font-bold">✕ Already Exists</span>}
                  </div>
                  <input
                    type="text"
                    value={formData.ticket_no}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setFormData({ ...formData, ticket_no: val });
                      handleValidateTicketNo(val);
                    }}
                    required
                    placeholder="PIK26-000001"
                    className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-xs text-[#004c8f] font-mono font-bold uppercase focus:border-[#004c8f] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Customer Order No (Optional)</label>
                  <input
                    type="text"
                    value={formData.customer_order_no}
                    onChange={(e) => setFormData({ ...formData, customer_order_no: e.target.value.toUpperCase() })}
                    placeholder="CO26-000001"
                    className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-xs text-slate-800 font-mono font-bold uppercase focus:border-[#004c8f] focus:outline-none"
                  />
                </div>
              </div>

              {/* Row 3: Party Code & Party Name (Equal 2-column grid) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                    Party Code *
                  </label>
                  <SearchablePartySelect
                    parties={parties}
                    selectedCode={formData.party_code}
                    onSelect={(code) => handlePartySelect(code)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Party Name</span>
                    <span className="text-[10px] font-normal text-slate-400">(Read Only)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.party_name}
                    readOnly
                    placeholder="Auto-populated Party Name"
                    className="w-full h-11 bg-slate-100 border border-slate-200 rounded-xl px-3.5 text-xs text-slate-700 font-bold cursor-not-allowed select-none focus:outline-none"
                  />
                </div>
              </div>

              {/* Row 4: Route, Salesman, Picker (Equal 3-column grid) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Route</span>
                    <span className="text-[10px] font-normal text-slate-400">(Read Only)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.route}
                    readOnly
                    placeholder="Auto-populated Route"
                    className="w-full h-11 bg-slate-100 border border-slate-200 rounded-xl px-3.5 text-xs text-slate-700 font-bold cursor-not-allowed select-none focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Salesman</span>
                    <span className="text-[10px] font-normal text-slate-400">(Read Only)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.salesman}
                    readOnly
                    placeholder="Auto-populated Salesman"
                    className="w-full h-11 bg-slate-100 border border-slate-200 rounded-xl px-3.5 text-xs text-slate-700 font-bold cursor-not-allowed select-none focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">
                    Picker *
                  </label>
                  <select
                    value={formData.picker_id}
                    onChange={(e) => setFormData({ ...formData, picker_id: e.target.value })}
                    required
                    className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-xs text-slate-900 font-semibold focus:border-[#004c8f] focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Choose Picker --</option>
                    {pickers.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.employee_code || `EMP-${p.id}`})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 5: Quantity & Remarks */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.qty_in_pick_ticket}
                    onChange={(e) => setFormData({ ...formData, qty_in_pick_ticket: parseInt(e.target.value, 10) || 1 })}
                    required
                    className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-xs text-slate-800 font-bold focus:border-[#004c8f] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Remarks / Notes</label>
                  <input
                    type="text"
                    value={formData.remarks}
                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                    placeholder="Special pick floor instructions..."
                    className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 text-xs text-slate-800 font-medium focus:border-[#004c8f] focus:outline-none"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || ticketNoValid === false}
                  className="px-8 py-3 rounded-xl bg-[#004c8f] hover:bg-[#003a6d] text-white text-sm font-bold uppercase tracking-wider shadow-md disabled:opacity-50 cursor-pointer transition-colors"
                >
                  {submitting ? 'Saving Ticket...' : 'Submit Ticket'}
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
