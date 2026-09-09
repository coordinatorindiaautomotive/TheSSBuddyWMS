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
  Square
} from 'lucide-react';

export default function DispatchPlanning() {
  const toast = useToast();
  const [data, setData] = useState({ routes: [], drivers: [], vehicles: [], pendingBillings: [] });
  const [selectedBills, setSelectedBills] = useState([]);
  const [driverId, setDriverId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [routeFilter, setRouteFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPlanningData();
  }, []);

  const fetchPlanningData = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/dispatch-planning/data');
      setData(res.data);
      if (res.data.drivers?.length > 0) setDriverId(res.data.drivers[0].id.toString());
      if (res.data.vehicles?.length > 0) setVehicleId(res.data.vehicles[0].id.toString());
    } catch (err) {
      console.error('Error loading planning data:', err);
      toast.error('Failed to load dispatch planning data.');
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = useMemo(() => {
    return (data.pendingBillings || []).filter((b) => {
      const matchesSearch =
        !searchQuery ||
        (b.bill_no && b.bill_no.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (b.party_name && b.party_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (b.party_code && b.party_code.toLowerCase().includes(searchQuery.toLowerCase()));

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

  // Live Summary Calculation
  const selectedSummary = useMemo(() => {
    const selectedObjects = (data.pendingBillings || []).filter((b) => selectedBills.includes(b.id));
    const count = selectedObjects.length;
    const cartons = selectedObjects.reduce((acc, b) => acc + (Number(b.total_cartons) || 1), 0);
    const units = selectedObjects.reduce((acc, b) => acc + (Number(b.billed_qty) || Number(b.qty_in_pick_ticket) || 0), 0);
    const amount = selectedObjects.reduce((acc, b) => acc + (Number(b.invoice_amount) || 0), 0);
    return { count, cartons, units, amount };
  }, [data.pendingBillings, selectedBills]);

  const selectedVehicleObj = useMemo(() => {
    return (data.vehicles || []).find((v) => v.id.toString() === vehicleId.toString());
  }, [data.vehicles, vehicleId]);

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

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-1/4"></div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-slate-200 rounded-xl"></div>
          <div className="h-96 bg-slate-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#003366] tracking-tight">
            Dispatch Planning Workbench
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Create an operational dispatch trip by selecting pending invoices and assigning vehicle resources.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPlanningData}
            className="btn-secondary text-xs h-9"
            title="Refresh Invoices"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Pending Invoices Selection Table */}
        <div className="lg:col-span-2 space-y-3">
          {/* Filter Bar */}
          <div className="card-enterprise p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Invoice Bill No, Party Name or Code..."
                  className="input-enterprise pl-9 h-9 text-xs"
                />
              </div>

              {uniqueRoutes.length > 0 && (
                <select
                  value={routeFilter}
                  onChange={(e) => setRouteFilter(e.target.value)}
                  className="input-enterprise w-40 h-9 text-xs font-medium shrink-0"
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
              onClick={toggleSelectAll}
              className="btn-secondary h-9 text-xs shrink-0"
            >
              {selectedBills.length === filteredInvoices.length && filteredInvoices.length > 0 ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-[#004C8F]" />
                  <span>Deselect All</span>
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5 text-slate-500" />
                  <span>Select All ({filteredInvoices.length})</span>
                </>
              )}
            </button>
          </div>

          {/* Pending Invoices Table */}
          <div className="card-enterprise overflow-hidden">
            <div className="table-responsive-wrapper max-h-[520px]">
              <table className="table-enterprise">
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th className="w-12 text-center whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedBills.length === filteredInvoices.length && filteredInvoices.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 text-[#004C8F] focus:ring-[#004C8F]"
                      />
                    </th>
                    <th className="whitespace-nowrap">Invoice / Bill No</th>
                    <th className="whitespace-nowrap min-w-[180px]">Customer Party</th>
                    <th className="whitespace-nowrap">Route</th>
                    <th className="text-right whitespace-nowrap">Cartons</th>
                    <th className="text-right whitespace-nowrap">Invoice Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400 font-medium">
                        No pending unassigned invoices available for dispatch.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((b) => {
                      const isSelected = selectedBills.includes(b.id);
                      return (
                        <tr
                          key={b.id}
                          onClick={() => toggleBillSelect(b.id)}
                          className={`cursor-pointer ${isSelected ? 'bg-blue-50/70 font-semibold' : ''}`}
                        >
                          <td className="text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleBillSelect(b.id)}
                              className="rounded border-slate-300 text-[#004C8F] focus:ring-[#004C8F]"
                            />
                          </td>
                          <td className="whitespace-nowrap">
                            <span className="font-mono font-bold text-[#004C8F] text-xs whitespace-nowrap">
                              {b.bill_no}
                            </span>
                          </td>
                          <td>
                            <div className="font-semibold text-slate-800 text-xs">{b.party_name}</div>
                            <span className="text-[11px] font-mono text-slate-500">{b.party_code}</span>
                          </td>
                          <td className="whitespace-nowrap">
                            <span className="text-xs text-slate-600 font-medium">
                              {b.route_name || 'Direct Route'}
                            </span>
                          </td>
                          <td className="text-right font-medium text-xs text-slate-700 whitespace-nowrap">
                            {b.total_cartons || 1}
                          </td>
                          <td className="text-right font-bold text-xs text-emerald-700 whitespace-nowrap">
                            ₹{Number(b.invoice_amount || 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <span>Showing {filteredInvoices.length} of {data.pendingBillings?.length || 0} invoices</span>
              <span className="font-semibold text-[#003366]">
                {selectedBills.length} Selected for Trip
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Trip Assignment & Live Summary Card */}
        <div className="space-y-4">
          <form onSubmit={handleCreateTrip} className="card-enterprise p-5 space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-[#003366] flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#004C8F]" />
                Trip Resource Assignment
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Assign fleet driver and vehicle to manifest this trip</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Assigned Driver <span className="text-red-500">*</span>
              </label>
              <select
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
                className="input-enterprise text-xs font-semibold"
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
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Assigned Vehicle <span className="text-red-500">*</span>
              </label>
              <select
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="input-enterprise text-xs font-semibold"
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
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                Trip Instructions / Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full input-enterprise h-auto py-2 text-xs"
                placeholder="Enter dispatch notes or special delivery instructions..."
              />
            </div>

            {/* Live Selected Invoice Summary Checkpoint */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 pb-1.5 flex items-center justify-between">
                <span>Trip Load Summary</span>
                <span className="text-[#004C8F] font-extrabold">{selectedSummary.count} Invoices</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Total Cartons</span>
                  <span className="font-bold text-slate-800 text-sm">{selectedSummary.cartons}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Total Units</span>
                  <span className="font-bold text-slate-800 text-sm">{selectedSummary.units}</span>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-2 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600">Total Billed Value:</span>
                <span className="font-extrabold text-sm text-emerald-700">
                  ₹{selectedSummary.amount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || selectedBills.length === 0}
              className="btn-primary w-full h-10 text-xs font-bold uppercase tracking-wider"
            >
              <Plus className="w-4 h-4" />
              {submitting ? 'Generating Trip...' : 'Create Dispatch Trip'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

