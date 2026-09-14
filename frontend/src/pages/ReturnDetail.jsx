import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import {
  Undo2,
  Printer,
  Edit2,
  Calendar,
  Building2,
  Layers,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Coins,
  ArrowLeft,
  Share2,
  FileText
} from 'lucide-react';

export default function ReturnDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/returns/${id}`);
      setData(res.data);
    } catch (err) {
      toast.show('Failed to fetch return details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 font-bold">
        Loading return voucher details...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-12 text-center text-red-500 font-bold">
        Return record not found.
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12">
      {/* Top Action Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            to="/return/register"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            title="Back to Register"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-base font-black text-[#003366] tracking-tight">
              Return Voucher: {data.return_no}
            </h2>
            <p className="text-xs text-slate-500 font-semibold">
              Status: <span className="font-bold text-slate-800">{data.status}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/return/edit/${data.id}`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5 text-slate-500" />
            Edit Voucher
          </Link>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#003366] hover:bg-[#004c8f] shadow-md border-r-4 border-[#ed1c24] transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print Return Slip
          </button>
        </div>
      </div>

      {/* Printable Material Return Document */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 max-w-4xl mx-auto print:border-none print:shadow-none print:p-0">
        {/* Document Header */}
        <div className="flex justify-between items-start border-b-2 border-[#003366] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-[#ed1c24] rounded-xs"></span>
              <h1 className="text-xl font-black text-[#003366] tracking-tight uppercase">TheSSBuddy WMS</h1>
            </div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
              Material Return Memo &amp; Credit Allocation
            </p>
          </div>

          <div className="text-right space-y-1">
            <span className="px-3 py-1 rounded-md text-xs font-black uppercase tracking-wider bg-[#003366] text-white">
              Return Slip
            </span>
            <div className="text-xs font-mono font-bold text-[#003366] pt-1">{data.return_no}</div>
            <div className="text-xs text-slate-500 font-medium">Date: {data.return_date}</div>
          </div>
        </div>

        {/* Party & Voucher Metadata Grid */}
        <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <div className="space-y-1.5">
            <div className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">Customer / Party Details:</div>
            <div className="font-black text-sm text-slate-900">{data.party_name}</div>
            <div className="text-slate-600 font-mono">Party Code: {data.party_code}</div>
            <div className="text-slate-700">
              Ref Invoice: <span className="font-mono font-bold text-[#003366] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{data.ref_invoice_no || 'N/A'}</span>
            </div>
            <div className="text-slate-600">Return Reason: <span className="font-bold text-slate-800">{data.remark_name || 'Standard Return'}</span></div>
          </div>

          <div className="space-y-1.5 text-right">
            <div className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">Settlement Information:</div>
            <div className="flex justify-end items-center gap-2">
              <span className="text-slate-500">DMS Allocation:</span>
              <span
                className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                  data.is_dms_received ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {data.is_dms_received ? 'DMS Received' : 'Pending DMS'}
              </span>
            </div>
            {data.str_no && (
              <div className="text-slate-700">
                STR Number: <span className="font-mono font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded">{data.str_no}</span>
              </div>
            )}
            <div className="text-slate-500">Created By: <span className="font-semibold text-slate-700">{data.created_by || 'System'}</span></div>
          </div>
        </div>

        {/* Items Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#003366] text-white font-extrabold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3 w-12 text-center">#</th>
                <th className="p-3">Part Code</th>
                <th className="p-3">Part Description</th>
                <th className="p-3">Ref Invoice No</th>
                <th className="p-3 text-right">Return Qty</th>
                <th className="p-3 text-right">Rate (₹)</th>
                <th className="p-3 text-right">Value (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data.items || []).map((it, idx) => (
                <tr key={it.id || idx}>
                  <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                  <td className="p-3 font-mono font-bold text-[#003366]">{it.part_no}</td>
                  <td className="p-3 font-semibold text-slate-800">{it.part_name}</td>
                  <td className="p-3 font-mono text-slate-600">{it.reference_invoice_no || '—'}</td>
                  <td className="p-3 text-right font-bold text-slate-900">{it.qty}</td>
                  <td className="p-3 text-right text-slate-700">₹{Number(it.rate || 0).toFixed(2)}</td>
                  <td className="p-3 text-right font-mono font-bold text-emerald-700">
                    ₹{Number(it.value || (it.qty * it.rate)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-xs text-slate-900">
              <tr>
                <td colSpan={4} className="p-3 text-right uppercase tracking-wider">
                  Total Summary:
                </td>
                <td className="p-3 text-right font-black text-sm text-[#003366]">{data.total_qty} Units</td>
                <td className="p-3 text-right text-slate-400">—</td>
                <td className="p-3 text-right font-black text-sm text-emerald-700">
                  ₹{Number(data.total_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Internal Remarks */}
        {data.internal_remarks && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <span className="font-bold text-slate-500 uppercase text-[10px] block mb-1">Remarks &amp; Notes:</span>
            <p className="text-slate-800">{data.internal_remarks}</p>
          </div>
        )}

        {/* Signature Box */}
        <div className="pt-12 grid grid-cols-3 gap-6 text-center text-xs text-slate-500 border-t border-slate-200">
          <div className="border-t border-dashed border-slate-400 pt-2 font-bold">
            Customer / Driver Signature
          </div>
          <div className="border-t border-dashed border-slate-400 pt-2 font-bold">
            Store / Quality Inspector
          </div>
          <div className="border-t border-dashed border-slate-400 pt-2 font-bold">
            Authorized Signatory
          </div>
        </div>
      </div>
    </div>
  );
}
