import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Truck, Eye, Plus, Search, RotateCcw } from 'lucide-react';

export default function DispatchList() {
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchDispatches();
  }, []);

  const fetchDispatches = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/dispatches');
      setDispatches(res.data || []);
    } catch (err) {
      console.error('Error loading dispatches:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredDispatches = dispatches.filter(d =>
    !search ||
    (d.dispatch_no && d.dispatch_no.toLowerCase().includes(search.toLowerCase())) ||
    (d.driver_name && d.driver_name.toLowerCase().includes(search.toLowerCase())) ||
    (d.vehicle_number && d.vehicle_number.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#003366] tracking-tight">
            Dispatch Trip Management
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Monitor, scan, and track active warehouse dispatch trips and transport manifests.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchDispatches}
            className="btn-secondary text-xs h-9"
            title="Refresh Trips"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Refresh</span>
          </button>
          <Link
            to="/dispatch/plan"
            className="btn-primary text-xs h-9 gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>New Dispatch Trip</span>
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card-enterprise p-3 flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Dispatch Trip No, Driver, Vehicle..."
            className="input-enterprise pl-9 h-9 text-xs"
          />
        </div>
        <span className="text-xs font-semibold text-slate-500">
          Total Trips: <strong className="text-slate-800">{filteredDispatches.length}</strong>
        </span>
      </div>

      {/* Dispatches Table */}
      <div className="card-enterprise overflow-hidden">
        <div className="table-responsive-wrapper">
          <table className="table-enterprise">
            <thead>
              <tr>
                <th>Dispatch Trip No</th>
                <th>Assigned Driver</th>
                <th>Vehicle Number</th>
                <th className="text-center">Cartons (Scanned / Total)</th>
                <th className="text-right">Total Invoice Value</th>
                <th className="text-center">Trip Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 font-medium">
                    Loading dispatch trips...
                  </td>
                </tr>
              ) : filteredDispatches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 font-medium">
                    No dispatch trips found. Create a new dispatch trip from the workbench.
                  </td>
                </tr>
              ) : (
                filteredDispatches.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <span className="font-mono font-bold text-[#004C8F] text-xs">
                        {d.dispatch_no}
                      </span>
                    </td>
                    <td>
                      <div className="font-semibold text-slate-800 text-xs">{d.driver_name || 'Unassigned'}</div>
                    </td>
                    <td>
                      <span className="font-mono text-xs font-semibold text-slate-700">{d.vehicle_number || 'N/A'}</span>
                    </td>
                    <td className="text-center">
                      <span className="font-bold text-xs text-slate-800">
                        {d.scanned_cartons || 0}
                      </span>
                      <span className="text-slate-400 text-xs"> / {d.total_cartons || 0}</span>
                    </td>
                    <td className="text-right font-bold text-xs text-emerald-700">
                      ₹{Number(d.total_amount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="text-center">
                      <span className={`badge-status ${
                        d.status === 'Completed' || d.status === 'Delivered'
                          ? 'badge-success'
                          : d.status === 'In Transit'
                          ? 'badge-warning'
                          : 'badge-info'
                      }`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="text-right">
                      <Link
                        to={`/dispatch/${d.id}`}
                        className="btn-secondary h-8 px-2.5 text-xs text-[#004C8F] border-slate-300 font-bold inline-flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View &amp; Scan</span>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

