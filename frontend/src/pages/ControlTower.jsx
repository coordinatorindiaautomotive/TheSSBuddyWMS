import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Radio, RefreshCw, CheckCircle, Clock, Truck } from 'lucide-react';

export default function ControlTower() {
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/dispatches');
      setDispatches(res.data || []);
    } catch (err) {
      console.error('Control tower fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#003366] tracking-tight">
            Logistics Control Tower
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Real-time visual monitoring of active delivery fleets, vehicle progress, and warehouse departures.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="btn-secondary text-xs h-9"
          title="Refresh Live Stream"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Live Status</span>
        </button>
      </div>

      {/* Control Tower Grid */}
      {dispatches.length === 0 ? (
        <div className="card-enterprise p-12 text-center text-slate-400 font-medium text-xs">
          No active dispatch missions currently tracked in the control tower.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dispatches.map((d) => {
            const percent = d.total_cartons > 0 ? Math.round((d.scanned_cartons / d.total_cartons) * 100) : 0;
            return (
              <div key={d.id} className="card-enterprise p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-mono font-bold text-xs text-[#004C8F]">{d.dispatch_no}</span>
                  <span className={`badge-status ${
                    d.status === 'Completed' || d.status === 'Delivered'
                      ? 'badge-success'
                      : d.status === 'In Transit'
                      ? 'badge-warning'
                      : 'badge-info'
                  }`}>
                    {d.status}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Driver:</span>
                    <span className="font-semibold text-slate-800">{d.driver_name || 'Unassigned'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Vehicle:</span>
                    <span className="font-mono font-semibold text-slate-800">{d.vehicle_number || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cartons Scanned:</span>
                    <span className="font-semibold text-[#004C8F]">
                      {d.scanned_cartons || 0} / {d.total_cartons || 0} ({percent}%)
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                  <div
                    className="bg-[#004C8F] h-2 transition-all duration-300 rounded-full"
                    style={{ width: `${percent}%` }}
                  ></div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                  <span className="text-[11px] text-slate-400">
                    {d.created_at ? new Date(d.created_at).toLocaleTimeString() : 'Active'}
                  </span>
                  <span className="font-bold text-emerald-700">
                    ₹{Number(d.total_amount || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

