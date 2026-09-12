import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import SearchableSelect from '../components/SearchableSelect';
import { MapPin, CheckCircle, XCircle, Clock, FileCheck, RotateCcw } from 'lucide-react';

export default function DeliveryBoard() {
  const toast = useToast();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [status, setStatus] = useState('Delivered');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchDeliveries();
  }, []);

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/delivery');
      setDeliveries(res.data || []);
    } catch (err) {
      console.error('Error fetching deliveries:', err);
      toast.error('Failed to load delivery board records.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!selectedDelivery) return;
    try {
      await axios.put(`/api/delivery/${selectedDelivery.id}/status`, {
        status,
        pod_notes: notes,
        pod_signature: 'DIGITAL_SIG_CONFIRMED'
      });
      toast.success('Proof of Delivery (POD) updated successfully!');
      setSelectedDelivery(null);
      setNotes('');
      fetchDeliveries();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error updating delivery status.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#003366] tracking-tight">
            Proof of Delivery (POD) Board
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Log, verify, and acknowledge customer delivery completions and digital signatures.
          </p>
        </div>
        <button
          onClick={fetchDeliveries}
          className="btn-secondary text-xs h-9"
          title="Refresh Deliveries"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="card-enterprise overflow-hidden">
        <div className="table-responsive-wrapper">
          <table className="table-enterprise">
            <thead>
              <tr>
                <th>Customer Party</th>
                <th>Dispatch Trip No</th>
                <th>Bill / Invoice No</th>
                <th>Assigned Driver</th>
                <th className="text-right">Invoice Amount</th>
                <th className="text-center">Delivery Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 font-medium">
                    Loading delivery records...
                  </td>
                </tr>
              ) : deliveries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400 font-medium">
                    No active delivery trips found.
                  </td>
                </tr>
              ) : (
                deliveries.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div className="font-semibold text-slate-900 text-xs">{d.party_name}</div>
                    </td>
                    <td>
                      <span className="font-mono font-bold text-xs text-[#004C8F]">{d.dispatch_no}</span>
                    </td>
                    <td>
                      <span className="font-mono text-xs text-slate-700">{d.bill_no}</span>
                    </td>
                    <td>
                      <span className="text-xs text-slate-700 font-medium">{d.driver_name || 'N/A'}</span>
                    </td>
                    <td className="text-right font-bold text-xs text-emerald-700">
                      ₹{Number(d.invoice_amount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="text-center">
                      <span className={`badge-status ${
                        d.status === 'Delivered'
                          ? 'badge-success'
                          : d.status === 'Failed'
                          ? 'badge-danger'
                          : 'badge-warning'
                      }`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => { setSelectedDelivery(d); setStatus(d.status || 'Delivered'); setNotes(d.pod_notes || ''); }}
                        className="btn-secondary h-8 px-2.5 text-xs text-[#004C8F] font-bold inline-flex items-center gap-1"
                      >
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>Update POD</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Update POD Modal */}
      {selectedDelivery && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="card-enterprise w-full max-w-md p-6 space-y-4 shadow-xl">
            <div>
              <h3 className="text-base font-bold text-[#003366]">Update Proof of Delivery (POD)</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Party: <strong className="text-slate-800">{selectedDelivery.party_name}</strong> ({selectedDelivery.bill_no})
              </p>
            </div>

            <form onSubmit={handleUpdateStatus} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Delivery Status
                </label>
                <SearchableSelect
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  options={[
                    { value: 'Delivered', label: 'Delivered (Success)' },
                    { value: 'Partial', label: 'Partial Delivery' },
                    { value: 'Failed', label: 'Failed / Rejected' }
                  ]}
                  minSearchItems={10}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  POD Notes / Receiver Remarks
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full input-enterprise h-auto py-2 text-xs"
                  placeholder="Enter receiver name, phone or delivery remarks..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedDelivery(null)}
                  className="btn-secondary text-xs h-9"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs h-9"
                >
                  Save Delivery POD
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

