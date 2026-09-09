const { dbAsync } = require('../config/db');

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getNowInTimezone(offsetMinutes = 330) {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (offsetMinutes * 60000));
}

function formatMinutesToHours(minutes) {
  if (minutes < 0) minutes = 0;
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatSecondsToHMS(totalSec) {
  const absSec = Math.abs(Math.floor(totalSec));
  const h = String(Math.floor(absSec / 3600)).padStart(2, '0');
  const m = String(Math.floor((absSec % 3600) / 60)).padStart(2, '0');
  const s = String(absSec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function isScheduleActiveOnDate(schedule, targetDate) {
  if (!schedule.is_active) return false;
  if (schedule.dispatch_type === 'ON_DEMAND') return true;

  const dayName3 = WEEKDAY_NAMES[targetDate.getDay()];
  const fullDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayNameFull = fullDayNames[targetDate.getDay()];
  const freq = schedule.frequency || 'DAILY';

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
        s === dayName3.toLowerCase() ||
        s === dayNameFull.toLowerCase() ||
        s.startsWith(dayName3.toLowerCase()) ||
        dayNameFull.toLowerCase().startsWith(s)
      );
    });
  }

  return true;
}

function parseTimeOnDate(timeStr, targetDate) {
  if (!timeStr) return null;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return null;

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  const d = new Date(targetDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

function calculateTripTiming(schedule, now) {
  if (schedule.dispatch_type === 'ON_DEMAND') {
    return {
      isOnDemand: true,
      cutoffTimeFormatted: 'On-Demand',
      dispatchTimeFormatted: 'On-Demand',
      cutoffStatus: 'ON_DEMAND',
      dispatchStatus: 'ON_DEMAND',
      cutoffCountdown: 'ON DEMAND DISPATCH',
      dispatchCountdown: 'NO FIXED SCHEDULE',
      isCutoffMissed: false,
      isDispatchOverdue: false,
      secondsToCutoff: null,
      secondsToDispatch: null
    };
  }

  const cutoffDate = parseTimeOnDate(schedule.cutoff_time, now);
  const dispatchDate = parseTimeOnDate(schedule.dispatch_time, now);

  if (!cutoffDate || !dispatchDate) {
    return {
      isOnDemand: false,
      cutoffTimeFormatted: schedule.cutoff_time || '—',
      dispatchTimeFormatted: schedule.dispatch_time || '—',
      cutoffStatus: 'UNKNOWN',
      dispatchStatus: 'UNKNOWN',
      cutoffCountdown: '—',
      dispatchCountdown: '—',
      isCutoffMissed: false,
      isDispatchOverdue: false,
      secondsToCutoff: null,
      secondsToDispatch: null
    };
  }

  const nowMs = now.getTime();
  const cutoffDiffSec = (cutoffDate.getTime() - nowMs) / 1000;
  const dispatchDiffSec = (dispatchDate.getTime() - nowMs) / 1000;

  const isCutoffMissed = cutoffDiffSec < 0;
  const isDispatchOverdue = dispatchDiffSec < 0;

  const format12h = (dateObj) => {
    return dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const cutoffTimeFormatted = format12h(cutoffDate);
  const dispatchTimeFormatted = format12h(dispatchDate);

  let cutoffStatus = 'BEFORE_CUTOFF';
  let cutoffCountdown = '';
  if (cutoffDiffSec > 0) {
    cutoffStatus = cutoffDiffSec <= 1800 ? 'CUTOFF_APPROACHING' : 'BEFORE_CUTOFF';
    cutoffCountdown = `CUT-OFF IN ${formatSecondsToHMS(cutoffDiffSec)}`;
  } else {
    cutoffStatus = 'CUTOFF_MISSED';
    cutoffCountdown = `CUT-OFF MISSED BY ${formatSecondsToHMS(Math.abs(cutoffDiffSec))}`;
  }

  let dispatchStatus = 'UPCOMING';
  let dispatchCountdown = '';
  if (dispatchDiffSec > 0) {
    dispatchStatus = dispatchDiffSec <= 1800 ? 'DISPATCH_IMMINENT' : 'UPCOMING';
    dispatchCountdown = `DISPATCH IN ${formatSecondsToHMS(dispatchDiffSec)}`;
  } else {
    dispatchStatus = 'DISPATCH_OVERDUE';
    dispatchCountdown = `DISPATCH OVERDUE BY ${formatSecondsToHMS(Math.abs(dispatchDiffSec))}`;
  }

  return {
    isOnDemand: false,
    cutoffTimeFormatted,
    dispatchTimeFormatted,
    rawCutoffTime: schedule.cutoff_time,
    rawDispatchTime: schedule.dispatch_time,
    cutoffDate,
    dispatchDate,
    cutoffStatus,
    dispatchStatus,
    cutoffCountdown,
    dispatchCountdown,
    isCutoffMissed,
    isDispatchOverdue,
    secondsToCutoff: cutoffDiffSec,
    secondsToDispatch: dispatchDiffSec
  };
}

async function getOperationsConsoleData(warehouseId) {
  const now = getNowInTimezone(330);
  const todayStr = now.toISOString().split('T')[0];
  const dayName = WEEKDAY_NAMES[now.getDay()];

  const whWhere = warehouseId ? 'WHERE warehouse_id = ?' : 'WHERE 1=1';
  const whParams = warehouseId ? [warehouseId] : [];

  const routes = await dbAsync.all(`
    SELECT * FROM route_masters 
    ${whWhere}
    ORDER BY route_name ASC
  `, whParams);

  const schedules = await dbAsync.all(`
    SELECT rs.*, rm.route_name, rm.route_code 
    FROM route_schedules rs
    JOIN route_masters rm ON rs.route_id = rm.id
    WHERE ${warehouseId ? 'rs.warehouse_id = ? AND' : ''} rs.is_active = 1
    ORDER BY rs.dispatch_time ASC, rs.priority_order ASC
  `, whParams);

  const pickTickets = await dbAsync.all(`
    SELECT pt.*, b.id as billing_id, b.bill_no, b.billed_qty, b.invoice_amount, b.created_at as billed_at
    FROM pick_tickets pt
    LEFT JOIN billings b ON b.pick_ticket_id = pt.id
    ${whWhere}
    ORDER BY pt.created_at ASC
  `, whParams);

  const todayDispatches = await dbAsync.all(`
    SELECT d.*, dp.billing_id, dp.party_code
    FROM dispatches d
    LEFT JOIN dispatch_parties dp ON dp.dispatch_id = d.id
    WHERE ${warehouseId ? 'd.warehouse_id = ? AND' : ''} (d.dispatch_date = ? OR DATE(d.created_at) = ?)
  `, warehouseId ? [warehouseId, todayStr, todayStr] : [todayStr, todayStr]);

  const dispatchedBillingIds = new Set(todayDispatches.map(d => d.billing_id).filter(Boolean));

  const ticketsByRoute = new Map();
  for (const t of pickTickets) {
    const rKey = (t.route || '').trim().toLowerCase();
    if (!ticketsByRoute.has(rKey)) ticketsByRoute.set(rKey, []);
    ticketsByRoute.get(rKey).push(t);
  }

  const todayTrips = [];
  const onDemandRoutes = [];
  const routeMatrix = [];

  let totalDispatchesCount = 0;
  let upcomingDispatchesCount = 0;
  let completedDispatchesCount = 0;
  let atRiskDispatchesCount = 0;
  let delayedDispatchesCount = 0;

  let totalPendingTicketsCount = 0;
  let totalBillingPendingCount = 0;
  let totalPackingPendingCount = 0;
  let criticalRoutesCount = 0;

  const criticalAlerts = [];

  for (const r of routes) {
    const rKey = (r.route_name || '').trim().toLowerCase();
    const routeTickets = ticketsByRoute.get(rKey) || [];

    let totalTickets = 0;
    let pendingTicketsCount = 0;
    let billingPendingCount = 0;
    let packingPendingCount = 0;
    let readyCount = 0;
    let blockedCount = 0;
    let oldestPendingMinutes = 0;
    let oldestTicketNo = null;

    const ageingBuckets = { under30m: 0, from30to60m: 0, from1to2h: 0, from2to4h: 0, over4h: 0 };

    for (const t of routeTickets) {
      if (t.status === 'Cancelled') {
        blockedCount++;
        continue;
      }

      totalTickets++;
      const isDispatched = t.status === 'Dispatched' || (t.billing_id && dispatchedBillingIds.has(t.billing_id));

      if (isDispatched) {
        continue;
      }

      pendingTicketsCount++;
      totalPendingTicketsCount++;

      const createdAt = t.created_at ? new Date(t.created_at) : (t.date ? new Date(`${t.date} ${t.time || '10:00'}`) : now);
      const ageMinutes = Math.max(0, (now.getTime() - createdAt.getTime()) / 60000);

      if (ageMinutes > oldestPendingMinutes) {
        oldestPendingMinutes = ageMinutes;
        oldestTicketNo = t.ticket_no;
      }

      if (ageMinutes < 30) ageingBuckets.under30m++;
      else if (ageMinutes < 60) ageingBuckets.from30to60m++;
      else if (ageMinutes < 120) ageingBuckets.from1to2h++;
      else if (ageMinutes < 240) ageingBuckets.from2to4h++;
      else ageingBuckets.over4h++;

      if (!t.billing_id) {
        billingPendingCount++;
        totalBillingPendingCount++;
      } else {
        packingPendingCount++;
        totalPackingPendingCount++;
        readyCount++;
      }
    }

    const routeSchedules = schedules.filter(s => s.route_id === r.id);

    if (routeSchedules.length === 0) {
      routeMatrix.push({
        routeId: r.id,
        routeCode: r.route_code,
        routeName: r.route_name,
        tripName: 'Unscheduled Run',
        dispatchType: 'UNCONFIGURED',
        frequency: 'MANUAL',
        cutoffTime: '—',
        dispatchTime: '—',
        timing: { cutoffCountdown: 'NO SCHEDULE', dispatchCountdown: 'UNCONFIGURED', isCutoffMissed: false, isDispatchOverdue: false },
        workload: { totalTickets, pendingTicketsCount, billingPendingCount, packingPendingCount, readyCount, oldestPendingMinutes, oldestPendingFormatted: formatMinutesToHours(oldestPendingMinutes), oldestTicketNo, ageingBuckets },
        priority: { score: 1, level: 'BLUE', badge: 'Unscheduled', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' }
      });
      continue;
    }

    for (const sched of routeSchedules) {
      const timing = calculateTripTiming(sched, now);
      const isToday = isScheduleActiveOnDate(sched, now);

      if (sched.dispatch_type === 'ON_DEMAND') {
        onDemandRoutes.push({
          scheduleId: sched.id,
          routeId: r.id,
          routeCode: r.route_code,
          routeName: r.route_name,
          tripName: sched.trip_name || 'On-Demand Dispatch',
          dispatchType: 'ON_DEMAND',
          pendingCount: pendingTicketsCount,
          billingPending: billingPendingCount,
          oldestAge: formatMinutesToHours(oldestPendingMinutes),
          workload: { totalTickets, pendingTicketsCount, billingPendingCount, packingPendingCount, readyCount, oldestPendingMinutes, oldestPendingFormatted: formatMinutesToHours(oldestPendingMinutes), oldestTicketNo, ageingBuckets }
        });
        continue;
      }

      if (!isToday) continue;

      totalDispatchesCount++;

      let priority = { score: 1, level: 'BLUE', badge: 'Upcoming', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
      const isCompleted = pendingTicketsCount === 0 && totalTickets > 0;

      if (isCompleted) {
        completedDispatchesCount++;
        priority = { score: 0, level: 'GREEN', badge: 'Completed', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
      } else if (timing.isDispatchOverdue && pendingTicketsCount > 0) {
        delayedDispatchesCount++;
        criticalRoutesCount++;
        priority = { score: 5, level: 'RED', badge: 'Dispatch Overdue', bg: 'bg-red-500', text: 'text-white', border: 'border-red-600' };
        criticalAlerts.push({
          level: 'RED',
          route: r.route_name,
          trip: sched.trip_name,
          issue: `Dispatch overdue by ${formatSecondsToHMS(Math.abs(timing.secondsToDispatch))}`,
          details: `${pendingTicketsCount} tickets pending (${billingPendingCount} need billing)`,
          actionType: 'BILLING',
          actionUrl: `/billing?search=${encodeURIComponent(r.route_name)}`,
          actionLabel: 'Process Billing Now'
        });
      } else if (timing.isCutoffMissed && pendingTicketsCount > 0) {
        atRiskDispatchesCount++;
        criticalRoutesCount++;
        priority = { score: 4, level: 'RED', badge: 'Cutoff Missed', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300' };
        criticalAlerts.push({
          level: 'RED',
          route: r.route_name,
          trip: sched.trip_name,
          issue: `Cutoff missed by ${formatSecondsToHMS(Math.abs(timing.secondsToCutoff))}`,
          details: `${pendingTicketsCount} tickets pending unresolved`,
          actionType: 'PICK_TICKETS',
          actionUrl: `/pick-tickets?route=${encodeURIComponent(r.route_name)}`,
          actionLabel: 'View Pick Tickets'
        });
      } else if (timing.secondsToCutoff !== null && timing.secondsToCutoff <= 1800 && pendingTicketsCount > 0) {
        atRiskDispatchesCount++;
        priority = { score: 3, level: 'ORANGE', badge: 'Cutoff Approaching', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300' };
      } else if (ageingBuckets.over4h > 0 || ageingBuckets.from2to4h > 0) {
        priority = { score: 2, level: 'YELLOW', badge: 'Attention (Ageing)', bg: 'bg-amber-50/80', text: 'text-amber-800', border: 'border-amber-200' };
      } else {
        upcomingDispatchesCount++;
        priority = { score: 1, level: 'BLUE', badge: 'On Track', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
      }

      const tripItem = {
        scheduleId: sched.id,
        routeId: r.id,
        routeCode: r.route_code,
        routeName: r.route_name,
        tripName: sched.trip_name,
        dispatchType: sched.dispatch_type,
        frequency: sched.frequency,
        timing,
        workload: {
          totalTickets,
          pendingTicketsCount,
          billingPendingCount,
          packingPendingCount,
          readyCount,
          oldestPendingMinutes,
          oldestPendingFormatted: formatMinutesToHours(oldestPendingMinutes),
          oldestTicketNo,
          ageingBuckets
        },
        priority
      };

      todayTrips.push(tripItem);
      routeMatrix.push(tripItem);
    }
  }

  todayTrips.sort((a, b) => {
    const timeA = a.timing.rawDispatchTime || '99:99';
    const timeB = b.timing.rawDispatchTime || '99:99';
    return timeA.localeCompare(timeB);
  });

  const nextDispatch = todayTrips.find(t => t.priority.score > 0 && !t.timing.isDispatchOverdue) 
    || todayTrips.find(t => t.priority.score > 0) 
    || todayTrips[0] 
    || null;

  return {
    operationalDate: todayStr,
    dayOfWeek: dayName,
    currentTime: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
    timezone: 'Asia/Kolkata (+05:30)',
    kpis: {
      totalDispatches: totalDispatchesCount,
      upcoming: upcomingDispatchesCount,
      completed: completedDispatchesCount,
      atRisk: atRiskDispatchesCount,
      delayed: delayedDispatchesCount,
      totalPendingTickets: totalPendingTicketsCount,
      billingPending: totalBillingPendingCount,
      packingPending: totalPackingPendingCount,
      criticalRoutes: criticalRoutesCount
    },
    nextDispatch,
    criticalAlerts,
    todayTimeline: todayTrips,
    routeMatrix,
    onDemandQueue: onDemandRoutes
  };
}

module.exports = {
  getOperationsConsoleData,
  calculateTripTiming,
  isScheduleActiveOnDate,
  getNowInTimezone
};
