import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  FileJson,
  ShieldCheck,
  Receipt,
  FileText,
  AlertCircle,
  Clock,
  Sparkles
} from 'lucide-react';

export default function EWayBill() {
  const toast = useToast();
  const [ewayBills, setEwayBills] = useState([]);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchEWayBills();
  }, []);

  const fetchEWayBills = async () => {
    try {
      const res = await axios.get('/api/ewaybill');
      setEwayBills(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error loading E-Way Bills:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post('/api/ewaybill/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(res.data.message || 'E-Way Bill Excel uploaded successfully!');
      setFile(null);
      fetchEWayBills();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error uploading E-Way Bill Excel file.');
    } finally {
      setUploading(false);
    }
  };

  const handleExportJson = () => {
    window.open('/api/ewaybill/export-json', '_blank');
  };

  const totalValue = ewayBills.reduce((acc, curr) => acc + (curr.total_value || 0), 0);
  const totalTaxable = ewayBills.reduce((acc, curr) => acc + (curr.taxable_value || 0), 0);
  const totalGst = ewayBills.reduce((acc, curr) => acc + ((curr.cgst_value || 0) + (curr.sgst_value || 0) + (curr.igst_value || 0)), 0);

  return (
    <div className="space-y-6">

      {/* Metric Cards Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#004c8f] flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total EWB Count</p>
            <h4 className="text-lg font-black text-slate-900">{ewayBills.length} Bills</h4>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Invoice Value</p>
            <h4 className="text-lg font-black text-slate-900">₹{totalValue.toLocaleString()}</h4>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Taxable Subtotal</p>
            <h4 className="text-lg font-black text-slate-900">₹{totalTaxable.toLocaleString()}</h4>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total GST Breakdown</p>
            <h4 className="text-lg font-black text-slate-900">₹{totalGst.toLocaleString()}</h4>
          </div>
        </div>
      </div>

      {/* Excel Upload Card */}
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-[#004c8f]" />
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Upload E-Way Bill Excel Tool File (.xlsm / .xlsx)
            </h3>
          </div>
          <button
            type="button"
            onClick={handleExportJson}
            disabled={ewayBills.length === 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <FileJson className="w-4 h-4 text-emerald-200" />
            Export NIC E-Way Bill JSON
          </button>
        </div>

        <form onSubmit={handleFileUpload} className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
          <div className="flex-1 relative">
            <input
              type="file"
              accept=".xlsx, .xlsm, .xls"
              onChange={(e) => setFile(e.target.files[0])}
              className="block w-full text-xs text-slate-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-blue-50 file:text-[#004c8f] hover:file:bg-blue-100 cursor-pointer bg-slate-50 border border-slate-300 rounded-xl p-1"
            />
          </div>
          <button
            type="submit"
            disabled={uploading || !file}
            className="px-6 py-3 rounded-xl bg-[#004c8f] hover:bg-[#003a6d] text-white font-extrabold text-xs uppercase tracking-wider shrink-0 shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            {uploading ? 'Parsing Excel Sheet...' : 'Parse & Import E-Way Bills'}
          </button>
        </form>
      </div>

      {/* Generated E-Way Bills Register Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[550px]">
          <table className="w-full text-left text-xs border-collapse min-w-[950px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#003366] border-b-4 border-[#ed1c24] text-white text-xs font-bold uppercase tracking-wider">
                <th className="px-5 py-4 whitespace-nowrap">EWB No</th>
                <th className="px-5 py-4 whitespace-nowrap">Doc / Invoice No</th>
                <th className="px-5 py-4 whitespace-nowrap">Party Name</th>
                <th className="px-5 py-4 whitespace-nowrap">GSTIN</th>
                <th className="px-5 py-4 whitespace-nowrap">Taxable Value</th>
                <th className="px-5 py-4 whitespace-nowrap">CGST + SGST</th>
                <th className="px-5 py-4 whitespace-nowrap">Total Invoice Value</th>
                <th className="px-5 py-4 whitespace-nowrap">EWB Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 font-semibold">
                    Loading E-Way Bill registers...
                  </td>
                </tr>
              ) : ewayBills.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 font-semibold">
                    No E-Way Bill records found. Upload an Excel sheet above to generate EWB records.
                  </td>
                </tr>
              ) : (
                (() => {
                  const totalPages = Math.ceil(ewayBills.length / pageSize) || 1;
                  const startIndex = (currentPage - 1) * pageSize;
                  const endIndex = Math.min(startIndex + pageSize, ewayBills.length);
                  const paginatedData = ewayBills.slice(startIndex, startIndex + pageSize);

                  return (
                    paginatedData.map((e) => (
                      <tr key={e.id} className="hover:bg-blue-50/60 transition-colors">
                        <td className="px-5 py-4 font-extrabold text-[#004c8f] font-mono">
                          {e.ewb_no || 'Pending EWB Generation'}
                        </td>
                        <td className="px-5 py-4 font-bold text-slate-800">{e.doc_no}</td>
                        <td className="px-5 py-4 font-bold text-slate-900">{e.party_name}</td>
                        <td className="px-5 py-4 font-mono text-slate-600">{e.gstin || 'URP / Consumer'}</td>
                        <td className="px-5 py-4 font-medium text-slate-700">₹{(e.taxable_value || 0).toLocaleString()}</td>
                        <td className="px-5 py-4 font-medium text-slate-600">
                          ₹{((e.cgst_value || 0) + (e.sgst_value || 0)).toLocaleString()}
                        </td>
                        <td className="px-5 py-4 font-black text-emerald-700">₹{(e.total_value || 0).toLocaleString()}</td>
                        <td className="px-5 py-4">
                          <span className="px-3 py-1 rounded-xl text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {e.status || 'Generated'}
                          </span>
                        </td>
                      </tr>
                    ))
                  );
                })()
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls Footer */}
        {ewayBills.length > 0 && (
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 text-xs">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer transition-all"
            >
              Previous
            </button>
            <span className="font-bold text-slate-700 px-2">
              Page {currentPage} of {Math.ceil(ewayBills.length / pageSize) || 1}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(ewayBills.length / pageSize) || 1))}
              disabled={currentPage >= (Math.ceil(ewayBills.length / pageSize) || 1)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer transition-all"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
