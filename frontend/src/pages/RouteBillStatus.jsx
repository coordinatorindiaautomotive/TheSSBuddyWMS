import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import SearchableSelect from '../components/SearchableSelect';
import {
  Receipt,
  Route as RouteIcon,
  Calendar,
  Filter,
  RotateCcw,
  Truck,
  FileSpreadsheet,
  Printer,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Store,
  FileText
} from 'lucide-react';

export default function RouteBillStatus() {
  const toast = useToast();
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedTicketsToDispatch, setSelectedTicketsToDispatch] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setDefaultDates();
    fetchRoutes();
  }, []);

  const setDefaultDates = () => {
    const today = new Date();
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(today.getDate() - 3);

    const formatDate = (d) => {
      const month = '' + (d.getMonth() + 1);
      const day = '' + d.getDate();
      const year = d.getFullYear();
      return [year, month.padStart(2, '0'), day.padStart(2, '0')].join('-');
    };

    setFromDate(formatDate(threeDaysAgo));
    setToDate(formatDate(today));
  };

  const fetchRoutes = async () => {
    try {
      const res = await axios.get('/api/masters/routes');
      const routeList = Array.isArray(res.data) ? res.data : [];
      setRoutes(routeList);
      if (routeList.length > 0) {
        setSelectedRoute(routeList[0].id.toString());
      }
    } catch (err) {
      console.error('Error fetching routes:', err);
    }
  };

  const fetchBillStatus = async () => {
    if (!selectedRoute) {
      toast.warning('Please select a route first.');
      return;
    }
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await axios.get('/api/dispatch-planning/bill-status', {
        params: {
          routeId: selectedRoute,
          fromDate,
          toDate,
          statusFilter,
          search
        }
      });
      const partyList = Array.isArray(res.data) ? res.data : (Array.isArray(res.data?.data) ? res.data.data : []);
      setData(partyList);
      setCurrentPage(1);

      // Auto-check billed tickets that are not yet dispatched
      const autoChecked = [];
      partyList.forEach(party => {
        (party?.billedTickets || []).forEach(t => {
          if (!t.isDispatched && t.pickTicketId) {
            autoChecked.push(t.pickTicketId);
          }
        });
      });
      setSelectedTicketsToDispatch(autoChecked);
    } catch (err) {
      console.error('Error fetching bill status:', err);
      toast.error('Failed to load route bill status.');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedRoute(routes.length > 0 ? routes[0].id.toString() : '');
    setStatusFilter('pending');
    setSearch('');
    setDefaultDates();
    setData([]);
    setHasSearched(false);
    setSelectedTicketsToDispatch([]);
    setCurrentPage(1);
  };

  const handleToggleDispatchCheck = (id) => {
    setSelectedTicketsToDispatch(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleMarkDispatched = async () => {
    if (selectedTicketsToDispatch.length === 0) {
      toast.warning('Please keep checked at least one billed pick ticket to mark as Dispatched.');
      return;
    }
    if (!window.confirm(`Mark ${selectedTicketsToDispatch.length} billed pick ticket(s) as DISPATCHED with current timestamp?`)) return;

    try {
      const res = await axios.post('/api/dispatch-planning/mark-dispatched', selectedTicketsToDispatch);
      toast.success(res.data.message || 'Selected tickets marked as dispatched!');
      fetchBillStatus();
    } catch (err) {
      toast.error('Failed to mark tickets as dispatched.');
    }
  };

  const exportToExcel = () => {
    const selectedRouteObj = routes.find(r => r.id.toString() === selectedRoute);
    const routeName = selectedRouteObj ? selectedRouteObj.route_name : 'All Routes';

    let meta = `Report Date: ${new Date().toLocaleString()} | Route: ${routeName}`;
    if (fromDate) meta += ` | From: ${fromDate}`;
    if (toDate)   meta += ` | To: ${toDate}`;
    meta += ` | Status: ${statusFilter}`;
    if (search) meta += ` | Search: ${search}`;

    let rowsHtml = '';
    data.forEach((row, idx) => {
      const dispatchedCount = row.dispatchedCount || 0;
      const totalDone = row.billedCount + dispatchedCount;
      const pct = row.totalPickTickets > 0 ? Math.round((totalDone / row.totalPickTickets) * 100) : 100;
      
      let ticketTexts = [];
      (row.pendingTickets || []).forEach(t => {
        ticketTexts.push(`${t.pickTicketNo} (Pending: Qty ${t.qty})`);
      });
      (row.billedTickets || []).forEach(t => {
        if (t.isDispatched) {
          ticketTexts.push(`${t.pickTicketNo} (${t.billNo ? 'Bill: ' + t.billNo : 'Billed'} - Dispatched @ ${t.dispatchedAt || ''})`);
        } else {
          ticketTexts.push(`${t.pickTicketNo} (${t.billNo ? 'Bill: ' + t.billNo : 'Billed'}, Qty:${t.qty})`);
        }
      });

      rowsHtml += `
        <tr>
          <td style="text-align:center;">${idx + 1}</td>
          <td style="font-family:monospace; font-weight:bold;">${row.partyCode}</td>
          <td style="font-weight:bold;">${row.partyName}</td>
          <td>${row.route || routeName}</td>
          <td style="text-align:center;">${row.totalPickTickets}</td>
          <td style="text-align:center;">${row.billedCount}</td>
          <td style="text-align:center;">${row.pendingCount}</td>
          <td style="text-align:center;">${pct}%</td>
          <td style="text-align:center;">${row.pendingCount > 0 ? 'Pending' : 'Billed'}</td>
          <td>${ticketTexts.join(' | ')}</td>
        </tr>`;
    });

    const excelTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8"/>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Route Bill Status</x:Name>
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
          th { background-color: #003366; color: #ffffff; font-weight: bold; border-bottom: 4px solid #ed1c24; text-transform: uppercase; font-size: 11pt; padding: 8px; text-align: center; }
          td { border: 1px solid #cbd5e1; vertical-align: middle; font-size: 10pt; padding: 6px; color: #0f172a; }
          .title { font-size: 16pt; font-weight: bold; color: #003366; text-align: left; padding: 6px 0; }
          .meta { font-size: 10pt; color: #475569; font-style: italic; text-align: left; padding-bottom: 10px; }
        </style>
      </head>
      <body>
        <table>
          <tr><td colspan="10" class="title">Route Bill Status Tracker Report</td></tr>
          <tr><td colspan="10" class="meta">${meta}</td></tr>
          <tr><td colspan="10"></td></tr>
          <thead>
            <tr style="background-color: #003366;">
              <th style="background-color: #003366; color: #ffffff; border-bottom: 4px solid #ed1c24;">#</th>
              <th style="background-color: #003366; color: #ffffff; border-bottom: 4px solid #ed1c24;">Party Code</th>
              <th style="background-color: #003366; color: #ffffff; border-bottom: 4px solid #ed1c24;">Party Name</th>
              <th style="background-color: #003366; color: #ffffff; border-bottom: 4px solid #ed1c24;">Route</th>
              <th style="background-color: #003366; color: #ffffff; border-bottom: 4px solid #ed1c24;">Total Pick Ticket in System</th>
              <th style="background-color: #003366; color: #ffffff; border-bottom: 4px solid #ed1c24;">Billed</th>
              <th style="background-color: #003366; color: #ffffff; border-bottom: 4px solid #ed1c24;">Pending</th>
              <th style="background-color: #003366; color: #ffffff; border-bottom: 4px solid #ed1c24;">Billed %</th>
              <th style="background-color: #003366; color: #ffffff; border-bottom: 4px solid #ed1c24;">Status</th>
              <th style="background-color: #003366; color: #ffffff; border-bottom: 4px solid #ed1c24;">Pick Ticket Details &amp; Status</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body>
      </html>`;

    const fileName = `Route_Bill_Status_${new Date().toISOString().slice(0, 10)}.xls`;
    const blob = new Blob(['\ufeff' + excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }, 100);
  };

  const safeData = Array.isArray(data) ? data : [];
  const filteredData = safeData.filter(p => {
    if (!p) return false;
    if (!search || !search.trim()) return true;
    const q = String(search).toLowerCase().trim();
    return (
      (p.partyCode && String(p.partyCode).toLowerCase().includes(q)) ||
      (p.partyName && String(p.partyName).toLowerCase().includes(q)) ||
      (p.route && String(p.route).toLowerCase().includes(q)) ||
      (p.salesman && String(p.salesman).toLowerCase().includes(q)) ||
      (Array.isArray(p.pendingTickets) && p.pendingTickets.some(t => t && String(t.pickTicketNo || '').toLowerCase().includes(q))) ||
      (Array.isArray(p.billedTickets) && p.billedTickets.some(t => t && (String(t.pickTicketNo || '').toLowerCase().includes(q) || String(t.billNo || '').toLowerCase().includes(q))))
    );
  });

  // Summary KPI Calculations
  const totalParties = filteredData.length;
  const totalBilled = filteredData.reduce((s, d) => s + (Number(d?.billedCount) || 0), 0);
  const totalPending = filteredData.reduce((s, d) => s + (Number(d?.pendingCount) || 0), 0);
  const totalDispatched = filteredData.reduce((s, d) => s + (Number(d?.dispatchedCount) || 0), 0);
  const partiesPending = filteredData.filter(d => (Number(d?.pendingCount) || 0) > 0).length;

  const selectedRouteObj = routes.find(r => r.id.toString() === selectedRoute);
  const selectedRouteName = selectedRouteObj ? selectedRouteObj.route_name : 'All Routes';

  return (
    <div className="space-y-6">
      {/* Print Header (Only visible when printing) */}
      <div className="hidden print:block print:mb-4">
        <h2 className="text-2xl font-bold text-slate-900">Route Bill Status Tracker Report</h2>
        <p className="text-xs text-slate-600 mt-1">
          Generated on: {new Date().toLocaleString()} | Route: {selectedRouteName} | From: {fromDate} | To: {toDate} | Status: {statusFilter}
        </p>
        <hr className="mt-3 border-slate-300" />
      </div>

      {/* Multi-Filter Card */}
      <div className="bg-white border border-slate-200 shadow-sm p-4 sm:p-5 rounded-2xl print:hidden space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          
          {/* Route Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1">
              <RouteIcon className="w-3.5 h-3.5 text-indigo-600" /> Route <span className="text-red-500 font-bold ml-0.5">*</span>
            </label>
            <SearchableSelect
              value={selectedRoute}
              onChange={(e) => setSelectedRoute(e.target.value)}
              placeholder="-- Select Route --"
              searchPlaceholder="Search Route Name..."
              options={routes.map(r => ({
                value: String(r.id),
                label: r.route_name,
                sublabel: r.route_code ? `Code: ${r.route_code}` : null
              }))}
              className="bg-slate-50 border-indigo-200 font-extrabold"
            />
          </div>

          {/* From Date */}
          <div className="space-y-1">
            <label className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" /> From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full bg-slate-50 border border-indigo-200 rounded-xl p-2.5 text-xs text-slate-900 font-semibold focus:border-indigo-600 focus:bg-white focus:outline-none transition-colors"
            />
          </div>

          {/* To Date */}
          <div className="space-y-1">
            <label className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" /> To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full bg-slate-50 border border-indigo-200 rounded-xl p-2.5 text-xs text-slate-900 font-semibold focus:border-indigo-600 focus:bg-white focus:outline-none transition-colors"
            />
          </div>

          {/* Status Filter */}
          <div className="space-y-1">
            <label className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-indigo-600" /> Status
            </label>
            <SearchableSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: 'pending', label: 'Pending & Partially Billed' },
                { value: 'billed', label: 'Billed / Dispatched' },
                { value: 'dispatched', label: 'Dispatched Only' },
                { value: 'all', label: 'All Status' }
              ]}
              className="bg-slate-50 border-indigo-200 font-semibold"
              minSearchItems={10}
            />
          </div>

          {/* Text Search */}
          <div className="space-y-1 sm:col-span-2 md:col-span-1">
            <label className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1">
              <Search className="w-3.5 h-3.5 text-indigo-600" /> Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  fetchBillStatus();
                }
              }}
              placeholder="Code, Name, Ticket No..."
              className="w-full bg-slate-50 border border-indigo-200 rounded-xl p-2.5 text-xs text-slate-900 font-semibold focus:border-indigo-600 focus:bg-white focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <button
            onClick={fetchBillStatus}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
          >
            <Filter className="w-3.5 h-3.5" /> Apply
          </button>

          <button
            onClick={handleReset}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-extrabold flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>

          <button
            onClick={handleMarkDispatched}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
            title="Mark checked billed tickets as Dispatched"
          >
            <Truck className="w-3.5 h-3.5" /> Mark Dispatched ({selectedTicketsToDispatch.length})
          </button>

          <button
            onClick={exportToExcel}
            className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Export Excel
          </button>

          <button
            onClick={() => window.print()}
            className="px-3.5 py-2.5 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5 text-indigo-600" /> Print
          </button>
        </div>

        {loading && (
          <div className="text-indigo-600 text-xs font-extrabold flex items-center gap-1.5 mt-3">
            <span className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
            Fetching Data...
          </div>
        )}
      </div>

      {/* Summary KPI Cards (Matching .NET scaled-up design) */}
      {data.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 print:hidden">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 text-lg">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">{totalParties}</div>
              <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Total Parties</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 text-lg">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">{totalBilled}</div>
              <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Total Billed</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 text-lg">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">{totalPending}</div>
              <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Pending Tickets</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 text-lg">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">{totalDispatched}</div>
              <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Dispatched</div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 text-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900">{partiesPending}</div>
              <div className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Parties Pending</div>
            </div>
          </div>
        </div>
      )}

      {/* Alert Banner */}
      {data.length > 0 && (
        partiesPending > 0 ? (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 font-extrabold text-sm flex items-center gap-3 shadow-sm print:hidden">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>{partiesPending} party(ies) have <strong>{totalPending} un-billed</strong> Pick Ticket(s) under current filter.</span>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-extrabold text-sm flex items-center gap-3 shadow-sm print:hidden">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>All parties under current filter are fully billed / processed. ✓</span>
          </div>
        )
      )}

      {/* Main Table Section */}
      {!hasSearched ? (
        <div className="bg-white border-2 border-dashed border-indigo-200 rounded-2xl p-12 sm:p-16 text-center print:hidden shadow-sm">
          <RouteIcon className="w-12 h-12 text-indigo-500 mx-auto mb-4" />
          <h3 className="text-slate-800 font-extrabold text-lg mb-1">Route Bill Status Tracker</h3>
          <p className="text-slate-500 font-medium text-sm max-w-md mx-auto">
            Select route and filter parameters above, then click <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">"Apply"</span> to fetch and view real-time party bill status.
          </p>
        </div>
      ) : filteredData.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 sm:p-16 text-center shadow-sm">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <p className="text-emerald-700 font-extrabold text-base">No Pick Tickets found for selected filter criteria.</p>
        </div>
      ) : (
        /* Excel 10-Column Navy Grid Table */
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[1250px]">
              <thead>
                <tr className="bg-[#003366] border-b-4 border-[#ed1c24] text-white font-extrabold text-xs tracking-wider uppercase">
                  <th className="p-3 border-r border-indigo-200 text-center w-12">#</th>
                  <th className="p-3 border-r border-indigo-200 min-w-[130px]">Party Code</th>
                  <th className="p-3 border-r border-indigo-200 min-w-[200px]">Party Name</th>
                  <th className="p-3 border-r border-indigo-200 min-w-[130px]">Route</th>
                  <th className="p-3 border-r border-indigo-200 text-center min-w-[200px]">Total Pick Ticket in System</th>
                  <th className="p-3 border-r border-indigo-200 text-center w-24">Billed</th>
                  <th className="p-3 border-r border-indigo-200 text-center w-24">Pending</th>
                  <th className="p-3 border-r border-indigo-200 text-center w-24">Billed %</th>
                  <th className="p-3 border-r border-indigo-200 text-center min-w-[140px]">Status</th>
                  <th className="p-3 min-w-[320px]">Pick Ticket Details, Checkbox &amp; Dispatched Timestamps</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-100 text-slate-900">
                {(() => {
                  const sortedData = [...filteredData].sort((a, b) => b.pendingCount - a.pendingCount).slice(0, 100);
                  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
                  const startIndex = (currentPage - 1) * pageSize;
                  const endIndex = Math.min(startIndex + pageSize, sortedData.length);
                  const paginatedData = sortedData.slice(startIndex, startIndex + pageSize);

                  return (
                    <>
                      {paginatedData.map((row, idx) => {
                        const actualIdx = startIndex + idx;
                        const hasPending = row.pendingCount > 0;
                        const hasBilled = row.billedCount > 0;
                        const dispatchedCount = row.dispatchedCount || 0;
                        const totalDone = row.billedCount + dispatchedCount;
                        const pct = row.totalPickTickets > 0 ? Math.round((totalDone / row.totalPickTickets) * 100) : 100;
                        const routeName = row.route || selectedRouteName;

                        let statusElement;
                        if (dispatchedCount > 0 && (hasPending || hasBilled)) {
                          const lastDisp = (row.billedTickets || []).find(t => t.isDispatched && t.dispatchedAt);
                          statusElement = (
                            <span className="px-3 py-1.5 rounded-lg text-xs font-black bg-blue-100 text-blue-900 border border-blue-300 flex flex-col items-center">
                              <span>Partially Dispatched</span>
                              {lastDisp?.dispatchedAt && <span className="text-[10px] font-mono text-blue-700 font-bold">{lastDisp.dispatchedAt}</span>}
                            </span>
                          );
                        } else if (hasPending && hasBilled) {
                          statusElement = (
                            <span className="px-3 py-1.5 rounded-lg text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                              Partially Billed
                            </span>
                          );
                        } else if (hasPending) {
                          statusElement = (
                            <span className="px-3 py-1.5 rounded-lg text-xs font-black bg-red-100 text-red-800 border border-red-300">
                              Pending
                            </span>
                          );
                        } else if (hasBilled) {
                          statusElement = (
                            <span className="px-3 py-1.5 rounded-lg text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                              Fully Billed
                            </span>
                          );
                        } else if (dispatchedCount > 0) {
                          statusElement = (
                            <span className="px-3 py-1.5 rounded-lg text-xs font-black bg-purple-100 text-purple-900 border border-purple-300">
                              All Dispatched
                            </span>
                          );
                        } else {
                          statusElement = (
                            <span className="px-3 py-1.5 rounded-lg text-xs font-black bg-slate-100 text-slate-700 border border-slate-300">
                              No Tickets
                            </span>
                          );
                        }

                        return (
                          <tr key={row.partyCode} className="hover:bg-indigo-50/50 transition-colors">
                            <td className="p-3 border-r border-indigo-100 text-center font-bold text-slate-500">{actualIdx + 1}</td>
                            <td className="p-3 border-r border-indigo-100 font-mono font-black text-[#004c8f]">{row.partyCode}</td>
                            <td className="p-3 border-r border-indigo-100 font-extrabold text-slate-900">{row.partyName}</td>
                            <td className="p-3 border-r border-indigo-100 font-semibold text-slate-700">{routeName}</td>
                            <td className="p-3 border-r border-indigo-100 text-center font-extrabold text-slate-900 text-base">{row.totalPickTickets}</td>
                            <td className="p-3 border-r border-indigo-100 text-center font-extrabold text-emerald-600 text-base">{row.billedCount}</td>
                            <td className="p-3 border-r border-indigo-100 text-center font-extrabold text-amber-600 text-base">{row.pendingCount}</td>
                            <td className="p-3 border-r border-indigo-100 text-center font-black text-indigo-700">{pct}%</td>
                            <td className="p-3 border-r border-indigo-100 text-center">{statusElement}</td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-2 items-center">
                                {(row.pendingTickets || []).map(t => (
                                  <span
                                    key={t.pickTicketId}
                                    className="px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-xs font-mono font-bold shadow-xs"
                                  >
                                    {t.pickTicketNo} (Pending: Qty {t.qty})
                                  </span>
                                ))}

                                {(row.billedTickets || []).map(t => (
                                  t.isDispatched ? (
                                    <span
                                      key={t.pickTicketId}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-300 text-blue-900 text-xs font-mono font-black shadow-sm"
                                      title={`Dispatched at ${t.dispatchedAt}`}
                                    >
                                      <Truck className="w-3.5 h-3.5 text-blue-600" />
                                      <span>{t.pickTicketNo} ({t.billNo ? 'Bill: ' + t.billNo : 'Billed'})</span>
                                      <span className="text-[10px] text-blue-700 font-extrabold bg-blue-100/80 px-1.5 py-0.5 rounded">
                                        Dispatched @ {t.dispatchedAt}
                                      </span>
                                    </span>
                                  ) : (
                                    <label
                                      key={t.pickTicketId}
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-mono font-black cursor-pointer hover:bg-emerald-100 transition shadow-sm"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selectedTicketsToDispatch.includes(t.pickTicketId)}
                                        onChange={() => handleToggleDispatchCheck(t.pickTicketId)}
                                        className="w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer"
                                      />
                                      <FileText className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>{t.pickTicketNo} ({t.billNo ? 'Bill: ' + t.billNo : 'Billed'}, Qty:{t.qty})</span>
                                    </label>
                                  )
                                ))}

                                {(!row.pendingTickets || row.pendingTickets.length === 0) &&
                                 (!row.billedTickets || row.billedTickets.length === 0) && (
                                  <span className="text-slate-400 text-xs font-bold">No Tickets</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer Bar */}
          {filteredData.length > 0 && (() => {
            const cappedTotal = Math.min(filteredData.length, 100);
            const totalPages = Math.ceil(cappedTotal / pageSize) || 1;
            const start = (currentPage - 1) * pageSize;
            const end = Math.min(currentPage * pageSize, cappedTotal);

            return (
              <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="text-slate-500 font-medium text-xs">
                  Showing <strong className="text-slate-900 font-bold">{cappedTotal > 0 ? start + 1 : 0}</strong> to <strong className="text-slate-900 font-bold">{end}</strong> of <strong className="text-slate-900 font-bold">{cappedTotal}</strong> records
                  {filteredData.length > 100 && (
                    <span className="text-[11px] text-slate-400 font-normal ml-1.5">(capped at max 100 — use search to filter)</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer transition-all"
                  >
                    Previous
                  </button>
                  <span className="font-bold text-slate-700 px-2">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage >= totalPages}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer transition-all"
                  >
                    Next
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
