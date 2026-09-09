import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import { Truck, Barcode, ArrowLeft, CheckCircle2, QrCode, Clock, Check } from 'lucide-react';

export default function DispatchDetail() {
  const { id } = useParams();
  const toast = useToast();
  const [dispatch, setDispatch] = useState(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDispatch();
  }, [id]);

  const fetchDispatch = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/dispatches/${id}`);
      setDispatch(res.data);
    } catch (err) {
      console.error('Error loading dispatch details:', err);
      toast.error('Failed to load dispatch details.');
    } finally {
      setLoading(false);
    }
  };

  const handleScanBarcode = async (e) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    try {
      const res = await axios.post(`/api/dispatches/${id}/scan`, { barcode_no: barcodeInput.trim() });
      toast.success(res.data.message || 'Carton verified successfully!');
      setBarcodeInput('');
      fetchDispatch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Carton scan error.');
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-slate-500 font-medium">Loading Dispatch Trip Details...</div>;
  }
  if (!dispatch) {
    return <div className="text-center py-12 text-red-600 font-semibold">Dispatch Trip Not Found.</div>;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link to="/dispatch" className="btn-secondary h-9 w-9 p-0 rounded-lg" title="Back to Dispatches">
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[#003366] flex items-center gap-2">
              <Truck className="w-5 h-5 text-[#004C8F]" />
              Dispatch Trip: {dispatch.dispatch_no}
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Assigned Driver: <strong className="text-slate-800">{dispatch.driver_name || 'Unassigned'}</strong> &bull; Vehicle: <strong className="text-slate-800">{dispatch.vehicle_number || 'N/A'}</strong>
            </p>
          </div>
        </div>
        <span className={`badge-status ${
          dispatch.status === 'Completed' || dispatch.status === 'Delivered'
            ? 'badge-success'
            : dispatch.status === 'In Transit'
            ? 'badge-warning'
            : 'badge-info'
        }`}>
          {dispatch.status}
        </span>
      </div>

      {/* Barcode Scanner Verification Card */}
      <div className="card-enterprise p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-[#003366]">
          <QrCode className="w-4 h-4 text-[#004C8F]" />
          Carton Barcode Verification Scanner
        </div>

        <form onSubmit={handleScanBarcode} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Barcode className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Scan or type carton barcode (e.g. CTN-1001-1-1)..."
              className="input-enterprise pl-9 text-xs"
            />
          </div>
          <button
            type="submit"
            className="btn-primary h-10 text-xs shrink-0"
          >
            Verify Carton
          </button>
        </form>
      </div>

      {/* Carton Inspection Grid */}
      <div className="card-enterprise p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Carton Barcodes ({dispatch.scanned_cartons || 0} of {dispatch.total_cartons || 0} Verified)
          </h3>
          <span className="text-xs font-semibold text-slate-500">
            Click any barcode to test scan
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {(dispatch.cartons || []).map((c) => (
            <div
              key={c.id}
              onClick={() => setBarcodeInput(c.barcode_no)}
              className={`p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                c.is_scanned
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50/40'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs">{c.barcode_no}</span>
                {c.is_scanned ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                    <Check className="w-3.5 h-3.5" /> Scanned
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                    Pending
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

