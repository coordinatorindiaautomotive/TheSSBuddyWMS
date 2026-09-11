const { dbAsync } = require('../config/db');

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getNowIST() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (330 * 60000));
}

function formatDateToYMD(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function formatAging(minutes) {
  if (minutes === null || minutes === undefined || isNaN(minutes)) return '-';
  const totalMin = Math.max(0, Math.floor(minutes));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return m + 'm';
  return h + 'h ' + String(m).padStart(2, '0') + 'm';
}

function formatCountdown(diffSec) {
  if (diffSec === null || diffSec === undefined || isNaN(diffSec)) return '—';
  const isNegative = diffSec < 0;
  const absSec = Math.abs(Math.floor(diffSec));
  const h = Math.floor(absSec / 3600);
  const m = Math.floor((absSec % 3600) / 60);
  const formatted = (isNaN(h) ? '0' : String(h).padStart(2, '0')) + 'h ' + (isNaN(m) ? '0' : String(m).padStart(2, '0')) + 'm';
  return isNegative ? 'Overdue by ' + formatted : formatted + ' left';
}

function parseTimeOnDate(timeStr, targetDate) {
  if (!timeStr) return null;
  const clean = String(timeStr).trim();
  const parts = clean.split(':');
  if (parts.length < 2) return null;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  const d = new Date(targetDate);
  if (isNaN(d.getTime())) return null;
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function formatTime12h(timeStr) {
  if (!timeStr) return '—';
  const parts = String(timeStr).trim().split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = String(parts[1]).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return String(hours).padStart(2, '0') + ':' + minutes + ' ' + ampm;
}

function isScheduleActive(schedule, targetDate) {
  if (!schedule.is_active) return false;
  if (schedule.dispatch_type === 'ON_DEMAND') return true;

  const dayIndex = targetDate.getDay();
  const dayName3 = WEEKDAY_NAMES[dayIndex].toLowerCase();
  const dayNameFull = FULL_DAY_NAMES[dayIndex].toLowerCase();
  const freq = (schedule.frequency || 'DAILY').toUpperCase();

  if (freq === 'DAILY' || freq === 'ON_DEMAND') return true;

  let selectedDays = [];
  try {
    selectedDays = typeof schedule.selected_days === 'string'
      ? JSON.parse(schedule.selected_days)
      : (schedule.selected_days || []);
  } catch (e) {
    selectedDays = [];
  }

  if (Array.isArray(selectedDays) && selectedDays.length > 0) {
    return selectedDays.some(d => {
      const s = String(d).toLowerCase().trim();
      return (
        s === dayName3 ||
        s === dayNameFull ||
        s.startsWith(dayName3) ||
        dayNameFull.startsWith(s)
      );
    });
  }

  return true;
}

function normalizeDateStr(d) {
  if (!d) return '';
  const clean = String(d).trim().split('T')[0].split(' ')[0];
  if (/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/.test(clean)) {
    const match = clean.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    const day = String(match[1]).padStart(2, '0');
    const month = String(match[2]).padStart(2, '0');
    const year = match[3];
    return year + '-' + month + '-' + day;
  }
  if (/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/.test(clean)) {
    const match = clean.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
    const year = match[1];
    const month = String(match[2]).padStart(2, '0');
    const day = String(match[3]).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }
  return clean;
}

function normalizeRouteKey(r) {
  if (!r) return '';
  return String(r).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function routesMatch(rName1, rName2, rCode1, rCode2) {
  const keys1 = [normalizeRouteKey(rName1), normalizeRouteKey(rCode1)].filter(k => k && k !== 'unassigned');
  const keys2 = [normalizeRouteKey(rName2), normalizeRouteKey(rCode2)].filter(k => k && k !== 'unassigned');
  if (keys1.length === 0 || keys2.length === 0) return false;
  return keys1.some(k1 => keys2.some(k2 => k1 === k2 || k1.includes(k2) || k2.includes(k1)));
}

function determineTicketStage(ticket, billing, dispatchParty) {
  const st = String(ticket.status || '').toLowerCase();
  if (st === 'cancelled' || st === 'canceled') {
    return 'Cancelled';
  }
  if (st === 'hold') {
    return 'Hold';
  }
  if (st === 'dispatched' || (dispatchParty && ['In Transit', 'Delivered', 'Completed', 'Assigned'].includes(dispatchParty.status))) {
    return 'Dispatched';
  }
  if (billing && billing.id) {
    return 'Ready';
  }
  if (st === 'billed') {
    return 'Ready';
  }
  if (st === 'billing') {
    return 'Billing';
  }
  if (st === 'picking' || st === 'picked' || ticket.picker_id) {
    return 'Picking';
  }
  return 'Pending';
}

function getAgingMetrics(stageStartedAt, pendingSince, createdAt, now) {
  const baseTime = stageStartedAt || pendingSince || createdAt || now;
  const baseDate = new Date(baseTime);
  const diffMs = isNaN(baseDate.getTime()) ? 0 : now.getTime() - baseDate.getTime();
  const agingMinutes = Math.max(0, Math.floor(diffMs / 60000));

  let agingLevel = 'Normal';
  let agingColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';

  if (agingMinutes >= 60) {
    agingLevel = 'Critical';
    agingColor = 'text-red-700 bg-red-50 border-red-200 font-bold';
  } else if (agingMinutes >= 30) {
    agingLevel = 'Warning';
    agingColor = 'text-amber-700 bg-amber-50 border-amber-200 font-semibold';
  } else if (agingMinutes >= 15) {
    agingLevel = 'Attention';
    agingColor = 'text-blue-700 bg-blue-50 border-blue-200';
  }

  return {
    agingMinutes,
    agingFormatted: formatAging(agingMinutes),
    agingLevel,
    agingColor
  };
}

function calculateCycleStatus(metrics, cutoffTimeStr, dispatchTimeStr, targetDate, now) {
  const { total, pending, picking, billing, ready, dispatched } = metrics;

  if (total === 0) {
    return {
      status: 'Upcoming',
      statusBadge: 'Upcoming',
      statusClass: 'bg-slate-100 text-slate-700 border-slate-200',
      timeRemaining: 'No Tickets',
      isDelayed: false,
      secondsToDispatch: 0,
      secondsToCutoff: 0
    };
  }

  if (dispatched === total) {
    return {
      status: 'Completed',
      statusBadge: 'Completed',
      statusClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      timeRemaining: 'Completed',
      isDelayed: false,
      secondsToDispatch: 0,
      secondsToCutoff: 0
    };
  }

  const dispatchDate = parseTimeOnDate(dispatchTimeStr, targetDate);
  const cutoffDate = parseTimeOnDate(cutoffTimeStr, targetDate);

  let diffDispatchSec = dispatchDate ? Math.floor((dispatchDate.getTime() - now.getTime()) / 1000) : 0;
  let diffCutoffSec = cutoffDate ? Math.floor((cutoffDate.getTime() - now.getTime()) / 1000) : 0;

  const isDispatchOverdue = diffDispatchSec < 0;
  const isCutoffMissed = diffCutoffSec < 0;
  const isImminent = diffDispatchSec > 0 && diffDispatchSec <= 1800;

  let status = 'In Progress';
  let statusBadge = 'In Progress';
  let statusClass = 'bg-blue-50 text-blue-700 border-blue-200';
  let isDelayed = false;

  if (isDispatchOverdue && (pending > 0 || picking > 0 || billing > 0 || ready > 0)) {
    status = 'Delayed';
    statusBadge = 'Delayed';
    statusClass = 'bg-red-500 text-white border-red-600';
    isDelayed = true;
  } else if (isCutoffMissed && (pending > 0 || picking > 0)) {
    status = 'At Risk';
    statusBadge = 'At Risk';
    statusClass = 'bg-amber-50 text-amber-800 border-amber-300';
    isDelayed = true;
  } else if (isImminent && (pending > 0 || picking > 0 || billing > 0)) {
    status = 'At Risk';
    statusBadge = 'At Risk';
    statusClass = 'bg-amber-50 text-amber-800 border-amber-300';
  } else if (ready > 0 && pending === 0 && picking === 0 && billing === 0) {
    status = 'Ready';
    statusBadge = 'Ready';
    statusClass = 'bg-emerald-50 text-emerald-700 border-emerald-300';
  } else if (pending === total) {
    status = 'Upcoming';
    statusBadge = 'Upcoming';
    statusClass = 'bg-slate-100 text-slate-700 border-slate-200';
  }

  const timeRemaining = formatCountdown(diffDispatchSec);

  return {
    status,
    statusBadge,
    statusClass,
    timeRemaining,
    isDelayed,
    secondsToDispatch: diffDispatchSec,
    secondsToCutoff: diffCutoffSec
  };
}

async function getLedDashboardData(params = {}, warehouseId = 1) {
  const now = getNowIST();
  const dateStr = params.date || formatDateToYMD(now);
  const normTargetDate = normalizeDateStr(dateStr);
  const targetDate = new Date((normTargetDate || formatDateToYMD(now)) + 'T12:00:00');

  const routeFilter = params.route_id && params.route_id !== 'ALL' ? String(params.route_id).trim() : null;
  const slotFilter = params.dispatch_slot && params.dispatch_slot !== 'ALL' ? params.dispatch_slot : null;
  const stageFilter = params.stage && params.stage !== 'ALL' ? params.stage : null;
  const statusFilter = params.status && params.status !== 'ALL' ? params.status : null;
  const priorityFilter = params.priority && params.priority !== 'ALL' ? params.priority : null;
  const searchTerm = (params.search || '').trim().toLowerCase();

  const whId = warehouseId || 1;
  const whWhere = '(rm.warehouse_id = ? OR rm.warehouse_id IS NULL OR ? = 1 OR NOT EXISTS (SELECT 1 FROM route_masters WHERE warehouse_id = ?))';
  const whParams = [whId, whId, whId];

  // 1. Fetch Routes for active warehouse
  let routes = await dbAsync.all(`
    SELECT rm.* 
    FROM route_masters rm
    WHERE ${whWhere}
    ORDER BY rm.route_name ASC
  `, whParams);

  if (!routes) routes = [];

  try {
    const distinctPartyRoutes = await dbAsync.all(`
      SELECT DISTINCT route_name FROM parties 
      WHERE (warehouse_id = ? OR warehouse_id IS NULL OR ? = 1 OR NOT EXISTS (SELECT 1 FROM parties WHERE warehouse_id = ?)) 
        AND route_name IS NOT NULL 
        AND TRIM(route_name) != ''
      ORDER BY route_name ASC
    `, [whId, whId, whId]);

    const existingRouteNames = new Set();
    routes.forEach(r => {
      if (r.route_name) existingRouteNames.add(normalizeRouteKey(r.route_name));
      if (r.route_code) existingRouteNames.add(normalizeRouteKey(r.route_code));
    });

    let tempId = 9000;
    for (const pr of (distinctPartyRoutes || [])) {
      const cleanRouteName = String(pr.route_name || '').trim();
      const k = normalizeRouteKey(cleanRouteName);
      if (k && k !== 'unassigned' && k !== 'directroute' && !existingRouteNames.has(k)) {
        routes.push({
          id: tempId++,
          route_code: cleanRouteName.substring(0, 10).toUpperCase(),
          route_name: cleanRouteName,
          warehouse_id: whId
        });
        existingRouteNames.add(k);
      }
    }

    const distinctTicketRoutes = await dbAsync.all(`
      SELECT DISTINCT route FROM pick_tickets 
      WHERE (warehouse_id = ? OR warehouse_id IS NULL OR ? = 1 OR NOT EXISTS (SELECT 1 FROM pick_tickets WHERE warehouse_id = ?)) 
        AND route IS NOT NULL 
        AND TRIM(route) != ''
      ORDER BY route ASC
    `, [whId, whId, whId]);

    for (const tr of (distinctTicketRoutes || [])) {
      const cleanRouteName = String(tr.route || '').trim();
      const k = normalizeRouteKey(cleanRouteName);
      if (k && k !== 'unassigned' && k !== 'directroute' && !existingRouteNames.has(k)) {
        routes.push({
          id: tempId++,
          route_code: cleanRouteName.substring(0, 10).toUpperCase(),
          route_name: cleanRouteName,
          warehouse_id: whId
        });
        existingRouteNames.add(k);
      }
    }
  } catch (e) {}

  // 2. Fetch Route Schedules for active warehouse
  let schedules = await dbAsync.all(`
    SELECT rs.*, rm.route_name, rm.route_code
    FROM route_schedules rs
    JOIN route_masters rm ON rs.route_id = rm.id
    WHERE (rs.warehouse_id = ? OR rs.warehouse_id IS NULL OR ? = 1 OR NOT EXISTS (SELECT 1 FROM route_schedules WHERE warehouse_id = ?)) AND rs.is_active = 1
    ORDER BY rs.dispatch_time ASC, rs.priority_order ASC
  `, [whId, whId, whId]);
  if (!schedules) schedules = [];

  // 3. Fetch All Pick Tickets for active warehouse (with resilient fallback so tickets never disappear)
  let pickTicketsRaw = await dbAsync.all(`
    SELECT pt.*,
           b.id as billing_id, b.bill_no, b.billed_qty, b.invoice_amount, b.created_at as billed_at,
           b.start_time as billing_start_time, b.end_time as billing_end_time,
           pkh.name as picker_name, pkh.employee_code as picker_emp_code,
           dp.id as dispatch_party_id, dp.status as dispatch_party_status, dp.delivery_status, dp.delivered_at,
           d.id as dispatch_id, d.dispatch_no, d.status as dispatch_master_status,
           p.address as party_address, p.city as party_city, p.phone as party_phone,
           p.route_name as party_route_name, p.route_id as party_route_id,
           COALESCE(p.party_name, pt.party_name) as master_party_name
    FROM pick_tickets pt
    LEFT JOIN billings b ON b.pick_ticket_id = pt.id
    LEFT JOIN picker_checker_helpers pkh ON pt.picker_id = pkh.id OR pt.picker_id = pkh.employee_code OR LOWER(pt.picker_id) = LOWER(pkh.name)
    LEFT JOIN dispatch_parties dp ON dp.billing_id = b.id
    LEFT JOIN dispatches d ON dp.dispatch_id = d.id
    LEFT JOIN parties p ON (TRIM(LOWER(pt.party_code)) = TRIM(LOWER(p.party_code)) OR TRIM(LOWER(pt.party_name)) = TRIM(LOWER(p.party_name)))
    WHERE (pt.warehouse_id = ? OR pt.warehouse_id IS NULL OR ? = 1 OR NOT EXISTS (SELECT 1 FROM pick_tickets WHERE warehouse_id = ?))
      AND (pt.status IS NULL OR LOWER(pt.status) NOT IN ('cancelled', 'canceled'))
    ORDER BY pt.created_at ASC
  `, [whId, whId, whId]);

  if (!pickTicketsRaw) pickTicketsRaw = [];

  const pickTickets = pickTicketsRaw.filter(t => {
    const isPendingTicket = !t.billing_id && t.status !== 'Billed' && t.status !== 'Dispatched' && t.status !== 'Completed';
    if (isPendingTicket) {
      return true;
    }
    if (!params.date || params.date === 'ALL' || params.all_dates === 'true') {
      return true;
    }
    const tDate = normalizeDateStr(t.date) || (t.created_at ? normalizeDateStr(t.created_at) : '');
    return !tDate || tDate === normTargetDate;
  });

  const enrichedTickets = pickTickets.map(t => {
    const billing = t.billing_id ? { id: t.billing_id, bill_no: t.bill_no, billed_qty: t.billed_qty, invoice_amount: t.invoice_amount, billed_at: t.billed_at } : null;
    const dispatchParty = t.dispatch_party_id ? { id: t.dispatch_party_id, status: t.dispatch_party_status || t.dispatch_master_status } : null;

    const currentStage = determineTicketStage(t, billing, dispatchParty);
    const createdAt = t.created_at ? new Date(t.created_at) : (t.date ? new Date(t.date + ' ' + (t.time || '09:00')) : now);
    const stageStartedAt = t.stage_started_at ? new Date(t.stage_started_at) : createdAt;
    const pendingSince = t.pending_since ? new Date(t.pending_since) : createdAt;

    const aging = getAgingMetrics(stageStartedAt, pendingSince, createdAt, now);

    let slot = 'Morning';
    if (t.dispatch_slot) {
      slot = String(t.dispatch_slot).toLowerCase().includes('evening') ? 'Evening' : 'Morning';
    } else if (t.time) {
      const parts = String(t.time).split(':');
      const hour = parseInt(parts[0], 10);
      if (hour >= 14) slot = 'Evening';
    }

    const invoicesCount = t.invoices_count || (billing ? 1 : 0);
    const cartonsCount = t.qty_in_pick_ticket || 1;
    const isBilled = !!(billing && billing.id) || t.status === 'Billed' || t.status === 'Dispatched';

    const assignedTo = t.assigned_to || t.picker_name || (billing ? 'Billing Desk' : (t.salesman || 'Unassigned'));
    const cleanTicketRoute = (t.route && t.route.trim() && t.route.trim() !== 'Direct Route' && t.route.trim() !== 'Unassigned') ? t.route.trim() : '';
    const cleanPartyRoute = (t.party_route_name && t.party_route_name.trim()) ? t.party_route_name.trim() : '';
    const resolvedRoute = cleanTicketRoute || cleanPartyRoute || (t.route && t.route.trim()) || 'Unassigned';

    return {
      id: t.id,
      pick_ticket_no: t.ticket_no,
      customer_order_no: t.customer_order_no,
      party_code: t.party_code,
      party_name: t.master_party_name || t.party_name,
      party_address: t.party_address,
      party_city: t.party_city,
      party_phone: t.party_phone,
      party_route: cleanPartyRoute,
      ticket_route: t.route || '',
      route_name: resolvedRoute,
      dispatch_slot: slot,
      date: t.date || dateStr,
      time: t.time || '09:00',
      invoices_count: invoicesCount,
      cartons: cartonsCount,
      is_billed: isBilled,
      billing_status: isBilled ? 'Billed' : 'Unbilled',
      current_stage: currentStage,
      stage_started_at: t.stage_started_at || (t.time ? (dateStr + ' ' + t.time) : t.created_at),
      stage_started_time_formatted: formatTime12h(t.time || '09:00'),
      pending_since: t.pending_since || t.created_at,
      pending_since_time_formatted: formatTime12h(t.time || '09:00'),
      aging_minutes: aging.agingMinutes,
      aging_formatted: aging.agingFormatted,
      aging_level: aging.agingLevel,
      aging_color: aging.agingColor,
      priority: t.priority || 'Normal',
      assigned_to: assignedTo,
      picker_name: t.picker_name || t.picker_id || null,
      status: currentStage === 'Dispatched' ? 'Completed' : (currentStage === 'Ready' ? 'Ready' : (currentStage === 'Picking' || currentStage === 'Billing' ? 'In Process' : 'Pending')),
      billing_id: t.billing_id,
      bill_no: t.bill_no,
      invoice_amount: t.invoice_amount || 0,
      remarks: t.remarks,
      created_at: t.created_at
    };
  });

  routes.forEach(r => {
    r.unbilled_count = enrichedTickets.filter(t =>
      !t.is_billed && t.current_stage !== 'Cancelled' &&
      routesMatch(t.route_name, r.route_name, t.ticket_route || t.party_route, r.route_code)
    ).length;
  });

  const morningCycles = [];
  const eveningCycles = [];
  const allCycles = [];

  for (const r of routes) {
    const routeSchedules = schedules.filter(s => s.route_id === r.id);

    const morningSched = routeSchedules.find(s =>
      (s.trip_name && s.trip_name.toLowerCase().includes('morning')) ||
      (s.priority_order === 1 && s.trip_name && !s.trip_name.toLowerCase().includes('evening'))
    );

    const eveningSched = routeSchedules.find(s =>
      (s.trip_name && s.trip_name.toLowerCase().includes('evening')) ||
      (s.priority_order === 2 && s.trip_name && !s.trip_name.toLowerCase().includes('morning'))
    );

    const mTickets = enrichedTickets.filter(t =>
      routesMatch(t.route_name, r.route_name, t.ticket_route || t.party_route, r.route_code) &&
      (
        (!eveningSched && morningSched) ||
        (!morningSched && !eveningSched) ||
        (t.dispatch_slot && t.dispatch_slot.toLowerCase() === 'morning')
      )
    );

    const eTickets = enrichedTickets.filter(t =>
      routesMatch(t.route_name, r.route_name, t.ticket_route || t.party_route, r.route_code) &&
      (
        (!morningSched && eveningSched) ||
        (t.dispatch_slot && t.dispatch_slot.toLowerCase() === 'evening')
      )
    );

    const hasConfiguredSchedules = routeSchedules.length > 0;
    const isAllDates = !params.date || params.date === 'ALL' || params.all_dates === 'true';

    const mActive = morningSched ? (isAllDates || isScheduleActive(morningSched, targetDate)) : (!hasConfiguredSchedules);
    if (mActive) {
      const mCutoff = morningSched ? morningSched.cutoff_time : '08:00';
      const mDispatch = morningSched ? morningSched.dispatch_time : '10:00';

      const metrics = {
        total: mTickets.length,
        pending: mTickets.filter(t => !t.is_billed && t.current_stage !== 'Cancelled').length,
        picking: mTickets.filter(t => t.current_stage === 'Picking').length,
        billing: mTickets.filter(t => t.current_stage === 'Billing' || t.billing_id).length,
        ready: mTickets.filter(t => t.is_billed && t.current_stage !== 'Dispatched').length,
        dispatched: mTickets.filter(t => t.current_stage === 'Dispatched').length,
        delayed: mTickets.filter(t => t.aging_level === 'Critical' || t.status === 'Delayed').length
      };

      const progressPct = metrics.total > 0
        ? Math.round(((metrics.dispatched + metrics.ready) / metrics.total) * 100)
        : 100;

      const cycleStatusInfo = calculateCycleStatus(metrics, mCutoff, mDispatch, targetDate, now);

      const cycleItem = {
        cycle_key: r.id + '_morning',
        route_id: r.id,
        route_code: r.route_code,
        route_name: r.route_name,
        slot: 'Morning',
        trip_name: morningSched ? morningSched.trip_name : 'Morning Dispatch',
        cutoff_time: mCutoff,
        cutoff_time_formatted: formatTime12h(mCutoff),
        dispatch_time: mDispatch,
        dispatch_time_formatted: formatTime12h(mDispatch),
        metrics,
        progress_pct: progressPct,
        ...cycleStatusInfo
      };

      morningCycles.push(cycleItem);
      allCycles.push(cycleItem);
    }

    const eActive = eveningSched ? (isAllDates || isScheduleActive(eveningSched, targetDate)) : (!hasConfiguredSchedules);
    if (eActive) {
      const eCutoff = eveningSched ? eveningSched.cutoff_time : '16:00';
      const eDispatch = eveningSched ? eveningSched.dispatch_time : '18:00';

      const metrics = {
        total: eTickets.length,
        pending: eTickets.filter(t => !t.is_billed && t.current_stage !== 'Cancelled').length,
        picking: eTickets.filter(t => t.current_stage === 'Picking').length,
        billing: eTickets.filter(t => t.current_stage === 'Billing' || t.billing_id).length,
        ready: eTickets.filter(t => t.is_billed && t.current_stage !== 'Dispatched').length,
        dispatched: eTickets.filter(t => t.current_stage === 'Dispatched').length,
        delayed: eTickets.filter(t => t.aging_level === 'Critical' || t.status === 'Delayed').length
      };

      const progressPct = metrics.total > 0
        ? Math.round(((metrics.dispatched + metrics.ready) / metrics.total) * 100)
        : (metrics.pending + metrics.picking > 0 ? 0 : 100);

      const cycleStatusInfo = calculateCycleStatus(metrics, eCutoff, eDispatch, targetDate, now);

      const cycleItem = {
        cycle_key: r.id + '_evening',
        route_id: r.id,
        route_code: r.route_code,
        route_name: r.route_name,
        slot: 'Evening',
        trip_name: eveningSched ? eveningSched.trip_name : 'Evening Dispatch',
        cutoff_time: eCutoff,
        cutoff_time_formatted: formatTime12h(eCutoff),
        dispatch_time: eDispatch,
        dispatch_time_formatted: formatTime12h(eDispatch),
        metrics,
        progress_pct: progressPct,
        ...cycleStatusInfo
      };

      eveningCycles.push(cycleItem);
      allCycles.push(cycleItem);
    }
  }

  let filteredMorningCycles = morningCycles;
  let filteredEveningCycles = eveningCycles;

  if (routeFilter && routeFilter !== 'ALL') {
    const selectedRouteObj = routes.find(r => 
      String(r.id) === String(routeFilter) || 
      String(r.route_name || '').trim().toLowerCase() === String(routeFilter).trim().toLowerCase() ||
      String(r.route_code || '').trim().toLowerCase() === String(routeFilter).trim().toLowerCase()
    );
    if (selectedRouteObj) {
      filteredMorningCycles = morningCycles.filter(c => c.route_id === selectedRouteObj.id || routesMatch(c.route_name, selectedRouteObj.route_name, c.route_code, selectedRouteObj.route_code));
      filteredEveningCycles = eveningCycles.filter(c => c.route_id === selectedRouteObj.id || routesMatch(c.route_name, selectedRouteObj.route_name, c.route_code, selectedRouteObj.route_code));
    }
  } else {
    filteredMorningCycles.sort((a, b) => (b.metrics.total || 0) - (a.metrics.total || 0));
    filteredEveningCycles.sort((a, b) => (b.metrics.total || 0) - (a.metrics.total || 0));
  }

  let nextDispatch = allCycles
    .filter(c => c.metrics.total > 0 && c.metrics.dispatched < c.metrics.total && c.secondsToDispatch >= -3600)
    .sort((a, b) => (a.secondsToDispatch || 0) - (b.secondsToDispatch || 0))[0];

  if (!nextDispatch) {
    nextDispatch = allCycles.find(c => c.metrics.total > 0 && c.metrics.dispatched < c.metrics.total) || allCycles[0] || null;
  }

  let filteredTickets = [...enrichedTickets];

  if (routeFilter && routeFilter !== 'ALL') {
    const rfLower = String(routeFilter).trim().toLowerCase();
    const selectedRouteObj = routes.find(r => 
      String(r.id) === String(routeFilter) || 
      String(r.route_name || '').trim().toLowerCase() === rfLower ||
      String(r.route_code || '').trim().toLowerCase() === rfLower
    );
    if (selectedRouteObj) {
      filteredTickets = filteredTickets.filter(t =>
        routesMatch(t.route_name, selectedRouteObj.route_name, t.ticket_route || t.party_route, selectedRouteObj.route_code)
      );
    } else {
      filteredTickets = filteredTickets.filter(t =>
        routesMatch(t.route_name, routeFilter, t.ticket_route || t.party_route, routeFilter)
      );
    }
  }

  if (slotFilter && slotFilter !== 'ALL') {
    filteredTickets = filteredTickets.filter(t =>
      String(t.dispatch_slot || '').toLowerCase() === slotFilter.toLowerCase()
    );
  }

  if (stageFilter && stageFilter !== 'ALL') {
    const sf = stageFilter.toLowerCase();
    if (sf === 'billing') {
      filteredTickets = filteredTickets.filter(t => t.current_stage === 'Billing' || t.current_stage === 'Ready' || t.billing_id != null);
    } else if (sf === 'ready') {
      filteredTickets = filteredTickets.filter(t => t.current_stage === 'Ready' || t.billing_id != null);
    } else {
      filteredTickets = filteredTickets.filter(t => String(t.current_stage || '').toLowerCase() === sf);
    }
  }

  if (statusFilter && statusFilter !== 'ALL') {
    const stf = statusFilter.toLowerCase();
    if (stf === 'delayed') {
      filteredTickets = filteredTickets.filter(t => t.aging_level === 'Critical' || t.status === 'Delayed');
    } else {
      filteredTickets = filteredTickets.filter(t => String(t.status || '').toLowerCase() === stf);
    }
  }

  if (priorityFilter && priorityFilter !== 'ALL') {
    filteredTickets = filteredTickets.filter(t =>
      String(t.priority || '').toLowerCase() === priorityFilter.toLowerCase()
    );
  }

  if (searchTerm) {
    filteredTickets = filteredTickets.filter(t =>
      (t.pick_ticket_no && String(t.pick_ticket_no).toLowerCase().includes(searchTerm)) ||
      (t.party_name && String(t.party_name).toLowerCase().includes(searchTerm)) ||
      (t.party_code && String(t.party_code).toLowerCase().includes(searchTerm)) ||
      (t.bill_no && String(t.bill_no).toLowerCase().includes(searchTerm)) ||
      (t.customer_order_no && String(t.customer_order_no).toLowerCase().includes(searchTerm))
    );
  }

  const totalTicketsCount = enrichedTickets.length;
  const pendingCount = enrichedTickets.filter(t => t.current_stage === 'Pending').length;
  const pickingCount = enrichedTickets.filter(t => t.current_stage === 'Picking').length;
  const billingCount = enrichedTickets.filter(t => t.current_stage === 'Billing' || t.billing_id != null).length;
  const readyCount = enrichedTickets.filter(t => t.current_stage === 'Ready' || (t.billing_id != null && t.current_stage !== 'Dispatched')).length;
  const delayedCount = enrichedTickets.filter(t => t.aging_level === 'Critical' || t.status === 'Delayed').length;
  const activeRoutesCount = new Set(allCycles.filter(c => c.metrics.total > 0).map(c => c.route_id)).size || routes.length;

  const page = Math.max(1, parseInt(params.page || 1, 10));
  const limit = Math.max(1, parseInt(params.limit || 5000, 10));
  const totalCount = filteredTickets.length;
  const totalPages = Math.ceil(totalCount / limit) || 1;
  const startIndex = (page - 1) * limit;
  const paginatedTickets = filteredTickets.slice(startIndex, startIndex + limit);

  return {
    date: dateStr,
    currentTime: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
    currentTimeIso: now.toISOString(),
    kpis: {
      activeRoutes: activeRoutesCount,
      totalPickTickets: totalTicketsCount,
      pending: pendingCount,
      picking: pickingCount,
      billing: billingCount,
      ready: readyCount,
      delayed: delayedCount
    },
    nextDispatch: nextDispatch ? {
      cycle_key: nextDispatch.cycle_key,
      route_id: nextDispatch.route_id,
      route_name: nextDispatch.route_name,
      slot: nextDispatch.slot,
      cutoff_time_formatted: nextDispatch.cutoff_time_formatted,
      dispatch_time_formatted: nextDispatch.dispatch_time_formatted,
      time_remaining: nextDispatch.timeRemaining,
      is_delayed: nextDispatch.isDelayed,
      status: nextDispatch.status
    } : null,
    morningDispatch: {
      count: filteredMorningCycles.length,
      cycles: filteredMorningCycles
    },
    eveningDispatch: {
      count: filteredEveningCycles.length,
      cycles: filteredEveningCycles
    },
    routes: routes.map(r => {
      const rTickets = enrichedTickets.filter(t => routesMatch(t.route_name, r.route_name, t.ticket_route || t.party_route, r.route_code));
      const unbilled = rTickets.filter(t => !t.is_billed && t.current_stage !== 'Cancelled').length;
      return {
        id: r.id,
        route_code: r.route_code,
        route_name: r.route_name,
        unbilled_count: unbilled,
        total_count: rTickets.length
      };
    }),
    tickets: {
      items: paginatedTickets,
      allItems: enrichedTickets,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        startIndex: startIndex + 1,
        endIndex: Math.min(startIndex + limit, totalCount)
      }
    }
  };
}

async function getStageSummary(params = {}, warehouseId = 1) {
  const dashboard = await getLedDashboardData(params, warehouseId);
  const tickets = dashboard.tickets.items || [];

  const stages = ['Pending', 'Picking', 'Billing', 'Ready', 'Dispatched', 'Hold'];
  const summary = stages.map(stage => {
    const matching = tickets.filter(t => String(t.current_stage || '').toLowerCase() === stage.toLowerCase());
    const totalCartons = matching.reduce((sum, t) => sum + (t.cartons || 1), 0);
    const totalAmount = matching.reduce((sum, t) => sum + (t.invoice_amount || 0), 0);
    const avgAging = matching.length > 0
      ? Math.round(matching.reduce((sum, t) => sum + (t.aging_minutes || 0), 0) / matching.length)
      : 0;

    return {
      stage,
      count: matching.length,
      cartons: totalCartons,
      invoice_amount: totalAmount,
      avg_aging_minutes: avgAging,
      avg_aging_formatted: formatAging(avgAging),
      pct_of_total: dashboard.kpis.totalPickTickets > 0 ? Math.round((matching.length / dashboard.kpis.totalPickTickets) * 100) : 0
    };
  });

  return summary;
}

async function getPartySummary(params = {}, warehouseId = 1) {
  const dashboard = await getLedDashboardData(params, warehouseId);
  const tickets = dashboard.tickets.items || [];

  const partiesMap = new Map();

  tickets.forEach(t => {
    const key = t.party_code || 'UNKNOWN';
    if (!partiesMap.has(key)) {
      partiesMap.set(key, {
        party_code: t.party_code,
        party_name: t.party_name,
        party_city: t.party_city || '',
        total_tickets: 0,
        invoices: 0,
        cartons: 0,
        pending: 0,
        picking: 0,
        billing: 0,
        ready: 0,
        dispatched: 0
      });
    }

    const p = partiesMap.get(key);
    p.total_tickets += 1;
    p.invoices += (t.invoices_count || 1);
    p.cartons += (t.cartons || 1);

    if (t.current_stage === 'Pending') p.pending += 1;
    else if (t.current_stage === 'Picking') p.picking += 1;
    else if (t.current_stage === 'Billing') p.billing += 1;
    else if (t.current_stage === 'Ready') p.ready += 1;
    else if (t.current_stage === 'Dispatched') p.dispatched += 1;
  });

  return Array.from(partiesMap.values()).sort((a, b) => b.total_tickets - a.total_tickets);
}

async function getCartonSummary(params = {}, warehouseId = 1) {
  const dashboard = await getLedDashboardData(params, warehouseId);
  const tickets = dashboard.tickets.items || [];

  const total = tickets.reduce((s, t) => s + (t.cartons || 1), 0);
  const picked = tickets.filter(t => ['Ready', 'Dispatched', 'Billing'].includes(t.current_stage)).reduce((s, t) => s + (t.cartons || 1), 0);
  const billed = tickets.filter(t => ['Ready', 'Dispatched'].includes(t.current_stage)).reduce((s, t) => s + (t.cartons || 1), 0);
  const ready = tickets.filter(t => t.current_stage === 'Ready').reduce((s, t) => s + (t.cartons || 1), 0);
  const loaded = tickets.filter(t => t.current_stage === 'Dispatched').reduce((s, t) => s + (t.cartons || 1), 0);
  const dispatched = tickets.filter(t => t.current_stage === 'Dispatched').reduce((s, t) => s + (t.cartons || 1), 0);

  return {
    total,
    picked,
    billed,
    ready,
    loaded,
    dispatched,
    pending: Math.max(0, total - picked)
  };
}

async function getPickTicketDetailById(ticketId, warehouseId = 1) {
  const now = getNowIST();
  const whId = warehouseId || 1;
  const ticket = await dbAsync.get(`
    SELECT pt.*,
           b.id as billing_id, b.bill_no, b.billed_qty, b.invoice_amount, b.created_at as billed_at,
           b.start_time as billing_start_time, b.end_time as billing_end_time,
           pkh.name as picker_name, pkh.employee_code as picker_emp_code, pkh.mobile as picker_mobile,
           dp.id as dispatch_party_id, dp.status as dispatch_party_status, dp.delivery_status, dp.delivered_at,
           d.id as dispatch_id, d.dispatch_no, d.status as dispatch_master_status, d.driver_id, d.vehicle_id,
           dr.driver_name, dr.mobile as driver_mobile, v.vehicle_number,
           p.address as party_address, p.city as party_city, p.phone as party_phone, p.gstin as party_gstin,
           COALESCE(p.party_name, pt.party_name) as master_party_name
    FROM pick_tickets pt
    LEFT JOIN billings b ON b.pick_ticket_id = pt.id
    LEFT JOIN picker_checker_helpers pkh ON pt.picker_id = pkh.id OR pt.picker_id = pkh.employee_code OR LOWER(pt.picker_id) = LOWER(pkh.name)
    LEFT JOIN dispatch_parties dp ON dp.billing_id = b.id
    LEFT JOIN dispatches d ON dp.dispatch_id = d.id
    LEFT JOIN drivers dr ON d.driver_id = dr.id
    LEFT JOIN vehicles v ON d.vehicle_id = v.id
    LEFT JOIN parties p ON (TRIM(LOWER(pt.party_code)) = TRIM(LOWER(p.party_code)) OR TRIM(LOWER(pt.party_name)) = TRIM(LOWER(p.party_name)))
    WHERE (pt.id = ? OR pt.ticket_no = ?) AND (pt.warehouse_id = ? OR pt.warehouse_id IS NULL OR ? = 1 OR NOT EXISTS (SELECT 1 FROM pick_tickets WHERE warehouse_id = ?))
  `, [ticketId, ticketId, whId, whId, whId]);

  if (!ticket) return null;

  const billing = ticket.billing_id ? {
    id: ticket.billing_id,
    bill_no: ticket.bill_no,
    billed_qty: ticket.billed_qty,
    invoice_amount: ticket.invoice_amount,
    billed_at: ticket.billed_at,
    start_time: ticket.billing_start_time,
    end_time: ticket.billing_end_time
  } : null;

  const dispatchParty = ticket.dispatch_party_id ? {
    id: ticket.dispatch_party_id,
    status: ticket.dispatch_party_status || ticket.dispatch_master_status,
    dispatch_no: ticket.dispatch_no,
    driver_name: ticket.driver_name,
    driver_mobile: ticket.driver_mobile,
    vehicle_number: ticket.vehicle_number,
    delivered_at: ticket.delivered_at
  } : null;

  const currentStage = determineTicketStage(ticket, billing, dispatchParty);
  const createdAt = ticket.created_at ? new Date(ticket.created_at) : (ticket.date ? new Date(ticket.date + ' ' + (ticket.time || '09:00')) : now);
  const stageStartedAt = ticket.stage_started_at ? new Date(ticket.stage_started_at) : createdAt;
  const pendingSince = ticket.pending_since ? new Date(ticket.pending_since) : createdAt;

  const aging = getAgingMetrics(stageStartedAt, pendingSince, createdAt, now);

  const stagesOrder = ['Created', 'Picking', 'Picked', 'Billing', 'Billed', 'Ready', 'Dispatched'];
  let currentStageIndex = 0;
  if (currentStage === 'Dispatched') currentStageIndex = 6;
  else if (currentStage === 'Ready') currentStageIndex = 5;
  else if (currentStage === 'Billing') currentStageIndex = 3;
  else if (currentStage === 'Picking') currentStageIndex = 1;

  const timeline = stagesOrder.map((st, idx) => {
    let state = 'upcoming';
    if (idx < currentStageIndex) state = 'completed';
    else if (idx === currentStageIndex) state = 'current';

    let timestamp = null;
    if (st === 'Created') timestamp = ticket.created_at || (ticket.date + ' ' + ticket.time);
    else if (st === 'Picking' && ticket.picker_id) timestamp = ticket.created_at;
    else if (st === 'Billed' && billing) timestamp = billing.billed_at;
    else if (st === 'Ready' && billing) timestamp = billing.billed_at;
    else if (st === 'Dispatched' && dispatchParty) timestamp = dispatchParty.delivered_at || ticket.created_at;

    return {
      stage: st,
      state,
      timestamp: timestamp ? formatTime12h(String(timestamp).includes(' ') ? String(timestamp).split(' ')[1] : '09:00') : null,
      full_timestamp: timestamp
    };
  });

  return {
    id: ticket.id,
    pick_ticket_no: ticket.ticket_no,
    customer_order_no: ticket.customer_order_no,
    party_code: ticket.party_code,
    party_name: ticket.master_party_name || ticket.party_name,
    party_address: ticket.party_address,
    party_city: ticket.party_city,
    party_phone: ticket.party_phone,
    party_gstin: ticket.party_gstin,
    route_name: ticket.route,
    dispatch_slot: ticket.dispatch_slot || 'Morning',
    date: ticket.date,
    time: ticket.time,
    qty_in_pick_ticket: ticket.qty_in_pick_ticket,
    current_stage: currentStage,
    status: currentStage === 'Dispatched' ? 'Completed' : (currentStage === 'Ready' ? 'Ready' : (currentStage === 'Picking' || currentStage === 'Billing' ? 'In Process' : 'Pending')),
    priority: ticket.priority || 'Normal',
    aging_minutes: aging.agingMinutes,
    aging_formatted: aging.agingFormatted,
    aging_level: aging.agingLevel,
    aging_color: aging.agingColor,
    picker: {
      name: ticket.picker_name || ticket.picker_id || 'Unassigned',
      code: ticket.picker_emp_code || '',
      mobile: ticket.picker_mobile || ''
    },
    billing,
    dispatch: dispatchParty,
    remarks: ticket.remarks,
    timeline
  };
}

module.exports = {
  getLedDashboardData,
  getStageSummary,
  getPartySummary,
  getCartonSummary,
  getPickTicketDetailById,
  getNowIST,
  formatDateToYMD
};
