import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Truck, Plus } from 'lucide-react';

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [vehicleNo, setVehicleNo] = useState('');
  const [capacity, setCapacity] = useState('7.5');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const res = await axios.get('/api/masters/vehicles');
      setVehicles(res.data);
    } catch (err) {
      console.error('Error fetching vehicles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/masters/vehicles', {
        vehicle_number: vehicleNo,
        capacity_tons: capacity
      });
      setShowModal(false);
      setVehicleNo('');
      fetchVehicles();
    } catch (err) {
      console.error('Error adding vehicle:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-600/30"
        >
          <Plus className="w-4 h-4" />
          Add New Vehicle
        </button>
      </div>

      <div className="glass-panel p-6 rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="p-3">Vehicle Number</th>
                <th className="p-3">Driver Assigned</th>
                <th className="p-3">Capacity (Tons)</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {vehicles.map((v) => (
                <tr key={v.id} className="hover:bg-slate-800/40">
                  <td className="p-3 font-bold text-indigo-400">{v.vehicle_number}</td>
                  <td className="p-3 font-medium text-white">{v.driver_name || 'Unassigned'}</td>
                  <td className="p-3 font-semibold">{v.capacity_tons} Tons</td>
                  <td className="p-3">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                      v.status === 'In Transit' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {v.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="glass-panel p-6 rounded-2xl w-full max-w-md border border-slate-700 space-y-4">
            <h3 className="text-base font-bold text-white">Add New Fleet Vehicle</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Vehicle Number</label>
                <input
                  type="text"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                  required
                  placeholder="DL-01-AB-9988"
                  className="w-full glass-input p-2.5 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Capacity (Tons)</label>
                <input
                  type="number"
                  step="0.5"
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                  className="w-full glass-input p-2.5 rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                >
                  Save Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
