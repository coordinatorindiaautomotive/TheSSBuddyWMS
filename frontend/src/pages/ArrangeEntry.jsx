import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import SearchableSelect from '../components/SearchableSelect';
import {
  Boxes,
  Save,
  RotateCcw,
  Plus,
  Trash2,
  Printer,
  FileCheck,
  Calendar,
  Layers,
  FileText,
  AlertCircle,
  Hash,
  ArrowRight,
  ClipboardList,
  CheckCircle2,
  Users,
  Store,
  Warehouse as WarehouseIcon,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';

export default function ArrangeEntry() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { activeWarehouse } = useAuth();

  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [parties, setParties] = useState([]);
  const [teamsList, setTeamsList] = useState([]);

  // Form State
  const [arrangeNo, setArrangeNo] = useState('');
  const [arrangeDate, setArrangeDate] = useState(new Date().toISOString().slice(0, 10));
  const [stiNo, setStiNo] = useState('');
  const [strNo, setStrNo] = useState('');
  const [teamId, setTeamId] = useState('');
  const [teamName, setTeamName] = useState('');
  const [arrangeFor, setArrangeFor] = useState('Party'); // 'Party', 'Retail Outlet', 'Stock'
  const [destinationCode, setDestinationCode] = useState('');
  const [destinationName, setDestinationName] = useState('');
  const [remarks, setRemarks] = useState('');

  // Multi-part table rows
  const [items, setItems] = useState([
    { id: 1, part_no: '', part_name: '', required_qty: 1, available_qty: 25, remarks: '' }
  ]);

  const totalRequiredQty = items.reduce((acc, row) => acc + (parseInt(row.required_qty, 10) || 0), 0);

  useEffect(() => {
    fetchMasters();
    if (isEdit) {
      fetchArrangeData(id);
    } else {
      fetchNextArrangeNo();
    }
  }, [id, activeWarehouse]);

  const fetchMasters = async () => {
    try {
      const [pRes, tRes] = await Promise.all([
        axios.get('/api/parties'),
        axios.get('/api/masters/arrange-teams')
      ]);
      setParties(pRes.data || []);
      setTeamsList(tRes.data || []);
    } catch (err) {
      console.error('Error fetching masters:', err);
    }
  };

  const fetchNextArrangeNo = async () => {
    try {
      const res = await axios.get('/api/arranges/suggest-next-no');
      if (res.data?.suggestedNo) {
        setArrangeNo(res.data.suggestedNo);
      }
    } catch (err) {
      console.error('Error getting arrange no:', err);
    }
  };

  const fetchArrangeData = async (arrId) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/arranges/${arrId}`);
      const arr = res.data;
      setArrangeNo(arr.arrange_no || '');
      setArrangeDate(arr.arrange_date || new Date().toISOString().slice(0, 10));
      setStiNo(arr.sti_no || '');
      setStrNo(arr.str_no || '');
      setTeamId(arr.arrange_by_team_id ? String(arr.arrange_by_team_id) : '');
      setTeamName(arr.arrange_by_team_name || '');
      setArrangeFor(arr.arrange_for || 'Party');
      setDestinationCode(arr.destination_code || '');
      setDestinationName(arr.destination_name || '');
      setRemarks(arr.remarks || '');

      if (arr.items && arr.items.length > 0) {
        setItems(
          arr.items.map((it, idx) => ({
            id: idx + 1,
            part_no: it.part_no || '',
            part_name: it.part_name || '',
            required_qty: it.required_qty || 1,
            available_qty: it.available_qty !== undefined ? it.available_qty : 20,
            remarks: it.remarks || ''
          }))
        );
      }
    } catch (err) {
      toast.show('Failed to load arrange details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTeamChange = (val) => {
    setTeamId(val);
    const selected = teamsList.find((t) => String(t.id) === String(val));
    if (selected) {
      setTeamName(selected.team_name);
    } else {
      setTeamName('');
    }
  };

  const handleDestinationChange = (val) => {
    setDestinationCode(val);
    if (arrangeFor === 'Stock') {
      setDestinationName('Warehouse Internal Stock Replenishment');
      return;
    }
    const selected = parties.find((p) => p.party_code === val);
    if (selected) {
      setDestinationName(selected.party_name);
    } else {
      setDestinationName(val);
    }
  };

  const handleArrangeForChange = (type) => {
    setArrangeFor(type);
    if (type === 'Stock') {
      setDestinationCode('STOCK-WH');
      setDestinationName('Warehouse Floor Stock Arrangement');
    } else {
      setDestinationCode('');
      setDestinationName('');
    }
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const addItemRow = () => {
    setItems([
      ...items,
      { id: Date.now(), part_no: '', part_name: '', required_qty: 1, available_qty: 15, remarks: '' }
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
      fetchNextArrangeNo();
      setStiNo('');
      setStrNo('');
      setTeamId('');
      setTeamName('');
      setArrangeFor('Party');
      setDestinationCode('');
      setDestinationName('');
      setRemarks('');
      setItems([{ id: 1, part_no: '', part_name: '', required_qty: 1, available_qty: 20, remarks: '' }]);
    } else {
      fetchArrangeData(id);
    }
    toast.show('Form reset to default values.', 'info');
  };

  const handleSubmit = async (e, convertImmediately = false) => {
    if (e) e.preventDefault();

    if (!stiNo || !stiNo.trim()) {
      toast.show('STI Number is mandatory.', 'warning');
      return;
    }

    if (!strNo || !strNo.trim()) {
      toast.show('DMS Receipt / STR Number is mandatory.', 'warning');
      return;
    }

    if (arrangeFor !== 'Stock' && (!destinationCode || !destinationCode.trim())) {
      toast.show(`Please select a valid ${arrangeFor} destination.`, 'warning');
      return;
    }

    const invalidItems = items.some((it) => !it.part_no.trim() || !it.part_name.trim() || it.required_qty <= 0);
    if (invalidItems) {
      toast.show('Please fill valid Part Number, Part Name, and positive Required Qty for all rows.', 'warning');
      return;
    }

    setLoading(true);
    const payload = {
      arrange_no: arrangeNo,
      arrange_date: arrangeDate,
      sti_no: stiNo.trim(),
      str_no: strNo.trim(),
      arrange_by_team_id: teamId ? parseInt(teamId, 10) : null,
      arrange_by_team_name: teamName || null,
      arrange_for: arrangeFor,
      destination_code: destinationCode,
      destination_name: destinationName,
      status: 'Created',
      remarks,
      items: items.map((it) => ({
        part_no: it.part_no.trim(),
        part_name: it.part_name.trim(),
        required_qty: parseInt(it.required_qty, 10) || 1,
        available_qty: parseInt(it.available_qty, 10) || 0,
        remarks: (it.remarks || '').trim()
      }))
    };

    try {
      let arrangeId = id;
      if (isEdit) {
        await axios.put(`/api/arranges/${id}`, payload);
        toast.show('Arrange entry updated successfully!', 'success');
      } else {
        const res = await axios.post('/api/arranges', payload);
        arrangeId = res.data.id;
        toast.show('Arrange entry saved successfully!', 'success');
      }

      if (convertImmediately && arrangeId) {
        // Convert to Pick Ticket right away
        const convRes = await axios.post(`/api/arranges/${arrangeId}/convert-to-pick-ticket`);
        toast.show(convRes.data.message || 'Pick Ticket generated successfully!', 'success');
        navigate(`/arrange/view/${arrangeId}`);
      } else {
        navigate(`/arrange/view/${arrangeId}`);
      }
    } catch (err) {
      console.error('Save arrange error:', err);
      toast.show(err.response?.data?.message || 'Error saving arrange record.', 'error');
    } finally {
      setLoading(false);
    }
  };

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
              {isEdit ? 'Edit Material Arrangement Entry' : 'New Material Arrangement Entry'}
            </h2>
            <p className="text-xs text-slate-500 font-semibold">
              Track STI requisition, DMS STR confirmation, team allocation &amp; pick ticket generation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/arrange/register"
            className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            Arrange Register
          </Link>
          <Link
            to="/arrange/reports"
            className="px-3 py-2 rounded-xl text-xs font-bold text-[#004C8F] bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer"
          >
            Fulfillment Velocity
          </Link>
        </div>
      </div>

      {/* Visual Lifecycle Progress Indicator */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between text-xs font-bold text-slate-400">
          <div className="flex items-center gap-2 text-[#003366]">
            <span className="w-6 h-6 rounded-full bg-[#003366] text-white flex items-center justify-center text-[11px] font-bold">1</span>
            <span>Arrange Entry</span>
          </div>
          <div className="flex-1 h-0.5 bg-slate-200 mx-3"></div>
          <div className="flex items-center gap-2 text-slate-400">
            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[11px] font-bold">2</span>
            <span>Generate Pick Ticket</span>
          </div>
          <div className="flex-1 h-0.5 bg-slate-200 mx-3"></div>
          <div className="flex items-center gap-2 text-slate-400">
            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[11px] font-bold">3</span>
            <span>Billing Invoice</span>
          </div>
          <div className="flex-1 h-0.5 bg-slate-200 mx-3"></div>
          <div className="flex items-center gap-2 text-slate-400">
            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[11px] font-bold">4</span>
            <span>Dispatched</span>
          </div>
        </div>
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
        {/* Section 1: Header Requisition Information */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Layers className="w-4 h-4 text-[#004C8F]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#003366]">
              1. Arrangement Requisition &amp; Mandatory Numbers
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Auto Arrange No */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Arrange No <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  readOnly
                  value={arrangeNo}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-[#003366]"
                />
              </div>
            </div>

            {/* Arrange Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Arrange Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="date"
                  required
                  value={arrangeDate}
                  onChange={(e) => setArrangeDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-[#003366] focus:outline-hidden"
                />
              </div>
            </div>

            {/* Mandatory STI Number */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                STI Number <span className="text-red-500">* (Mandatory)</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. STI-2026-8801"
                value={stiNo}
                onChange={(e) => setStiNo(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-[#003366] focus:ring-2 focus:ring-[#003366] focus:outline-hidden"
              />
            </div>

            {/* Mandatory DMS Receipt / STR Number */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                DMS Receipt / STR No <span className="text-red-500">* (Mandatory)</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. STR-2026-1049"
                value={strNo}
                onChange={(e) => setStrNo(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-amber-900 focus:ring-2 focus:ring-[#003366] focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            {/* Arrange By Team (Dropdown from Master) */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Arrange By Team (Master)
              </label>
              <SearchableSelect
                value={teamId}
                onChange={handleTeamChange}
                placeholder="Select Arrangement Team..."
                options={teamsList.map((t) => ({
                  value: String(t.id),
                  label: `${t.team_name} (${t.team_code})`
                }))}
              />
            </div>

            {/* Arrange For Segmented Selector */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Arrange For Destination Type <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
                {['Party', 'Retail Outlet', 'Stock'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleArrangeForChange(t)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center ${
                      arrangeFor === t
                        ? 'bg-[#003366] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Destination Selector / Field */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                {arrangeFor === 'Party'
                  ? 'Select Customer Party *'
                  : arrangeFor === 'Retail Outlet'
                  ? 'Select Retail Outlet *'
                  : 'Stock Arrangement Location'}
              </label>
              {arrangeFor === 'Stock' ? (
                <input
                  type="text"
                  readOnly
                  value="Warehouse Internal Stock Replenishment"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700"
                />
              ) : (
                <SearchableSelect
                  value={destinationCode}
                  onChange={handleDestinationChange}
                  placeholder={`Search ${arrangeFor} by name or code...`}
                  options={parties.map((p) => ({
                    value: p.party_code,
                    label: `${p.party_name} (${p.party_code})`,
                    subtext: `Route: ${p.route_name || 'Direct'}`
                  }))}
                />
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Multi-Part Table with Stock Check */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-[#004C8F]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#003366]">
                2. Part Items &amp; Real-Time Stock Check
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
                  <th className="p-3 min-w-[160px]">Part Number *</th>
                  <th className="p-3 min-w-[220px]">Part Description *</th>
                  <th className="p-3 w-32 text-right">Required Qty *</th>
                  <th className="p-3 w-36 text-center">Available Stock</th>
                  <th className="p-3 min-w-[160px]">Item Remarks</th>
                  <th className="p-3 w-16 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((row, idx) => {
                  const reqQ = parseInt(row.required_qty, 10) || 0;
                  const availQ = parseInt(row.available_qty, 10) || 0;
                  const isSufficient = availQ >= reqQ;

                  return (
                    <tr key={row.id || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-2.5 text-center font-bold text-slate-400">{idx + 1}</td>
                      <td className="p-2.5">
                        <input
                          type="text"
                          required
                          placeholder="e.g. PRT-55102"
                          value={row.part_no}
                          onChange={(e) => handleItemChange(idx, 'part_no', e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg font-mono font-bold text-xs text-[#003366] focus:border-[#003366] focus:outline-hidden"
                        />
                      </td>
                      <td className="p-2.5">
                        <input
                          type="text"
                          required
                          placeholder="e.g. Clutch Plate Disc 190mm"
                          value={row.part_name}
                          onChange={(e) => handleItemChange(idx, 'part_name', e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:border-[#003366] focus:outline-hidden"
                        />
                      </td>
                      <td className="p-2.5 text-right">
                        <input
                          type="number"
                          min="1"
                          required
                          value={row.required_qty}
                          onChange={(e) => handleItemChange(idx, 'required_qty', e.target.value)}
                          className="w-full text-right px-2.5 py-1.5 border border-slate-200 rounded-lg font-bold text-xs text-slate-900 focus:border-[#003366] focus:outline-hidden"
                        />
                      </td>
                      <td className="p-2.5 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            isSufficient
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          {isSufficient ? 'In Stock' : 'Low / Alert'} ({availQ} Avail)
                        </span>
                      </td>
                      <td className="p-2.5">
                        <input
                          type="text"
                          placeholder="Bin / Location / Notes"
                          value={row.remarks}
                          onChange={(e) => handleItemChange(idx, 'remarks', e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-700 focus:border-[#003366] focus:outline-hidden"
                        />
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
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-xs text-slate-800">
                <tr>
                  <td colSpan={3} className="p-3 text-right uppercase tracking-wider text-[11px] text-slate-600">
                    Total Required Arrangement Units ({items.length} Parts):
                  </td>
                  <td className="p-3 text-right font-black text-sm text-[#003366]">{totalRequiredQty} Units</td>
                  <td colSpan={3} className="p-3 text-slate-500"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Section 3: General Remarks */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-2">
          <label className="block text-[11px] font-bold text-slate-600 uppercase">
            Special Arrangement Instructions / Warehouse Notes
          </label>
          <textarea
            rows={2}
            placeholder="Enter instructions for picking team, staging floor notes, or urgent priority details..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full p-3 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-[#003366] focus:outline-hidden resize-none"
          />
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
            Reset
          </button>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Save Arrange Only
          </button>

          <button
            type="button"
            onClick={(e) => handleSubmit(e, true)}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-[#003366] hover:bg-[#004c8f] shadow-md border-r-4 border-[#ed1c24] transition-all cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-cyan-300" />
            {loading ? 'Processing...' : 'Save & Generate Pick Ticket'}
          </button>
        </div>
      </form>
    </div>
  );
}
