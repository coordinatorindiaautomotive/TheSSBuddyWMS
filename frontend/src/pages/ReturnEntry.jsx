import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from '../components/SearchableSelect';
import {
  Undo2,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Printer,
  FileCheck,
  Building2,
  Calendar,
  Layers,
  FileText,
  AlertCircle,
  HelpCircle,
  Hash,
  Coins,
  ArrowRight,
  Upload,
  CheckCircle2,
  Receipt,
  Sparkles,
  Search
} from 'lucide-react';

export default function ReturnEntry() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { activeWarehouse } = useAuth();

  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [parties, setParties] = useState([]);
  const [remarksList, setRemarksList] = useState([]);
  const [invoicesList, setInvoicesList] = useState([]);

  // Form State
  const [returnNo, setReturnNo] = useState('');
  const [refInvoiceNo, setRefInvoiceNo] = useState('');
  const [selectedInvoiceMeta, setSelectedInvoiceMeta] = useState(null);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [partyCode, setPartyCode] = useState('');
  const [partyName, setPartyName] = useState('');
  const [remarkId, setRemarkId] = useState('');
  const [remarkName, setRemarkName] = useState('');
  const [isDmsReceived, setIsDmsReceived] = useState(0); // 0 = No (Pending DMS), 1 = Yes (DMS Received)
  const [strNo, setStrNo] = useState('');
  const [internalRemarks, setInternalRemarks] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');

  // Multi-part table rows
  const [items, setItems] = useState([
    { id: 1, part_no: '', part_name: '', reference_invoice_no: '', qty: 1, rate: 0, value: 0 }
  ]);

  // Summary calculation
  const totalQty = items.reduce((acc, row) => acc + (parseInt(row.qty, 10) || 0), 0);
  const totalValue = items.reduce((acc, row) => acc + (parseFloat(row.value) || 0), 0);

  useEffect(() => {
    fetchMasters();
    if (isEdit) {
      fetchReturnData(id);
    } else {
      fetchNextReturnNo();
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
    try {
      const [pRes, rRes] = await Promise.all([
        axios.get('/api/parties'),
        axios.get('/api/masters/return-remarks')
      ]);
      setParties(pRes.data || []);
      setRemarksList(rRes.data || []);
    } catch (err) {
      console.error('Error fetching masters:', err);
    }
  };

  const fetchNextReturnNo = async () => {
    try {
      const res = await axios.get('/api/returns/suggest-next-no');
      if (res.data?.suggestedNo) {
        const nextNo = res.data.suggestedNo;
        setReturnNo(nextNo);
        // Automatically set DMS Received to YES when Return No is populated
        if (nextNo && nextNo.trim().length > 0) {
          setIsDmsReceived(1);
        }
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
      setReturnDate(ret.return_date || new Date().toISOString().slice(0, 10));
      setPartyCode(ret.party_code || '');
      setPartyName(ret.party_name || '');
      setRemarkId(ret.remark_id ? String(ret.remark_id) : '');
      setRemarkName(ret.remark_name || '');
      setIsDmsReceived(ret.is_dms_received ? 1 : 0);
      setStrNo(ret.str_no || '');
      setInternalRemarks(ret.internal_remarks || '');
      setAttachmentUrl(ret.attachment_url || '');

      if (ret.items && ret.items.length > 0) {
        setItems(
          ret.items.map((it, idx) => ({
            id: idx + 1,
            part_no: it.part_no || '',
            part_name: it.part_name || '',
            reference_invoice_no: it.reference_invoice_no || ret.ref_invoice_no || '',
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

  // Reactive Return No change: typing/entering Return No sets DMS Received to YES
  const handleReturnNoChange = (val) => {
    setReturnNo(val);
    if (val && val.trim().length > 0) {
      setIsDmsReceived(1);
    } else {
      setIsDmsReceived(0);
    }
  };

  const handlePartyChange = (val) => {
    setPartyCode(val);
    const selected = parties.find((p) => p.party_code === val);
    if (selected) {
      setPartyName(selected.party_name);
    } else {
      setPartyName('');
    }
    // Clear previously selected ref invoice when party changes
    setRefInvoiceNo('');
    setSelectedInvoiceMeta(null);
  };

  const handleRefInvoiceSelect = (val) => {
    setRefInvoiceNo(val);
    const invMeta = invoicesList.find((i) => i.bill_no === val);
    setSelectedInvoiceMeta(invMeta || null);

    // Auto default ref invoice in part item rows where empty
    if (val) {
      setItems((prev) =>
        prev.map((it) => ({
          ...it,
          reference_invoice_no: it.reference_invoice_no || val
        }))
      );
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
      { id: Date.now(), part_no: '', part_name: '', reference_invoice_no: refInvoiceNo || '', qty: 1, rate: 0, value: 0 }
    ]);
  };

  const removeItemRow = (index) => {
    if (items.length === 1) {
      toast.show('At least one part item is required.', 'warning');
      return;
    }
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  const handleReset = () => {
    if (!isEdit) {
      fetchNextReturnNo();
      setRefInvoiceNo('');
      setSelectedInvoiceMeta(null);
      setPartyCode('');
      setPartyName('');
      setRemarkId('');
      setRemarkName('');
      setIsDmsReceived(0);
      setStrNo('');
      setInternalRemarks('');
      setAttachmentUrl('');
      setItems([{ id: 1, part_no: '', part_name: '', reference_invoice_no: '', qty: 1, rate: 0, value: 0 }]);
    } else {
      fetchReturnData(id);
    }
    toast.show('Form reset to default values.', 'info');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!partyCode) {
      toast.show('Please select a valid Customer Party from Party Master.', 'warning');
      return;
    }

    if (!refInvoiceNo || !refInvoiceNo.trim()) {
      toast.show('Ref Invoice / Invoice Bill No * is required (against which return is processed).', 'warning');
      return;
    }

    if (!returnNo || !returnNo.trim()) {
      toast.show('Return No * is mandatory.', 'warning');
      return;
    }

    if (isDmsReceived === 1 && (!strNo || !strNo.trim())) {
      toast.show('STR No. is mandatory when DMS Received is Yes.', 'warning');
      return;
    }

    const invalidItems = items.some((it) => !it.part_no.trim() || !it.part_name.trim() || it.qty <= 0);
    if (invalidItems) {
      toast.show('Please fill valid Part Number, Part Name, and positive Qty for all rows.', 'warning');
      return;
    }

    setLoading(true);
    const payload = {
      return_no: returnNo.trim(),
      ref_invoice_no: refInvoiceNo.trim(),
      return_date: returnDate,
      party_code: partyCode,
      party_name: partyName,
      remark_id: remarkId ? parseInt(remarkId, 10) : null,
      remark_name: remarkName,
      is_dms_received: isDmsReceived,
      str_no: strNo ? strNo.trim() : null,
      status: isDmsReceived === 1 ? 'DMS Received' : 'Pending DMS',
      internal_remarks: internalRemarks,
      attachment_url: attachmentUrl,
      items: items.map((it) => ({
        part_no: it.part_no.trim(),
        part_name: it.part_name.trim(),
        reference_invoice_no: it.reference_invoice_no ? it.reference_invoice_no.trim() : refInvoiceNo.trim(),
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
    <div className="space-y-4 pb-12">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold shadow-sm">
            <Undo2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-[#003366] tracking-tight">
              {isEdit ? 'Edit Material Return Entry' : 'New Material Return Entry'}
            </h2>
            <p className="text-xs text-slate-500 font-semibold">
              Process customer return goods, reference invoice matching &amp; DMS STR allocation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/return/register"
            className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Return Register
          </Link>
          <Link
            to="/return/dms-pending"
            className="px-3 py-2 rounded-xl text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
          >
            Pending DMS Queue
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Section 1: Header & Party Metadata */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#004C8F]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#003366]">
                1. Return Header &amp; Customer Details
              </h3>
            </div>
            {isDmsReceived === 1 ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> DMS Received: YES
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> DMS Received: NO (Pending)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Return No (Editable & triggers DMS Received = YES on entry) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase">
                  Return No <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={fetchNextReturnNo}
                  className="text-[10px] font-bold text-[#004C8F] hover:underline flex items-center gap-0.5 cursor-pointer"
                  title="Auto generate next sequence number"
                >
                  <Sparkles className="w-3 h-3" /> Auto
                </button>
              </div>
              <div className="relative">
                <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  placeholder="e.g. RET-20260914-0001 or DMS-RET-101"
                  value={returnNo}
                  onChange={(e) => handleReturnNoChange(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-[#003366] focus:ring-2 focus:ring-[#003366] focus:border-[#003366] focus:outline-hidden"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Entering Return No automatically activates <strong className="text-emerald-700">DMS Received: YES</strong>
              </p>
            </div>

            {/* Return Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Return Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="date"
                  required
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#003366] focus:outline-hidden"
                />
              </div>
            </div>

            {/* Customer Party Selection (From Party Master under Master Registries) */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Select Customer Party <span className="text-red-500">*</span> <span className="text-[10px] font-normal text-slate-500">(from Party Master)</span>
              </label>
              <SearchableSelect
                value={partyCode}
                onChange={handlePartyChange}
                placeholder="Search party by name or code..."
                searchPlaceholder="Type customer party name or code..."
                options={parties.map((p) => ({
                  value: p.party_code,
                  label: `${p.party_name} (${p.party_code})`,
                  sublabel: `Route: ${p.route_name || 'Direct'} • City: ${p.city || '—'}`,
                  badge: p.party_code
                }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            {/* Ref Invoice - (Jiske Against return honi hai) like in billing module as Invoice Bill No * */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Ref Invoice (Invoice Bill No) <span className="text-red-500">*</span>{' '}
                <span className="text-[10px] font-normal text-slate-500">
                  (Against which return is processed)
                </span>
              </label>
              <div className="relative">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Receipt className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 z-10" />
                    <input
                      type="text"
                      list="party-invoices-master-list"
                      required
                      placeholder={
                        partyCode
                          ? invoicesList.length > 0
                            ? 'Select or type Invoice / Bill No (e.g. RS/2026/012)...'
                            : 'Enter Ref Invoice Bill No...'
                          : 'Select Customer Party first...'
                      }
                      value={refInvoiceNo}
                      onChange={(e) => handleRefInvoiceSelect(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-[#003366] focus:ring-2 focus:ring-[#003366] focus:outline-hidden"
                    />
                    <datalist id="party-invoices-master-list">
                      {invoicesList.map((inv, i) => (
                        <option key={i} value={inv.bill_no}>
                          {`${inv.bill_no} — ₹${Number(inv.invoice_amount || 0).toLocaleString('en-IN')} (${inv.billing_date || 'Date N/A'})`}
                        </option>
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>

              {/* Invoice helper hint / badge */}
              {selectedInvoiceMeta ? (
                <div className="mt-1.5 flex items-center gap-2 text-[11px] bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    Matched Invoice: <strong>{selectedInvoiceMeta.bill_no}</strong> • Value: ₹{Number(selectedInvoiceMeta.invoice_amount || 0).toLocaleString('en-IN')} • Date: {selectedInvoiceMeta.billing_date}
                  </span>
                </div>
              ) : invoicesList.length > 0 ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                  <span className="font-semibold text-slate-600">Recent Invoices for Party:</span>
                  {invoicesList.slice(0, 3).map((inv, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleRefInvoiceSelect(inv.bill_no)}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono font-bold transition-colors cursor-pointer"
                    >
                      {inv.bill_no} (₹{inv.invoice_amount})
                    </button>
                  ))}
                </div>
              ) : partyCode ? (
                <p className="text-[10px] text-slate-400 mt-1">
                  Type the original Invoice / Bill Number if not listed in recent dispatches.
                </p>
              ) : null}
            </div>

            {/* Return Reason Master Dropdown */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Return Reason / Remark <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                value={remarkId}
                onChange={handleRemarkChange}
                placeholder="Select Return Reason..."
                searchPlaceholder="Search return reason..."
                options={remarksList.map((r) => ({
                  value: String(r.id),
                  label: `${r.name} (${r.code})`
                }))}
              />
            </div>

            {/* STR Number */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                DMS / STR Number{' '}
                {isDmsReceived === 1 ? (
                  <span className="text-red-500 font-bold">* (Mandatory)</span>
                ) : (
                  <span className="text-slate-400 font-normal">(Optional)</span>
                )}
              </label>
              <input
                type="text"
                placeholder={isDmsReceived === 1 ? 'Enter mandatory STR No...' : 'STR No. if available...'}
                required={isDmsReceived === 1}
                value={strNo}
                onChange={(e) => setStrNo(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#003366] focus:outline-hidden ${
                  isDmsReceived === 1
                    ? 'bg-amber-50/60 border border-amber-300 text-amber-900 placeholder:text-amber-400 font-mono'
                    : 'bg-white border border-slate-300 text-slate-800'
                }`}
              />
            </div>
          </div>

          {/* DMS Allocation Status Toggle Segment */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">DMS Allocation Mode:</span>
              <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsDmsReceived(0)}
                  className={`py-1 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isDmsReceived === 0
                      ? 'bg-white text-amber-700 shadow-xs border border-amber-300'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  NO (Pending DMS)
                </button>
                <button
                  type="button"
                  onClick={() => setIsDmsReceived(1)}
                  className={`py-1 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isDmsReceived === 1
                      ? 'bg-[#003366] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  YES (DMS Received)
                </button>
              </div>
            </div>

            <div className="text-[11px] text-slate-500">
              Current Flow:{' '}
              <strong className={isDmsReceived === 1 ? 'text-emerald-700' : 'text-amber-700'}>
                {isDmsReceived === 1 ? 'Direct DMS Received Record' : 'Pending DMS Reconciliation Queue'}
              </strong>
            </div>
          </div>
        </div>

        {/* Section 2: Multi-Part Return Items Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#003366]">
                2. Return Part Items &amp; Rate Calculation
              </h3>
            </div>
            <button
              type="button"
              onClick={addItemRow}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#003366] text-white text-xs font-bold hover:bg-[#004c8f] shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Part Row
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#003366] text-white font-extrabold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3 w-12 text-center">#</th>
                  <th className="p-3 min-w-[150px]">Part Number / Code *</th>
                  <th className="p-3 min-w-[200px]">Part Description / Name *</th>
                  <th className="p-3 min-w-[160px]">Reference Invoice No</th>
                  <th className="p-3 w-28 text-right">Return Qty *</th>
                  <th className="p-3 w-32 text-right">Rate (₹)</th>
                  <th className="p-3 w-36 text-right">Value (₹)</th>
                  <th className="p-3 w-16 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((row, idx) => (
                  <tr key={row.id || idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-2.5 text-center font-bold text-slate-400">{idx + 1}</td>
                    <td className="p-2.5">
                      <input
                        type="text"
                        required
                        placeholder="e.g. PRT-99201"
                        value={row.part_no}
                        onChange={(e) => handleItemChange(idx, 'part_no', e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg font-mono font-bold text-xs text-[#003366] focus:border-[#003366] focus:outline-hidden"
                      />
                    </td>
                    <td className="p-2.5">
                      <input
                        type="text"
                        required
                        placeholder="e.g. Brake Shoe Assembly Front"
                        value={row.part_name}
                        onChange={(e) => handleItemChange(idx, 'part_name', e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:border-[#003366] focus:outline-hidden"
                      />
                    </td>
                    <td className="p-2.5">
                      <input
                        type="text"
                        list="party-invoices-master-list"
                        placeholder="e.g. INV-2026-0881"
                        value={row.reference_invoice_no}
                        onChange={(e) => handleItemChange(idx, 'reference_invoice_no', e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 focus:border-[#003366] focus:outline-hidden"
                      />
                    </td>
                    <td className="p-2.5 text-right">
                      <input
                        type="number"
                        min="1"
                        required
                        value={row.qty}
                        onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                        className="w-full text-right px-2.5 py-1.5 border border-slate-200 rounded-lg font-bold text-xs text-slate-900 focus:border-[#003366] focus:outline-hidden"
                      />
                    </td>
                    <td className="p-2.5 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.rate}
                        onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                        className="w-full text-right px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:border-[#003366] focus:outline-hidden"
                      />
                    </td>
                    <td className="p-2.5 text-right font-mono font-bold text-xs text-emerald-700">
                      ₹{Number(row.value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeItemRow(idx)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Remove row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-xs text-slate-800">
                <tr>
                  <td colSpan={4} className="p-3 text-right uppercase tracking-wider text-[11px] text-slate-600">
                    Total Return Summary ({items.length} Parts):
                  </td>
                  <td className="p-3 text-right font-black text-sm text-[#003366]">{totalQty} Units</td>
                  <td className="p-3 text-right text-slate-500">—</td>
                  <td className="p-3 text-right font-black text-sm text-emerald-700">
                    ₹{totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Section 3: Internal Remarks & Attachments */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-2">
            <label className="block text-[11px] font-bold text-slate-600 uppercase">
              Internal Notes / Inspection Remarks
            </label>
            <textarea
              rows={3}
              placeholder="Enter quality inspection remarks, damages observed, or warehouse notes..."
              value={internalRemarks}
              onChange={(e) => setInternalRemarks(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-[#003366] focus:outline-hidden resize-none"
            />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-2 flex flex-col justify-between">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Document / Photo Attachment URL
              </label>
              <div className="relative">
                <Upload className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="https://... or Document Reference ID"
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-[#003366] focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span className="font-semibold">Current DMS Status:</span>
              <span
                className={`px-2 py-0.5 rounded-md font-bold uppercase text-[10px] ${
                  isDmsReceived === 1 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {isDmsReceived === 1 ? 'DMS Received' : 'Pending DMS'}
              </span>
            </div>
          </div>
        </div>

        {/* Form Actions Footer */}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleReset}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Form
          </button>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-[#003366] hover:bg-[#004c8f] shadow-md border-r-4 border-[#ed1c24] transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {loading ? 'Saving Return Entry...' : isEdit ? 'Update Return Entry' : 'Save & Submit Return'}
          </button>
        </div>
      </form>
    </div>
  );
}
