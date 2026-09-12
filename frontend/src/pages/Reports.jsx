import React, { useEffect, useState } from 'react';
import axios from 'axios';
import SearchableSelect from '../components/SearchableSelect';
import {
  BarChart3,
  Download,
  Clock,
  Receipt,
  Truck,
  Calendar,
  Filter,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react';

export default function Reports() {
  const [reportType, setReportType] = useState('detailed-lifecycle');
  const [reportData, setReportData] = useState([]);
  const [routesList, setRoutesList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedRoute, setSelectedRoute] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchRoutes();
  }, []);

  useEffect(() => {
    fetchReport();
  }, [reportType]);

  const fetchRoutes = async () => {
    try {
      const res = await axios.get('/api/masters/routes');
      setRoutesList(res.data || []);
    } catch (e) {}
  };

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);
      if (selectedRoute) params.append('route', selectedRoute);
      if (selectedStatus) params.append('status', selectedStatus);
      if (searchQuery) params.append('search', searchQuery);

      let url = `/api/reports/${reportType}?${params.toString()}`;
      if (reportType === 'audit-trail') {
        url = `/api/audit-logs?${params.toString()}`;
      }

      const res = await axios.get(url);
      if (reportType === 'audit-trail') {
        setReportData(res.data.logs || []);
      } else {
        setReportData(res.data || []);
      }
    } catch (err) {
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilter = (e) => {
    if (e) e.preventDefault();
    fetchReport();
  };

  const handleResetFilters = () => {
    setFromDate('');
    setToDate('');
    setSelectedRoute('');
    setSelectedStatus('');
    setSearchQuery('');
    setLoading(true);
    axios.get(`/api/reports/${reportType}`).then(res => {
      setReportData(res.data);
      setLoading(false);
    });
  };

  const exportFormattedExcel = () => {
    if (!reportData.length) return;
    const keys = Object.keys(reportData[0]);

    const headerCells = keys
      .map(
        k =>
          `<th style="background-color:#003366; color:#ffffff; font-weight:bold; font-family:'Segoe UI',Arial,sans-serif; font-size:12px; border-bottom:4px solid #ed1c24; padding:10px; text-transform:uppercase; text-align:left;">${k
            .replace(/_/g, ' ')
            .toUpperCase()}</th>`
      )
      .join('');

    const bodyRows = reportData
      .map(
        row =>
          `<tr>` +
          keys
            .map(
              k =>
                `<td style="font-family:'Segoe UI',Arial,sans-serif; font-size:11px; padding:8px; border:1px solid #cbd5e1; color:#0f172a;">${
                  row[k] ?? ''
                }</td>`
            )
            .join('') +
          `</tr>`
      )
      .join('');

    const template = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8" />
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Operational Audit</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            table { border-collapse: collapse; width: 100%; }
            th { background-color: #003366; color: #ffffff; font-weight: bold; border-bottom: 4px solid #ed1c24; text-transform: uppercase; font-size: 12px; }
            td { border: 1px solid #cbd5e1; font-size: 11px; padding: 6px; color: #0f172a; }
          </style>
        </head>
        <body>
          <table>
            <thead>
              <tr style="background-color: #003366;">${headerCells}</tr>
            </thead>
            <tbody>
              ${bodyRows}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const fileName = `WMS_${reportType}_report_${new Date().toISOString().split('T')[0]}.xls`;
    const blob = new Blob(['\ufeff' + template], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.setAttribute('download', fileName);
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  };

  const exportCSV = () => {
    if (!reportData.length) return;
    const keys = Object.keys(reportData[0]);
    const csvRows = [
      keys.map(k => `"${k.toUpperCase().replace(/_/g, ' ')}"`).join(','),
      ...reportData.map(row => keys.map(k => `"${String(row[k] ?? '').replace(/"/g, '""')}"`).join(','))
    ];
    const fileName = `WMS_${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`;
    const blob = new Blob(['\ufeff' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.setAttribute('download', fileName);
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  };

  return (
    <div className="space-y-6">
      {/* Report Category Tabs & Export Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 p-1.5 rounded-2xl shadow-sm">
        <button
          onClick={() => setReportType('audit-trail')}
          className={`px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
            reportType === 'audit-trail'
              ? 'bg-[#004c8f] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-amber-400" /> 🔒 Granular System Audit Trail &amp; Security Log
        </button>

        <button
          onClick={() => setReportType('detailed-lifecycle')}
          className={`px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
            reportType === 'detailed-lifecycle'
              ? 'bg-[#004c8f] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4" /> Operations All-Field Report
        </button>

        <button
          onClick={() => setReportType('lifecycle')}
          className={`px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
            reportType === 'lifecycle'
              ? 'bg-[#004c8f] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Clock className="w-4 h-4" /> End-to-End Lifecycle Summary
        </button>

        <button
          onClick={() => setReportType('billing')}
          className={`px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
            reportType === 'billing'
              ? 'bg-[#004c8f] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Receipt className="w-4 h-4" /> Billing &amp; Invoices Summary
        </button>

        <button
          onClick={() => setReportType('dispatch')}
          className={`px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
            reportType === 'dispatch'
              ? 'bg-[#004c8f] text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Truck className="w-4 h-4" /> Dispatch Logistics Report
        </button>
      </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportFormattedExcel}
            disabled={loading || reportData.length === 0}
            className="px-4 py-2 bg-[#003366] hover:bg-[#002244] border-b-2 border-[#ed1c24] text-white text-xs font-extrabold rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            Export Excel (.xls)
          </button>
          <button
            onClick={exportCSV}
            disabled={loading || reportData.length === 0}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold rounded-xl flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-500" />
            Export CSV (.csv)
          </button>
        </div>
      </div>

      {/* Filter Controls Panel (Date Range, Route, Status, Search) */}
      <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <Filter className="w-4 h-4 text-[#004c8f]" />
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Report Filter Parameters</h3>
        </div>

        <form onSubmit={handleApplyFilter} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end">
          {/* From Date */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 font-semibold focus:border-[#004c8f] focus:bg-white focus:outline-none"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 font-semibold focus:border-[#004c8f] focus:bg-white focus:outline-none"
            />
          </div>

          {/* Route Filter */}
          {reportType.includes('lifecycle') && (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Select Route</label>
              <SearchableSelect
                value={selectedRoute}
                onChange={(e) => setSelectedRoute(e.target.value)}
                placeholder="-- All Routes --"
                searchPlaceholder="Search Route Name..."
                options={[
                  { value: '', label: '-- All Routes --' },
                  ...routesList.map(r => ({
                    value: r.route_name,
                    label: r.route_name
                  }))
                ]}
              />
            </div>
          )}

          {/* Status Filter */}
          {reportType.includes('lifecycle') && (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Status Filter</label>
              <SearchableSelect
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                options={[
                  { value: '', label: '-- All Statuses --' },
                  { value: 'Dispatched', label: 'Dispatched / Delivered' },
                  { value: 'Pending', label: 'Pending Dispatch' }
                ]}
                minSearchItems={10}
              />
            </div>
          )}

          {/* Search Query */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">Search Keywords</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ticket, Bill, Party..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-800 font-semibold focus:border-[#004c8f] focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-2 col-span-1 sm:col-span-2 md:col-span-5 justify-end pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-[#004c8f] hover:bg-[#003a6d] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
            >
              <Filter className="w-3.5 h-3.5" /> Apply Filters
            </button>
          </div>
        </form>
      </div>

      {/* Report Table Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#003366] border-b-4 border-[#ed1c24] text-white text-xs font-bold uppercase tracking-wider">
                {reportData.length > 0 ? (
                  Object.keys(reportData[0]).map(key => (
                    <th key={key} className="px-5 py-4 whitespace-nowrap">
                      {key.replace(/_/g, ' ')}
                    </th>
                  ))
                ) : (
                  <th className="px-5 py-4">Report Details</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={20} className="text-center py-12 text-slate-400 font-semibold">
                    Generating report data with selected filters...
                  </td>
                </tr>
              ) : reportData.length === 0 ? (
                <tr>
                  <td colSpan={20} className="text-center py-12 text-slate-400 font-semibold">
                    No records match current filter criteria.
                  </td>
                </tr>
              ) : (
                (() => {
                  const totalPages = Math.ceil(reportData.length / pageSize) || 1;
                  const startIndex = (currentPage - 1) * pageSize;
                  const endIndex = Math.min(startIndex + pageSize, reportData.length);
                  const paginatedData = reportData.slice(startIndex, startIndex + pageSize);

                  return (
                    paginatedData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/60 transition-colors">
                        {Object.entries(row).map(([key, val], i) => {
                          const isTurnaround = key === 'turnaround_time';
                          const isStatus = key === 'dispatch_status' || key === 'status';

                          return (
                            <td key={i} className="px-5 py-4 whitespace-nowrap text-slate-700 font-medium">
                              {isTurnaround ? (
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold inline-flex items-center gap-1 ${
                                  String(val).includes('In Progress')
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono'
                                }`}>
                                  <Clock className="w-3.5 h-3.5 shrink-0" />
                                  {String(val)}
                                </span>
                              ) : isStatus ? (
                                <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold ${
                                  String(val) === 'Dispatched' || String(val) === 'Completed' || String(val) === 'Delivered'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                  {String(val)}
                                </span>
                              ) : (
                                <span>{String(val ?? '—')}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  );
                })()
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {reportData.length > 0 && (
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 text-xs">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer transition-all"
            >
              Previous
            </button>
            <span className="font-bold text-slate-700 px-2">
              Page {currentPage} of {Math.ceil(reportData.length / pageSize) || 1}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(reportData.length / pageSize) || 1))}
              disabled={currentPage >= (Math.ceil(reportData.length / pageSize) || 1)}
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
