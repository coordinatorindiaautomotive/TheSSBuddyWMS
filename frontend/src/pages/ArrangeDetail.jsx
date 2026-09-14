import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import {
  Boxes,
  Printer,
  Edit2,
  Calendar,
  Layers,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Sparkles,
  ClipboardList,
  Receipt,
  Truck
} from 'lucide-react';

export default function ArrangeDetail() {
  const { id } = useParams();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [generatingPt, setGeneratingPt] = useState(false);

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/arranges/${id}`);
      setData(res.data);
    } catch (err) {
      toast.show('Failed to fetch arrange details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGenPickTicket = async () => {
    setGeneratingPt(true);
    try {
      const res = await axios.post(`/api/arranges/${id}/convert-to-pick-ticket`);
      toast.show(res.data.message || 'Pick Ticket generated successfully!', 'success');
      fetchDetail();
    } catch (err) {
      toast.show(err.response?.data?.message || 'Error generating pick ticket.', 'error');
    } finally {
      setGeneratingPt(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-slate-400 font-bold">Loading arrange details...</div>;
  }

  if (!data) {
    return <div className="p-12 text-center text-red-500 font-bold">Arrange record not found.</div>;
  }

  return (
    <div className="space-y-4 pb-12">
      {/* Action Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            to="/arrange/register"
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h2 className="text-base font-black text-[#003366] tracking-tight">
              Arrangement Sheet: {data.arrange_no}
            </h2>
            <p className="text-xs text-slate-500 font-semibold">
              STI: <span className="font-bold text-slate-800">{data.sti_no}</span> | STR: <span className="font-bold text-amber-900">{data.str_no}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!data.pick_ticket_no && (
            <button
              onClick={handleGenPickTicket}
              disabled={generatingPt}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {generatingPt ? 'Generating...' : 'Convert to Pick Ticket'}
            </button>
          )}
          <Link
            to={`/arrange/edit/${data.id}`}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5 text-slate-500" />
            Edit
          </Link>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#003366] hover:bg-[#004c8f] shadow-md border-r-4 border-[#ed1c24] transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print Sheet
          </button>
        </div>
      </div>

      {/* Printable Sheet */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 max-w-4xl mx-auto print:border-none print:shadow-none print:p-0">
        {/* Document Header */}
        <div className="flex justify-between items-start border-b-2 border-[#003366] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-[#ed1c24] rounded-xs"></span>
              <h1 className="text-xl font-black text-[#003366] tracking-tight uppercase">TheSSBuddy WMS</h1>
            </div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
              Material Arrangement &amp; STI Requisition Sheet
            </p>
          </div>

          <div className="text-right space-y-1">
            <span className="px-3 py-1 rounded-md text-xs font-black uppercase tracking-wider bg-[#003366] text-white">
              Arrange Sheet
            </span>
            <div className="text-xs font-mono font-bold text-[#003366] pt-1">{data.arrange_no}</div>
            <div className="text-xs text-slate-500 font-medium">Date: {data.arrange_date}</div>
          </div>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <div className="space-y-1.5">
            <div className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">Destination &amp; Allocation:</div>
            <div className="font-black text-sm text-slate-900">{data.destination_name}</div>
            <div className="text-slate-600 font-semibold">Type: <span className="uppercase text-[#003366]">[{data.arrange_for}]</span></div>
            <div className="text-slate-600">Assigned Team: <span className="font-bold text-slate-800">{data.arrange_by_team_name || 'Standard Picking Team'}</span></div>
          </div>

          <div className="space-y-1.5 text-right">
            <div className="font-bold text-slate-400 uppercase text-[10px] tracking-wider">Requisition Reference:</div>
            <div className="text-slate-700">STI Number: <span className="font-mono font-bold text-[#003366] bg-blue-50 px-1.5 py-0.5 rounded">{data.sti_no}</span></div>
            <div className="text-slate-700">DMS STR Number: <span className="font-mono font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded">{data.str_no}</span></div>
            {data.pick_ticket_no && (
              <div className="text-emerald-700 font-bold">
                Linked Pick Ticket: <span className="font-mono">{data.pick_ticket_no}</span>
              </div>
            )}
          </div>
        </div>

        {/* Parts Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-[#003366] text-white font-extrabold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3 w-12 text-center">#</th>
                <th className="p-3">Part Code</th>
                <th className="p-3">Part Description</th>
                <th className="p-3 text-right">Required Qty</th>
                <th className="p-3 text-center">Available Stock</th>
                <th className="p-3">Bin / Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data.items || []).map((it, idx) => (
                <tr key={it.id || idx}>
                  <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                  <td className="p-3 font-mono font-bold text-[#003366]">{it.part_no}</td>
                  <td className="p-3 font-semibold text-slate-800">{it.part_name}</td>
                  <td className="p-3 text-right font-black text-sm text-slate-900">{it.required_qty}</td>
                  <td className="p-3 text-center text-slate-600">{it.available_qty} Units</td>
                  <td className="p-3 text-slate-600">{it.remarks || '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-xs text-slate-900">
              <tr>
                <td colSpan={3} className="p-3 text-right uppercase tracking-wider">
                  Total Arrangement Quantity:
                </td>
                <td className="p-3 text-right font-black text-sm text-[#003366]">{data.total_qty} Units</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Remarks */}
        {data.remarks && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <span className="font-bold text-slate-500 uppercase text-[10px] block mb-1">Notes:</span>
            <p className="text-slate-800">{data.remarks}</p>
          </div>
        )}

        {/* Signatures */}
        <div className="pt-12 grid grid-cols-3 gap-6 text-center text-xs text-slate-500 border-t border-slate-200">
          <div className="border-t border-dashed border-slate-400 pt-2 font-bold">
            Arranged By (Team Lead)
          </div>
          <div className="border-t border-dashed border-slate-400 pt-2 font-bold">
            Floor Supervisor
          </div>
          <div className="border-t border-dashed border-slate-400 pt-2 font-bold">
            Store In-Charge
          </div>
        </div>
      </div>
    </div>
  );
}
