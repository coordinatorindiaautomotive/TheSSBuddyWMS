import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import {
  Undo2,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  FileCheck,
  Calendar,
  Layers,
  Hash,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Sparkles,
  Search,
  ChevronDown,
  RefreshCw,
  Clock,
  ArrowLeft,
  Building2,
  Tag
} from 'lucide-react';

// Dedicated Party Selector directly connected to Party Master
function SearchablePartySelect({ parties = [], selectedCode, onSelect, onReloadParties, loadingParties = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);

  const safeParties = Array.isArray(parties) ? parties : [];
  const selectedParty = safeParties.find((p) => String(p?.party_code) === String(selectedCode));

  const filteredParties = safeParties.filter((p) => {
    const s = search.toLowerCase().trim();
    if (!s) return true;
    return (
      (p?.party_name && String(p.party_name).toLowerCase().includes(s)) ||
      (p?.party_code && String(p.party_code).toLowerCase().includes(s)) ||
      (p?.route_name && String(p.route_name).toLowerCase().includes(s)) ||
      (p?.city && String(p.city).toLowerCase().includes(s))
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

  const handleOpenDropdown = () => {
    setIsOpen(!isOpen);
    if (!isOpen && safeParties.length === 0 && onReloadParties) {
      onReloadParties();
    }
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div
        onClick={handleOpenDropdown}
        className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-semibold flex items-center justify-between cursor-pointer hover:border-[#004c8f] focus-within:border-[#004c8f] focus-within:ring-2 focus-within:ring-[#003366]/20 transition-all shadow-xs"
      >
        {selectedParty ? (
          <div className="flex items-center gap-2 truncate">
            <span className="font-mono font-black text-[#004c8f] bg-blue-50 px-2 py-0.5 rounded-lg text-xs shrink-0 border border-blue-200">
              {selectedParty.party_code}
            </span>
            <span className="font-extrabold text-slate-900 truncate text-xs">{selectedParty.party_name}</span>
            {selectedParty.route_name && (
              <span className="text-[10px] text-slate-400 font-normal truncate hidden sm:inline">
                • {selectedParty.route_name}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-400">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-xs">Search & Select Customer Party...</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          {loadingParties && <RefreshCw className="w-3.5 h-3.5 text-[#004c8f] animate-spin shrink-0" />}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#004c8f]' : ''}`}
          />
        </div>
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden text-xs animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="p-2.5 bg-slate-50/90 border-b border-slate-200 sticky top-0 z-10 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search party by name or code (e.g. 1140, ALFA)..."
              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-[#004c8f] focus:outline-none focus:ring-2 focus:ring-[#003366]/20"
            />
            {onReloadParties && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onReloadParties();
                }}
                className="p-1.5 text-slate-500 hover:text-[#004c8f] hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Reload Party Master"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingParties ? 'animate-spin' : ''}`} />
              </button>
            )}
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-slate-400 hover:text-slate-700 text-[10px] font-bold px-2 py-1 bg-slate-200 rounded-lg cursor-pointer transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
            {loadingParties && safeParties.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-semibold flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-[#004c8f]" />
                Loading Party Master from registries...
              </div>
            ) : filteredParties.length === 0 ? (
              <div className="p-6 text-center text-slate-400 font-medium space-y-2">
                <div>No matching parties found in Master Registries.</div>
                {onReloadParties && (
                  <button
                    type="button"
                    onClick={onReloadParties}
                    className="text-xs font-bold text-[#004c8f] hover:underline cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Reload Party Master
                  </button>
                )}
              </div>
            ) : (
              filteredParties.map((p) => (
                <div
                  key={p.id || p.party_code}
                  onClick={() => {
                    onSelect(p);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`p-3 hover:bg-blue-50/80 cursor-pointer flex items-center justify-between transition-colors ${
                    String(selectedCode) === String(p.party_code) ? 'bg-blue-50/90 font-bold border-l-4 border-[#003366]' : ''
                  }`}
                >
                  <div className="space-y-0.5 truncate">
                    <div className="font-black text-slate-900 truncate text-xs">{p.party_name}</div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-2 font-medium">
                      <span className="font-mono text-[#004c8f] font-bold">Code: {p.party_code}</span>
                      {p.route_name && <span>• Route: {p.route_name}</span>}
                      {p.city && <span>• City: {p.city}</span>}
                    </div>
                  </div>
                  <span className="font-mono text-[11px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-lg shrink-0">
                    {p.party_code}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReturnEntry() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { activeWarehouse } = useAuth();

  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [loadingParties, setLoadingParties] = useState(false);
  const [parties, setParties] = useState([]);
  const [remarksList, setRemarksList] = useState([]);
  const [invoicesList, setInvoicesList] = useState([]);

  // Form State
  // 1. Invoice Bill No *
  const [refInvoiceNo, setRefInvoiceNo] = useState('');
  // 2. Invoice Bill Date * (Default within last 6 months)
  const [refInvoiceDate, setRefInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  // 3. Return Date * (Hidden from UI, automatically current date)
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  // 4. Select Customer Party * (from Party Master)
  const [partyCode, setPartyCode] = useState('');
  const [partyName, setPartyName] = useState('');
  // 5. Return Reason / Remark *
  const [remarkId, setRemarkId] = useState('');
  const [remarkName, setRemarkName] = useState('');
  // 6. DMS Status (Dropdown: 0 = NO / Pending DMS, 1 = YES / DMS Received)
  const [isDmsReceived, setIsDmsReceived] = useState(0);
  // 7. DMS / STR Number (Optional)
  const [strNo, setStrNo] = useState('');

  // Header Return No
  const [returnNo, setReturnNo] = useState('');
  const [internalRemarks, setInternalRemarks] = useState('');

  // Multi-part table rows (Only Part Number, Qty, Rate, Value, Action)
  const [items, setItems] = useState([
    { id: 1, part_no: '', qty: 1, rate: 0, value: 0 }
  ]);

  // Summary calculation
  const totalQty = items.reduce((acc, row) => acc + (parseInt(row.qty, 10) || 0), 0);
  const totalValue = items.reduce((acc, row) => acc + (parseFloat(row.value) || 0), 0);

  // Calculate 6 months ago minimum date constraint
  const minInvoiceDate = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().slice(0, 10);
  })();

  const maxInvoiceDate = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    fetchMasters();
    if (isEdit) {
      fetchReturnData(id);
    }
  }, [id, activeWarehouse]);

  useEffect(() => {
    if (partyCode) {
      fetchPartyInvoices(partyCode);
    } else {
      setInvoicesList([]);
    }
  }, [partyCode]);

  const fetchMasters = async () => {
    setLoadingParties(true);
    try {
      const [pRes, rRes] = await Promise.allSettled([
        axios.get('/api/parties'),
        axios.get('/api/masters/return-remarks')
      ]);

      if (pRes.status === 'fulfilled' && pRes.value?.data) {
        setParties(Array.isArray(pRes.value.data) ? pRes.value.data : []);
      }
      if (rRes.status === 'fulfilled' && rRes.value?.data) {
        setRemarksList(Array.isArray(rRes.value.data) ? rRes.value.data : []);
      }
    } catch (err) {
      console.error('Error fetching masters:', err);
    } finally {
      setLoadingParties(false);
    }
  };

  const reloadPartiesOnly = async () => {
    setLoadingParties(true);
    try {
      const res = await axios.get('/api/parties');
      if (res.data) {
        setParties(Array.isArray(res.data) ? res.data : []);
        toast.show('Party Master list synced successfully.', 'info');
      }
    } catch (err) {
      console.error('Reload parties error:', err);
    } finally {
      setLoadingParties(false);
    }
  };

  const fetchNextReturnNo = async () => {
    try {
      const res = await axios.get('/api/returns/suggest-next-no');
      if (res.data?.suggestedNo) {
        const nextNo = res.data.suggestedNo;
        setReturnNo(nextNo);
        setIsDmsReceived(1);
      }
    } catch (err) {
      console.error('Error getting return no:', err);
    }
  };

  const fetchPartyInvoices = async (pCode) => {
    try {
      const res = await axios.get(`/api/returns/invoices-lookup?party_code=${pCode}`);
      setInvoicesList(res.data || []);
    } catch (err) {
      console.error('Error fetching invoices:', err);
    }
  };

  const fetchReturnData = async (retId) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/returns/${retId}`);
      const ret = res.data;
      setReturnNo(ret.return_no || '');
      setRefInvoiceNo(ret.ref_invoice_no || '');
      setRefInvoiceDate(ret.ref_invoice_date || ret.return_date || new Date().toISOString().slice(0, 10));
      setReturnDate(ret.return_date || new Date().toISOString().slice(0, 10));
      setPartyCode(ret.party_code || '');
      setPartyName(ret.party_name || '');
      setRemarkId(ret.remark_id ? String(ret.remark_id) : '');
      setRemarkName(ret.remark_name || '');
      setIsDmsReceived(ret.is_dms_received ? 1 : 0);
      setStrNo(ret.str_no || '');
      setInternalRemarks(ret.internal_remarks || '');

      if (ret.items && ret.items.length > 0) {
        setItems(
          ret.items.map((it, idx) => ({
            id: idx + 1,
            part_no: it.part_no || '',
            qty: it.qty || 1,
            rate: it.rate || 0,
            value: it.value || (it.qty * it.rate)
          }))
        );
      }
    } catch (err) {
      toast.show('Failed to load return details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Reactive Return No change: typing Return No triggers DMS Status = YES
  const handleReturnNoChange = (val) => {
    setReturnNo(val);
    if (val && val.trim().length > 0) {
      setIsDmsReceived(1);
    } else {
      setIsDmsReceived(0);
    }
  };

  const handleInvoiceChange = (val) => {
    setRefInvoiceNo(val);
    const matched = invoicesList.find((inv) => String(inv.bill_no).toLowerCase() === String(val).trim().toLowerCase());
    if (matched && matched.billing_date) {
      setRefInvoiceDate(matched.billing_date);
    }
  };

  const handlePartySelect = (selected) => {
    if (selected) {
      setPartyCode(selected.party_code);
      setPartyName(selected.party_name);
    } else {
      setPartyCode('');
      setPartyName('');
    }
  };

  const handleRemarkChange = (val) => {
    setRemarkId(val);
    const selected = remarksList.find((r) => String(r.id) === String(val));
    if (selected) {
      setRemarkName(selected.name);
    } else {
      setRemarkName('');
    }
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;

    if (field === 'qty' || field === 'rate') {
      const q = parseFloat(field === 'qty' ? value : updated[index].qty) || 0;
      const r = parseFloat(field === 'rate' ? value : updated[index].rate) || 0;
      updated[index].value = parseFloat((q * r).toFixed(2));
    }
    setItems(updated);
  };

  const addItemRow = () => {
    setItems([
      ...items,
      { id: Date.now(), part_no: '', qty: 1, rate: 0, value: 0 }
    ]);
  };

  const removeItemRow = (index) => {
    if (items.length === 1) {
      toast.show('At least one part item row is required.', 'warning');
      return;
    }
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  const handleReset = () => {
    if (!isEdit) {
      setReturnNo('');
      setRefInvoiceNo('');
      setRefInvoiceDate(new Date().toISOString().slice(0, 10));
      setReturnDate(new Date().toISOString().slice(0, 10));
      setPartyCode('');
      setPartyName('');
      setRemarkId('');
      setRemarkName('');
      setIsDmsReceived(0);
      setStrNo('');
      setInternalRemarks('');
      setItems([{ id: 1, part_no: '', qty: 1, rate: 0, value: 0 }]);
    } else {
      fetchReturnData(id);
    }
    toast.show('Form reset to default values.', 'info');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!refInvoiceNo || !refInvoiceNo.trim()) {
      toast.show('Invoice Bill No * is required (Position 1).', 'warning');
      return;
    }

    if (!partyCode) {
      toast.show('Please select a Customer Party from Party Master (Position 4).', 'warning');
      return;
    }

    if (!returnNo || !returnNo.trim()) {
      toast.show('Return No * is mandatory.', 'warning');
      return;
    }

    const invalidItems = items.some((it) => !it.part_no.trim() || it.qty <= 0);
    if (invalidItems) {
      toast.show('Please enter valid Part Number/Code and positive Qty for all rows.', 'warning');
      return;
    }

    setLoading(true);
    const payload = {
      return_no: returnNo.trim(),
      ref_invoice_no: refInvoiceNo.trim(),
      ref_invoice_date: refInvoiceDate,
      return_date: returnDate,
      party_code: partyCode,
      party_name: partyName,
      remark_id: remarkId ? parseInt(remarkId, 10) : null,
      remark_name: remarkName,
      is_dms_received: isDmsReceived,
      str_no: strNo ? strNo.trim() : null,
      status: isDmsReceived === 1 ? 'DMS Received' : 'Pending DMS',
      internal_remarks: internalRemarks,
      items: items.map((it) => ({
        part_no: it.part_no.trim(),
        part_name: it.part_no.trim(),
        qty: parseInt(it.qty, 10) || 1,
        rate: parseFloat(it.rate) || 0,
        value: parseFloat(it.value) || 0
      }))
    };

    try {
      if (isEdit) {
        await axios.put(`/api/returns/${id}`, payload);
        toast.show('Return entry updated successfully!', 'success');
        navigate('/return/register');
      } else {
        const res = await axios.post('/api/returns', payload);
        toast.show('Return entry saved successfully!', 'success');
        navigate(`/return/view/${res.data.id}`);
      }
    } catch (err) {
      console.error('Save return error:', err);
      toast.show(err.response?.data?.message || 'Error saving return record.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 pb-12 max-w-7xl mx-auto">
      {/* Top Header Card with Portal Brand Style */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center font-bold shadow-xs border border-red-100 shrink-0">
            <Undo2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-[#003366] tracking-tight">
                {isEdit ? 'Edit Material Return Entry' : 'New Material Return Entry'}
              </h2>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-50 text-[#004c8f] border border-blue-200">
                WMS Inward
              </span>
            </div>
            <p className="text-xs text-slate-500 font-semibold">
              Process customer goods return against original invoice with DMS reconciliation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            to="/return/register"
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
          >
            <Undo2 className="w-3.5 h-3.5 text-slate-500" />
            Return Register
          </Link>
          <Link
            to="/return/dms-pending"
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200/80 hover:bg-amber-100 transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
          >
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Pending DMS Queue
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Section 1: 6 Visible Form Inputs (Return Date is hidden) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-5">
          {/* Header Sub-bar with Return No & Status Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center text-[#004C8F]">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#003366]">
                  1. Return Header Information
                </h3>
                <span className="text-[10px] text-slate-400 font-medium">
                  Entry Timestamp: {returnDate} (Auto-recorded)
                </span>
              </div>
            </div>

            {/* Quick Return No entry with Auto Sequence button */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  placeholder="Return No *"
                  value={returnNo}
                  onChange={(e) => handleReturnNoChange(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs font-mono font-bold text-[#003366] bg-slate-50/60 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#003366] focus:border-[#003366] focus:outline-hidden w-48 shadow-xs"
                />
              </div>
              <button
                type="button"
                onClick={fetchNextReturnNo}
                className="text-[11px] font-bold text-[#004C8F] bg-blue-50 border border-blue-200 hover:bg-blue-100 px-2.5 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                title="Auto Generate Return Number"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Auto
              </button>
            </div>
          </div>

          {/* 6 Ordered Form Inputs Grid (Return Date is fully hidden) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* 1. Invoice Bill No * (Against which return is made) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                1. Invoice Bill No <span className="text-red-500 font-bold">*</span>
              </label>
              <div className="relative">
                <Receipt className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 z-10" />
                <input
                  type="text"
                  list="party-invoices-list"
                  required
                  placeholder="e.g. RS/2026/012 or Bill No..."
                  value={refInvoiceNo}
                  onChange={(e) => handleInvoiceChange(e.target.value)}
                  className="w-full h-11 pl-10 pr-3.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-[#003366] focus:border-[#004c8f] focus:ring-2 focus:ring-[#003366]/20 focus:outline-hidden transition-all shadow-xs"
                />
                <datalist id="party-invoices-list">
                  {invoicesList.map((inv, i) => (
                    <option key={i} value={inv.bill_no}>
                      {`${inv.bill_no} — ₹${inv.invoice_amount} (${inv.billing_date})`}
                    </option>
                  ))}
                </datalist>
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-medium">Invoice against which return is processed</p>
            </div>

            {/* 2. Invoice Bill Date * (Selection based, within last 6 months) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                2. Invoice Bill Date <span className="text-red-500 font-bold">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                <input
                  type="date"
                  required
                  min={minInvoiceDate}
                  max={maxInvoiceDate}
                  value={refInvoiceDate}
                  onChange={(e) => setRefInvoiceDate(e.target.value)}
                  className="w-full h-11 pl-10 pr-3.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:border-[#004c8f] focus:ring-2 focus:ring-[#003366]/20 focus:outline-hidden transition-all shadow-xs"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-medium">Applicable invoice date (last 6 months)</p>
            </div>

            {/* 4. Select Customer Party * (from Party Master) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  3. Customer Party <span className="text-red-500 font-bold">*</span>
                </label>
                <button
                  type="button"
                  onClick={reloadPartiesOnly}
                  className="text-[10px] text-[#004c8f] hover:underline flex items-center gap-1 font-bold cursor-pointer"
                  title="Reload parties from Party Master"
                >
                  <RefreshCw className={`w-2.5 h-2.5 ${loadingParties ? 'animate-spin' : ''}`} /> Sync Master
                </button>
              </div>
              <SearchablePartySelect
                parties={parties}
                selectedCode={partyCode}
                onSelect={handlePartySelect}
                onReloadParties={reloadPartiesOnly}
                loadingParties={loadingParties}
              />
              <p className="text-[10px] text-slate-400 mt-1 font-medium">Customer from Party Master registry</p>
            </div>

            {/* 5. Return Reason / Remark * */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                4. Return Reason / Remark <span className="text-red-500 font-bold">*</span>
              </label>
              <div className="relative">
                <Tag className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                <select
                  value={remarkId}
                  onChange={(e) => handleRemarkChange(e.target.value)}
                  required
                  className="w-full h-11 pl-10 pr-8 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:border-[#004c8f] focus:ring-2 focus:ring-[#003366]/20 focus:outline-hidden transition-all shadow-xs appearance-none cursor-pointer"
                >
                  <option value="">-- Select Reason / Remark --</option>
                  {remarksList.map((r) => (
                    <option key={r.id} value={String(r.id)}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-medium">Operational return reason code</p>
            </div>

            {/* 6. DMS Status (Dropdown based, NOT chips) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                5. DMS Status <span className="text-red-500 font-bold">*</span>
              </label>
              <div className="relative">
                <select
                  value={isDmsReceived}
                  onChange={(e) => setIsDmsReceived(parseInt(e.target.value, 10))}
                  className={`w-full h-11 px-3.5 pr-8 border rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#003366]/20 focus:outline-hidden appearance-none cursor-pointer transition-all shadow-xs ${
                    isDmsReceived === 1
                      ? 'bg-emerald-50/80 border-emerald-300 text-emerald-800'
                      : 'bg-amber-50/80 border-amber-300 text-amber-800'
                  }`}
                >
                  <option value={0}>NO — Pending DMS Reconciliation</option>
                  <option value={1}>YES — DMS Received</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-medium">
                {isDmsReceived === 1 ? 'Direct DMS Received record' : 'Queued for DMS STR allocation'}
              </p>
            </div>

            {/* 7. DMS / STR Number (Optional) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                6. DMS / STR Number <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  placeholder="STR No. if available..."
                  value={strNo}
                  onChange={(e) => setStrNo(e.target.value)}
                  className="w-full h-11 pl-10 pr-3.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 focus:border-[#004c8f] focus:ring-2 focus:ring-[#003366]/20 focus:outline-hidden transition-all shadow-xs"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 font-medium">Stock Transfer Receipt / DMS No</p>
            </div>
          </div>
        </div>

        {/* Section 2: Multi-Part Return Items Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                <FileCheck className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#003366]">
                  2. Return Part Items &amp; Calculation
                </h3>
                <span className="text-[10px] text-slate-400 font-medium">
                  Add line items with return quantity and unit rate
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={addItemRow}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#003366] text-white text-xs font-bold hover:bg-[#004c8f] shadow-xs cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Part Row
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#003366] text-white font-extrabold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3 w-12 text-center">#</th>
                  <th className="p-3 min-w-[240px]">Part Number / Code *</th>
                  <th className="p-3 w-32 text-right">Return Qty *</th>
                  <th className="p-3 w-36 text-right">Rate (₹)</th>
                  <th className="p-3 w-40 text-right">Value (₹)</th>
                  <th className="p-3 w-16 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {items.map((row, idx) => (
                  <tr key={row.id || idx} className="hover:bg-blue-50/40 transition-colors">
                    <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                    <td className="p-3">
                      <input
                        type="text"
                        required
                        placeholder="e.g. PRT-99201 or Part Code..."
                        value={row.part_no}
                        onChange={(e) => handleItemChange(idx, 'part_no', e.target.value)}
                        className="w-full h-10 px-3 border border-slate-200 rounded-xl font-mono font-bold text-xs text-[#003366] bg-slate-50/50 focus:bg-white focus:border-[#004c8f] focus:ring-2 focus:ring-[#003366]/20 focus:outline-hidden transition-all"
                      />
                    </td>
                    <td className="p-3 text-right">
                      <input
                        type="number"
                        min="1"
                        required
                        value={row.qty}
                        onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                        className="w-full h-10 text-right px-3 border border-slate-200 rounded-xl font-black text-xs text-slate-900 bg-slate-50/50 focus:bg-white focus:border-[#004c8f] focus:ring-2 focus:ring-[#003366]/20 focus:outline-hidden transition-all"
                      />
                    </td>
                    <td className="p-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.rate}
                        onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                        className="w-full h-10 text-right px-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-slate-50/50 focus:bg-white focus:border-[#004c8f] focus:ring-2 focus:ring-[#003366]/20 focus:outline-hidden transition-all"
                      />
                    </td>
                    <td className="p-3 text-right font-mono font-extrabold text-xs text-emerald-700 whitespace-nowrap">
                      ₹{Number(row.value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                        title="Remove row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50/90 border-t-2 border-slate-200 font-bold text-xs text-slate-800">
                <tr>
                  <td colSpan={2} className="p-3.5 text-right uppercase tracking-wider text-[11px] text-slate-600">
                    Total Summary ({items.length} Parts):
                  </td>
                  <td className="p-3.5 text-right font-black text-sm text-[#003366]">{totalQty} Units</td>
                  <td className="p-3.5 text-right text-slate-400">—</td>
                  <td className="p-3.5 text-right font-black text-sm text-emerald-700">
                    ₹{totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Section 3: Internal Notes & Remarks */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-2">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Internal Inspection / Warehouse Notes (Optional)
          </label>
          <textarea
            rows={2}
            placeholder="Enter quality inspection remarks, condition of returned goods, or warehouse notes..."
            value={internalRemarks}
            onChange={(e) => setInternalRemarks(e.target.value)}
            className="w-full p-3 border border-slate-200 rounded-xl text-xs text-slate-800 focus:border-[#004c8f] focus:ring-2 focus:ring-[#003366]/20 focus:outline-hidden resize-none transition-all"
          />
        </div>

        {/* Form Actions Footer */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={loading}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Form
          </button>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-7 py-2.5 rounded-xl text-xs font-extrabold text-white bg-[#003366] hover:bg-[#004c8f] shadow-md border-r-4 border-[#ed1c24] transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Saving Return Entry...' : isEdit ? 'Update Return Entry' : 'Save & Submit Return'}
          </button>
        </div>
      </form>
    </div>
  );
}
