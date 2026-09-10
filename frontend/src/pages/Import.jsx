import React, { useState } from 'react';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import { Upload, FileSpreadsheet, CheckCircle2, Download, HelpCircle } from 'lucide-react';

export default function Import() {
  const toast = useToast();
  const [entityType, setEntityType] = useState('PickTickets');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleImport = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('entity_type', entityType);

    try {
      const res = await axios.post('/api/import/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(res.data.message || 'Excel data imported successfully!');
      setFile(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error processing Excel import.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="pb-3 border-b border-slate-200">
        <h1 className="text-xl sm:text-2xl font-bold text-[#003366] tracking-tight">
          Import Master &amp; Operational Data
        </h1>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Bulk import pick tickets, party registries, driver rosters, and fleet masters from Excel spreadsheets.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Upload Form Card */}
        <div className="md:col-span-2 card-enterprise p-6 space-y-5">
          <form onSubmit={handleImport} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Select Data Category to Import <span className="text-red-500 font-bold ml-0.5">*</span>
              </label>
              <select
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                className="input-enterprise text-xs font-semibold"
              >
                <option value="FullReport">🌟 Full Pick-to-Delivery Master Report (Auto Routes, Salesmen, Parties, Tickets & Bills)</option>
                <option value="PickTickets">Pick Tickets (.xlsx / .xls)</option>
                <option value="Parties">Customer Parties (.xlsx / .xls)</option>
                <option value="Drivers">Drivers Master (.xlsx / .xls)</option>
                <option value="Vehicles">Vehicles Master (.xlsx / .xls)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Select Excel Spreadsheet File <span className="text-red-500 font-bold ml-0.5">*</span>
              </label>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center bg-slate-50 hover:bg-blue-50/30 transition-colors">
                <Upload className="w-8 h-8 text-[#004C8F] mx-auto mb-2" />
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={(e) => setFile(e.target.files[0])}
                  required
                  className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#004C8F] file:text-white hover:file:bg-[#003366] cursor-pointer"
                />
                <p className="text-[11px] text-slate-400 mt-2">
                  Supports Microsoft Excel (.xlsx, .xls) standard worksheet formats
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={uploading || !file}
              className="btn-primary w-full h-10 text-xs font-bold uppercase tracking-wider"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {uploading ? 'Processing Data...' : 'Import Selected File'}
            </button>
          </form>
        </div>

        {/* Guidance / Templates Card */}
        <div className="card-enterprise p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[#003366] uppercase tracking-wider border-b border-slate-100 pb-2.5">
            <HelpCircle className="w-4 h-4 text-[#004C8F]" />
            Import Guidelines
          </div>

          <div className="space-y-3 text-xs text-slate-600">
            <p className="leading-relaxed">
              Ensure column headers match standard ERP exports before importing.
            </p>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 space-y-1 text-[11px]">
              <span className="font-bold text-[#003366] block">Data Isolation:</span>
              <p className="text-slate-700">
                All records will be mapped to the currently active warehouse context automatically.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

