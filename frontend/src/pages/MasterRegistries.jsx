import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import {
  Store, MapPin, UserCheck, Briefcase, Truck, Warehouse as WarehouseIcon,
  Plus, Search, Edit2, Trash2, CheckCircle2, XCircle, ToggleLeft, ToggleRight,
  User, Phone, FileText, Route as RouteIcon, ShieldCheck, Lock,
  Calendar, Clock, AlertTriangle, PlayCircle, Settings2, Sparkles, Check,
  Sun, Moon, Sunrise, Sunset, Zap
} from 'lucide-react';

const TABS = [
  { id: 'party',     label: 'Party Master',       icon: Store },
  { id: 'worker',    label: 'Floor Workers',      icon: UserCheck },
  { id: 'driver',    label: 'Driver Fleet',       icon: Truck },
  { id: 'vehicle',   label: 'Vehicle Fleet',      icon: Briefcase },
  { id: 'route',     label: 'Route Master',       icon: RouteIcon },
  { id: 'salesman',  label: 'Salesman Master',    icon: User },
  { id: 'warehouse', label: 'Warehouse Master',   icon: WarehouseIcon },
  { id: 'user',      label: 'User Accounts',      icon: ShieldCheck },
  { id: 'system',    label: 'Database & Settings',icon: Lock },
];

// ─── Shared helpers ──────────────────────────────────────────────────────────
const initials = (name = '') => name.slice(0, 2).toUpperCase();
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '—';

const TH = ({ children, className = '' }) => (
  <th className={`px-4 py-3.5 text-left text-xs font-extrabold text-white uppercase tracking-wider ${className}`}>
    {children}
  </th>
);

const TD = ({ children, className = '' }) => (
  <td className={`px-4 py-3 text-xs text-slate-800 whitespace-nowrap ${className}`}>
    {children}
  </td>
);

export default function MasterRegistries() {
  const toast = useToast();
  const { user } = useAuth();
  const isSuperAdmin = Boolean(
    user && (
      ['Super Admin', 'SUPER_ADMIN', 'SuperAdmin'].includes(user.role) ||
      (user.username && user.username.toLowerCase() === 'admin')
    )
  );

  const visibleTabs = TABS.filter(tab => {
    if (['warehouse', 'user', 'system'].includes(tab.id)) {
      return isSuperAdmin;
    }
    return true;
  });

  const [activeTab, setActiveTab] = useState('party');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Data
  const [parties,    setParties]    = useState([]);
  const [workers,    setWorkers]    = useState([]);
  const [drivers,    setDrivers]    = useState([]);
  const [vehicles,   setVehicles]   = useState([]);
  const [routes,     setRoutes]     = useState([]);
  const [salesmen,   setSalesmen]   = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [users,      setUsers]      = useState([]);

  // Extra form state for user
  const [confirmPassword, setConfirmPassword] = useState('');

  // System Settings & Database Switcher State
  const [sysConfig, setSysConfig] = useState({
    dbType: 'MYSQL',
    mysql: { host: '127.0.0.1', port: 3306, database: 'wms_enterprise_db', user: 'root', password: 'root' },
    sqlite: { dbPath: 'data/wms_enterprise.db' },
    mssql: { host: '172.20.25.5', port: 1433, database: 'WmsEnterpriseDb', user: 'sa', password: 'Admin@12345' },
    postgres: { host: '127.0.0.1', port: 5432, database: 'wms_enterprise_db', user: 'postgres', password: '' }
  });
  const [testResult, setTestResult] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [testingDb, setTestingDb] = useState(false);
  const [syncingDb, setSyncingDb] = useState(false);

  // Modal
  const [showModal,    setShowModal]    = useState(false);
  const [editingItem,  setEditingItem]  = useState(null);
  const [form,         setForm]         = useState({});
  const [submitting,   setSubmitting]   = useState(false);
  // Delete modal
  const [deleteItem,   setDeleteItem]   = useState(null);
  const [deleting,     setDeleting]     = useState(false);

  // Route Schedule Modal State
  const [scheduleModalRoute, setScheduleModalRoute] = useState(null);
  const [routeSchedules, setRouteSchedules] = useState([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    trip_name: '',
    dispatch_type: 'FIXED_TIME',
    frequency: 'DAILY',
    selected_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    cutoff_time: '08:00',
    dispatch_time: '09:30',
    priority_order: 1,
    is_active: true
  });
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!isSuperAdmin && ['warehouse', 'user', 'system'].includes(activeTab)) {
      setActiveTab('party');
    }
  }, [isSuperAdmin, activeTab]);

  useEffect(() => {
    fetchAll();
    if (isSuperAdmin) {
      fetchSysConfig();
    }
  }, [isSuperAdmin]);

  const fetchSysConfig = async () => {
    try {
      const res = await axios.get('/api/system/config');
      if (res.data && res.data.config) {
        setSysConfig(res.data.config);
        if (res.data.connectionStatus) setTestResult(res.data.connectionStatus);
      }
    } catch (e) {}
  };

  const handleTestDb = async () => {
    setTestingDb(true);
    setTestResult(null);
    try {
      const res = await axios.post('/api/system/test-db', sysConfig);
      setTestResult(res.data);
    } catch (err) {
      setTestResult({ success: false, message: err.response?.data?.message || 'Connection test failed.' });
    } finally {
      setTestingDb(false);
    }
  };

  const handleSaveSysConfig = async (e) => {
    if (e) e.preventDefault();
    try {
      const res = await axios.post('/api/system/config', sysConfig);
      setTestResult(res.data.connectionStatus);
      toast.success('System Database Configuration Saved Successfully!');
    } catch (err) {
      toast.error('Failed to save system configuration.');
    }
  };

  const handle1ClickSync = async () => {
    setSyncingDb(true);
    setSyncResult(null);
    try {
      const res = await axios.post('/api/system/sync-db');
      setSyncResult(res.data);
      fetchAll();
    } catch (err) {
      setSyncResult({ success: false, message: err.response?.data?.message || 'Auto Sync Failed.' });
    } finally {
      setSyncingDb(false);
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const promises = [
        axios.get('/api/parties'),
        axios.get('/api/masters/workers'),
        axios.get('/api/masters/drivers'),
        axios.get('/api/masters/vehicles'),
        axios.get('/api/masters/routes'),
        axios.get('/api/masters/salesmen'),
      ];

      if (isSuperAdmin) {
        promises.push(axios.get('/api/masters/warehouses'));
        promises.push(axios.get('/api/masters/users'));
      }

      const results = await Promise.allSettled(promises);

      const [pR, wR, dR, vR, rR, sR] = results;

      if (pR.status === 'fulfilled') setParties(Array.isArray(pR.value.data) ? pR.value.data : []);
      if (wR.status === 'fulfilled') setWorkers(Array.isArray(wR.value.data) ? wR.value.data : []);
      if (dR.status === 'fulfilled') setDrivers(Array.isArray(dR.value.data) ? dR.value.data : []);
      if (vR.status === 'fulfilled') setVehicles(Array.isArray(vR.value.data) ? vR.value.data : []);
      if (rR.status === 'fulfilled') setRoutes(Array.isArray(rR.value.data) ? rR.value.data : []);
      if (sR.status === 'fulfilled') setSalesmen(Array.isArray(sR.value.data) ? sR.value.data : []);

      if (isSuperAdmin) {
        const whR = results[6];
        const uR = results[7];
        if (whR && whR.status === 'fulfilled') setWarehouses(Array.isArray(whR.value.data) ? whR.value.data : []);
        if (uR && uR.status === 'fulfilled') setUsers(Array.isArray(uR.value.data) ? uR.value.data : []);
      }
    } catch (e) {
      toast.error('Failed to load some master records.');
    } finally {
      setLoading(false);
    }
  };

  const openAdd  = () => { setEditingItem(null); setForm(defaultForm()); setConfirmPassword(''); setShowModal(true); };
  const openEdit = (item) => { 
    if (activeTab === 'route') {
      const scheds = Array.isArray(item.schedules) ? item.schedules : [];
      const mTrip = scheds.find(s => s.trip_name?.toLowerCase().includes('morning') || (s.dispatch_time && parseInt(s.dispatch_time.split(':')[0], 10) < 12 && s.dispatch_type !== 'ON_DEMAND'));
      const eTrip = scheds.find(s => s.trip_name?.toLowerCase().includes('evening') || (s.dispatch_time && parseInt(s.dispatch_time.split(':')[0], 10) >= 12 && parseInt(s.dispatch_time.split(':')[0], 10) < 21 && s.dispatch_type !== 'ON_DEMAND'));
      
      let mDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      if (mTrip && mTrip.selected_days) {
        try {
          const parsed = typeof mTrip.selected_days === 'string' ? JSON.parse(mTrip.selected_days) : mTrip.selected_days;
          if (Array.isArray(parsed) && parsed.length > 0) mDays = parsed;
        } catch(e) {}
      }

      let eDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      if (eTrip && eTrip.selected_days) {
        try {
          const parsed = typeof eTrip.selected_days === 'string' ? JSON.parse(eTrip.selected_days) : eTrip.selected_days;
          if (Array.isArray(parsed) && parsed.length > 0) eDays = parsed;
        } catch(e) {}
      }

      setEditingItem(item);
      setForm({
        ...item,
        morning_enabled: !!mTrip,
        morning_cutoff: mTrip?.cutoff_time || '08:00',
        morning_dispatch: mTrip?.dispatch_time || '09:30',
        morning_days: mDays,
        evening_enabled: !!eTrip,
        evening_cutoff: eTrip?.cutoff_time || '18:00',
        evening_dispatch: eTrip?.dispatch_time || '19:30',
        evening_days: eDays
      });
      setConfirmPassword('');
      setShowModal(true);
      return;
    }
    setEditingItem(item); 
    setForm({ ...item, password: '' }); 
    setConfirmPassword(''); 
    setShowModal(true); 
  };

  const getNextWorkerCode = () => {
    if (!Array.isArray(workers) || workers.length === 0) return 'EMP-1';
    let maxNum = 0;
    workers.forEach(w => {
      const code = w?.employee_code || `EMP-${w?.id || 1}`;
      const match = String(code).match(/EMP-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });
    return `EMP-${maxNum + 1}`;
  };

  const defaultForm = () => {
    if (activeTab === 'party')     return { party_code:'', party_name:'', route_name:'', salesman:'', phone:'', gstin:'', credit_limit:'', is_active:true };
    if (activeTab === 'worker')    return { employee_code: getNextWorkerCode(), name:'', phone:'', role:'Picker', is_active:true };
    if (activeTab === 'driver')    return { name:'', phone:'', license_no:'', emergency_contact:'', route:'', is_active:true };
    if (activeTab === 'vehicle')   return { vehicle_number:'', vehicle_type:'Truck', capacity:'', registration_no:'', is_active:true };
    if (activeTab === 'route')     return { 
      route_code: '', 
      route_name: '',
      morning_enabled: true,
      morning_cutoff: '08:00',
      morning_dispatch: '09:30',
      morning_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      evening_enabled: false,
      evening_cutoff: '18:00',
      evening_dispatch: '19:30',
      evening_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    };
    if (activeTab === 'salesman')  return { name:'' };
    if (activeTab === 'warehouse') return { warehouse_code:'', warehouse_name:'', prefix_logic:'', contact_person:'', phone:'', email:'', address:'', is_active:true };
    if (activeTab === 'user')      return { full_name:'', email:'', password:'', role_name:'Operator', warehouse_id:'', is_active:true };
    return {};
  };

  const handleToggleStatus = async (item) => {
    try {
      const newStatus = !item.is_active;
      if (activeTab === 'party')     await axios.put(`/api/parties/${item.id}`, { ...item, is_active: newStatus });
      if (activeTab === 'worker')    await axios.put(`/api/masters/workers/${item.id}`, { ...item, is_active: newStatus });
      if (activeTab === 'driver')    await axios.put(`/api/masters/drivers/${item.id}`, { ...item, is_active: newStatus });
      if (activeTab === 'vehicle')   await axios.put(`/api/masters/vehicles/${item.id}`, { ...item, is_active: newStatus });
      if (activeTab === 'warehouse') await axios.put(`/api/masters/warehouses/${item.id}`, { ...item, is_active: newStatus });
      if (activeTab === 'user')      await axios.put(`/api/masters/users/${item.id}`, { ...item, is_active: newStatus });
      toast.success('Record status updated!');
      fetchAll();
    } catch { toast.error('Error toggling status.'); }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      const id = deleteItem.id;
      if (activeTab === 'party')         await axios.delete(`/api/parties/${id}`);
      else if (activeTab === 'worker')    await axios.delete(`/api/masters/workers/${id}`);
      else if (activeTab === 'driver')    await axios.delete(`/api/masters/drivers/${id}`);
      else if (activeTab === 'vehicle')   await axios.delete(`/api/masters/vehicles/${id}`);
      else if (activeTab === 'route')     await axios.delete(`/api/masters/routes/${id}`);
      else if (activeTab === 'salesman')  await axios.delete(`/api/masters/salesmen/${id}`);
      else if (activeTab === 'warehouse') await axios.delete(`/api/masters/warehouses/${id}`);
      else if (activeTab === 'user')      await axios.delete(`/api/masters/users/${id}`);
      toast.success('Record deleted successfully!');
      setDeleteItem(null);
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.message || 'Error deleting record.'); }
    finally { setDeleting(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingItem) {
        if (activeTab === 'party')         await axios.put(`/api/parties/${editingItem.id}`, form);
        else if (activeTab === 'worker')    await axios.put(`/api/masters/workers/${editingItem.id}`, form);
        else if (activeTab === 'driver')    await axios.put(`/api/masters/drivers/${editingItem.id}`, form);
        else if (activeTab === 'vehicle')   await axios.put(`/api/masters/vehicles/${editingItem.id}`, form);
        else if (activeTab === 'route')     await axios.put(`/api/masters/routes/${editingItem.id}`, form);
        else if (activeTab === 'salesman')  await axios.put(`/api/masters/salesmen/${editingItem.id}`, form);
        else if (activeTab === 'warehouse') await axios.put(`/api/masters/warehouses/${editingItem.id}`, form);
        else if (activeTab === 'user')      await axios.put(`/api/masters/users/${editingItem.id}`, form);
        toast.success('Record updated successfully!');
      } else {
        // password confirm check for users
        if (activeTab === 'user' && form.password !== confirmPassword) {
          toast.warning('Passwords do not match!'); setSubmitting(false); return;
        }
        if (activeTab === 'party')         await axios.post('/api/parties', form);
        else if (activeTab === 'worker')    await axios.post('/api/masters/workers', form);
        else if (activeTab === 'driver')    await axios.post('/api/masters/drivers', form);
        else if (activeTab === 'vehicle')   await axios.post('/api/masters/vehicles', form);
        else if (activeTab === 'route')     await axios.post('/api/masters/routes', form);
        else if (activeTab === 'salesman')  await axios.post('/api/masters/salesmen', form);
        else if (activeTab === 'warehouse') await axios.post('/api/masters/warehouses', form);
        else if (activeTab === 'user')      await axios.post('/api/masters/users', form);
        toast.success('Record created successfully!');
      }
      setShowModal(false);
      fetchAll();
    } catch (e) { toast.error(e.response?.data?.message || 'Error saving record.'); }
    finally { setSubmitting(false); }
  };

  // ── Route Schedules Handlers ──────────────────────────────────────────────
  const openScheduleModal = async (route) => {
    setScheduleModalRoute(route);
    setEditingScheduleId(null);
    setScheduleForm({
      trip_name: '',
      dispatch_type: 'FIXED_TIME',
      frequency: 'DAILY',
      selected_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      cutoff_time: '08:00',
      dispatch_time: '09:30',
      priority_order: 1,
      is_active: true
    });
    setLoadingSchedules(true);
    try {
      const res = await axios.get(`/api/masters/routes/${route.id}/schedules`);
      setRouteSchedules(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setRouteSchedules(route.schedules || []);
    } finally {
      setLoadingSchedules(false);
    }
  };

  const handleEditScheduleClick = (sched) => {
    setEditingScheduleId(sched.id);
    let parsedDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    if (sched.selected_days) {
      try {
        parsedDays = typeof sched.selected_days === 'string' ? JSON.parse(sched.selected_days) : sched.selected_days;
      } catch (e) {}
    }
    setScheduleForm({
      trip_name: sched.trip_name || '',
      dispatch_type: sched.dispatch_type || 'FIXED_TIME',
      frequency: sched.frequency || 'DAILY',
      selected_days: Array.isArray(parsedDays) ? parsedDays : ['Monday'],
      cutoff_time: sched.cutoff_time || '08:00',
      dispatch_time: sched.dispatch_time || '09:30',
      priority_order: sched.priority_order || 1,
      is_active: sched.is_active !== undefined ? !!sched.is_active : true
    });
  };

  const handleResetScheduleForm = () => {
    setEditingScheduleId(null);
    setScheduleForm({
      trip_name: 'Morning Dispatch',
      dispatch_type: 'FIXED_TIME',
      frequency: 'DAILY',
      selected_days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      cutoff_time: '08:00',
      dispatch_time: '09:30',
      priority_order: (routeSchedules?.length || 0) + 1,
      is_active: true
    });
  };

  const applyPreset = (presetType) => {
    if (presetType === 'MORNING') {
      setScheduleForm(prev => ({
        ...prev,
        trip_name: 'Morning Dispatch',
        dispatch_type: 'FIXED_TIME',
        cutoff_time: '08:00',
        dispatch_time: '09:30'
      }));
    } else if (presetType === 'EVENING') {
      setScheduleForm(prev => ({
        ...prev,
        trip_name: 'Evening Dispatch',
        dispatch_type: 'FIXED_TIME',
        cutoff_time: '18:00',
        dispatch_time: '19:30'
      }));
    } else if (presetType === 'NIGHT') {
      setScheduleForm(prev => ({
        ...prev,
        trip_name: 'Night Express Run',
        dispatch_type: 'FIXED_TIME',
        cutoff_time: '21:00',
        dispatch_time: '22:30'
      }));
    } else if (presetType === 'ON_DEMAND') {
      setScheduleForm(prev => ({
        ...prev,
        trip_name: 'On-Demand Dispatch',
        dispatch_type: 'ON_DEMAND',
        frequency: 'ON_DEMAND',
        cutoff_time: '',
        dispatch_time: ''
      }));
    }
  };

  const handle1ClickAddMorningAndEvening = async () => {
    if (!scheduleModalRoute) return;
    setSavingSchedule(true);
    try {
      const allDays = JSON.stringify(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
      
      // Add Morning Trip (08:00 cutoff / 09:30 dispatch)
      await axios.post(`/api/masters/routes/${scheduleModalRoute.id}/schedules`, {
        trip_name: 'Morning Dispatch',
        dispatch_type: 'FIXED_TIME',
        frequency: 'DAILY',
        selected_days: allDays,
        cutoff_time: '08:00',
        dispatch_time: '09:30',
        priority_order: 1,
        is_active: true
      });

      // Add Evening Trip (18:00 cutoff / 19:30 dispatch)
      await axios.post(`/api/masters/routes/${scheduleModalRoute.id}/schedules`, {
        trip_name: 'Evening Dispatch',
        dispatch_type: 'FIXED_TIME',
        frequency: 'DAILY',
        selected_days: allDays,
        cutoff_time: '18:00',
        dispatch_time: '19:30',
        priority_order: 2,
        is_active: true
      });

      toast.success('Successfully added standard Morning & Evening daily trips!');
      const res = await axios.get(`/api/masters/routes/${scheduleModalRoute.id}/schedules`);
      setRouteSchedules(Array.isArray(res.data) ? res.data : []);
      fetchAll();
    } catch (err) {
      toast.error('Failed to auto-add morning and evening trips.');
    } finally {
      setSavingSchedule(false);
    }
  };

  const fmtTime12 = (t24) => {
    if (!t24) return '';
    const parts = String(t24).split(':');
    if (parts.length < 2) return t24;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return t24;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    if (!scheduleModalRoute) return;
    setSavingSchedule(true);
    try {
      const payload = {
        ...scheduleForm,
        selected_days: JSON.stringify(scheduleForm.selected_days || [])
      };
      if (editingScheduleId) {
        await axios.put(`/api/masters/routes/${scheduleModalRoute.id}/schedules/${editingScheduleId}`, payload);
        toast.success('Dispatch trip schedule updated!');
      } else {
        await axios.post(`/api/masters/routes/${scheduleModalRoute.id}/schedules`, payload);
        toast.success('New dispatch trip schedule added!');
      }
      handleResetScheduleForm();
      const res = await axios.get(`/api/masters/routes/${scheduleModalRoute.id}/schedules`);
      setRouteSchedules(Array.isArray(res.data) ? res.data : []);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving dispatch schedule.');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleToggleSchedule = async (sched) => {
    try {
      await axios.put(`/api/masters/routes/${scheduleModalRoute.id}/schedules/${sched.id}`, {
        ...sched,
        is_active: !sched.is_active
      });
      toast.success('Schedule status toggled!');
      const res = await axios.get(`/api/masters/routes/${scheduleModalRoute.id}/schedules`);
      setRouteSchedules(Array.isArray(res.data) ? res.data : []);
      fetchAll();
    } catch {
      toast.error('Failed to toggle schedule status.');
    }
  };

  const handleDeleteSchedule = async (schedId) => {
    if (!window.confirm('Are you sure you want to delete this dispatch trip schedule?')) return;
    try {
      await axios.delete(`/api/masters/routes/${scheduleModalRoute.id}/schedules/${schedId}`);
      toast.success('Dispatch schedule deleted.');
      const res = await axios.get(`/api/masters/routes/${scheduleModalRoute.id}/schedules`);
      setRouteSchedules(Array.isArray(res.data) ? res.data : []);
      fetchAll();
    } catch {
      toast.error('Failed to delete dispatch schedule.');
    }
  };

  const toggleDayInSchedule = (day) => {
    setScheduleForm(prev => {
      const days = prev.selected_days || [];
      if (days.includes(day)) {
        return { ...prev, selected_days: days.filter(d => d !== day) };
      } else {
        return { ...prev, selected_days: [...days, day] };
      }
    });
  };

  const f = (key) => form[key] ?? '';
  const sf = (key, val) => setForm(p => ({ ...p, [key]: val }));

  // ── Filter ──────────────────────────────────────────────────────────────────
  const filtered = (arr, keys) =>
    (Array.isArray(arr) ? arr : []).filter(r => keys.some(k => String(r[k] ?? '').toLowerCase().includes((search || '').toLowerCase())));

  // ── Counts ──────────────────────────────────────────────────────────────────
  const tabCounts = {
    party: (parties || []).length, worker: (workers || []).length, driver: (drivers || []).length,
    vehicle: (vehicles || []).length, route: (routes || []).length, salesman: (salesmen || []).length,
    warehouse: (warehouses || []).length, user: (users || []).length,
  };

  // ── Status badge ────────────────────────────────────────────────────────────
  const StatusBadge = ({ active, trueLabel = 'Active', falseLabel = 'Inactive' }) => (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
      active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'
    }`}>
      {active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {active ? trueLabel : falseLabel}
    </span>
  );

  // ── Action buttons ───────────────────────────────────────────────────────────
  const ActionBtns = ({ item, hasToggle = true }) => (
    <div className="flex items-center gap-1.5">
      <button onClick={() => openEdit(item)}
        className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#004c8f] border border-blue-200 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer">
        <Edit2 className="w-3.5 h-3.5" /> Edit
      </button>
      {hasToggle && (
        <button onClick={() => handleToggleStatus(item)}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 transition-colors cursor-pointer ${
            item.is_active
              ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
          }`}>
          {item.is_active ? <ToggleLeft className="w-3.5 h-3.5" /> : <ToggleRight className="w-3.5 h-3.5" />}
          {item.is_active ? 'Suspend' : 'Activate'}
        </button>
      )}
      <button onClick={() => setDeleteItem(item)}
        className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer">
        <Trash2 className="w-3.5 h-3.5" /> Delete
      </button>
    </div>
  );

  // ── Empty Table Helper ──────────────────────────────────────────────────────
  const EmptyTable = ({ colSpan = 6, message = 'No records found' }) => (
    <tr>
      <td colSpan={colSpan} className="text-center py-16">
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 mb-1 shadow-xs">
            <Search className="w-5 h-5 text-slate-400" />
          </div>
          <p className="text-sm font-bold text-slate-800">{message}</p>
          <p className="text-xs text-slate-400">Try adjusting your search query or add a new record above.</p>
        </div>
      </td>
    </tr>
  );

  // ── Pagination Helper & Component ──────────────────────────────────────────
  const paginate = (items) => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  };

  const PaginationFooter = ({ totalItems, label = 'records' }) => {
    if (totalItems <= 0) return null;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;
    const start = (currentPage - 1) * pageSize;
    const end = Math.min(currentPage * pageSize, totalItems);

    return (
      <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 text-xs">
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
    );
  };

  const getActiveTabAddLabel = () => {
    switch (activeTab) {
      case 'party': return '+ ADD PARTY';
      case 'worker': return '+ ADD WORKER';
      case 'driver': return '+ ADD DRIVER';
      case 'vehicle': return '+ ADD VEHICLE';
      case 'route': return '+ ADD ROUTE';
      case 'salesman': return '+ ADD SALESMAN';
      case 'warehouse': return '+ ADD WAREHOUSE';
      case 'user': return '+ ADD USER ACCOUNT';
      default: return '+ ADD NEW RECORD';
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header with Add Button and Search Bar below it ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#003366] to-[#004c8f] flex items-center justify-center text-white shadow-md">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Master Registries</h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Centralized master data management for clients, warehouse personnel, fleet assets, and system configurations.
              </p>
            </div>
          </div>
        </div>

        {/* Right side: Add Button on Top, Search Bar directly below */}
        <div className="flex flex-col items-stretch sm:items-end gap-2.5">
          {activeTab !== 'system' && (
            <button
              onClick={openAdd}
              className="px-5 py-2.5 bg-[#003366] hover:bg-[#004c8f] text-white text-xs font-extrabold rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>{getActiveTabAddLabel()}</span>
            </button>
          )}

          {activeTab !== 'system' && (
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                placeholder={`Search ${TABS.find(t => t.id === activeTab)?.label}...`}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#004c8f] focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all shadow-xs"
              />
              {search && (
                <button
                  onClick={() => { setSearch(''); setCurrentPage(1); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full bg-white border border-slate-200 rounded-2xl p-2 shadow-sm">
        {visibleTabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearch(''); setCurrentPage(1); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-[#003366] text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          PARTY MASTER TABLE
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'party' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Sub-header */}
          <div className="bg-[#003366] border-b-4 border-[#ed1c24] px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Store className="w-4 h-4 text-purple-400" /> Party Master (Customers)
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Manage corporate clients, route mapping, billing limits, and warehouse assignments</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="bg-emerald-900/40 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg font-bold">
                {(parties || []).filter(p => p.is_active).length} Active
              </span>
              <span className="bg-red-900/40 text-red-400 border border-red-500/30 px-2.5 py-1 rounded-lg font-bold">
                {(parties || []).filter(p => !p.is_active).length} Suspended
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#003366] border-b-4 border-[#ed1c24]">
                  <TH>Party Code</TH>
                  <TH>Party Name</TH>
                  <TH>Route Assigned</TH>
                  <TH>Sales Representative</TH>
                  <TH>Mobile Contact</TH>
                  <TH>GST Identification</TH>
                  <TH>Credit Limit</TH>
                  <TH>Operational Status</TH>
                  <TH>Management Actions</TH>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-12 text-slate-400 text-sm font-semibold">Loading parties...</td></tr>
                ) : filtered(parties, ['party_code', 'party_name', 'route_name', 'salesman']).length === 0 ? (
                  <EmptyTable colSpan={9} message="No parties found" />
                ) : paginate(filtered(parties, ['party_code', 'party_name', 'route_name', 'salesman'])).map(p => (
                  <tr key={p.id} className="hover:bg-blue-50/40 transition-colors">
                    <TD><span className="font-mono font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">{p.party_code}</span></TD>
                    <TD><span className="font-bold text-slate-900 text-sm">{p.party_name}</span></TD>
                    <TD><span className="text-slate-700 text-sm font-medium">{p.route_name || '—'}</span></TD>
                    <TD><span className="text-slate-700 text-sm font-medium">{p.salesman || '—'}</span></TD>
                    <TD><span className="font-mono text-slate-600 text-sm">{p.phone || '—'}</span></TD>
                    <TD><span className="font-mono text-slate-500 text-xs">{p.gstin || '—'}</span></TD>
                    <TD><span className="font-bold text-slate-800 text-sm">₹{Number(p.credit_limit || 0).toLocaleString('en-IN')}</span></TD>
                    <TD><StatusBadge active={p.is_active} falseLabel="Suspended" /></TD>
                    <TD><ActionBtns item={p} /></TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationFooter totalItems={filtered(parties, ['party_code', 'party_name', 'route_name', 'salesman']).length} label="parties" />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          WORKER MASTER TABLE
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'worker' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-[#003366] border-b-4 border-[#ed1c24] px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-cyan-400" /> Floor Worker Master
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Manage pickers, checkers, packers, and helpers assigned to warehouse locations</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {['Picker','Checker','Helper'].map(role => (
                <span key={role} className="bg-slate-700 text-slate-300 border border-slate-600 px-2.5 py-1 rounded-lg font-bold">
                  {(workers || []).filter(w => w.role === role).length} {role}s
                </span>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#003366] border-b-4 border-[#ed1c24]">
                  <TH>Employee Code</TH>
                  <TH>Worker Name</TH>
                  <TH>Mobile Number</TH>
                  <TH>Role Type</TH>
                  <TH>Status</TH>
                  <TH>Actions</TH>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm font-semibold">Loading floor workers...</td></tr>
                ) : filtered(workers, ['name', 'employee_code', 'role']).length === 0 ? (
                  <EmptyTable colSpan={6} message="No floor workers found" />
                ) : paginate(filtered(workers, ['name', 'employee_code', 'role'])).map(w => (
                  <tr key={w.id} className="hover:bg-blue-50/40 transition-colors">
                    <TD><span className="font-mono font-bold text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-lg border border-cyan-200">{w.employee_code || `EMP-${w.id}`}</span></TD>
                    <TD><span className="font-bold text-slate-900 text-sm">{w.name}</span></TD>
                    <TD><span className="font-mono text-slate-600 text-sm">{w.phone || '—'}</span></TD>
                    <TD>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase ${
                        w.role === 'Picker'  ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                        w.role === 'Checker' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                        'bg-amber-100 text-amber-700 border border-amber-200'
                      }`}>{w.role}</span>
                    </TD>
                    <TD><StatusBadge active={w.is_active} falseLabel="Disabled" /></TD>
                    <TD><ActionBtns item={w} /></TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationFooter totalItems={filtered(workers, ['name', 'employee_code', 'role']).length} label="workers" />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          DRIVER FLEET TABLE
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'driver' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-[#003366] border-b-4 border-[#ed1c24] px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Truck className="w-4 h-4 text-indigo-400" /> Driver Fleet Registry
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Manage delivery fleet drivers, emergency contacts, licenses, and route allocations</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#003366] border-b-4 border-[#ed1c24]">
                  <TH>Driver</TH>
                  <TH>Mobile / Emergency</TH>
                  <TH>License No</TH>
                  <TH>Route</TH>
                  <TH>Status</TH>
                  <TH>Actions</TH>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm font-semibold">Loading driver fleet...</td></tr>
                ) : filtered(drivers, ['name', 'phone', 'license_no']).length === 0 ? (
                  <EmptyTable colSpan={6} message="No drivers found" />
                ) : paginate(filtered(drivers, ['name', 'phone', 'license_no'])).map(d => (
                  <tr key={d.id} className="hover:bg-blue-50/40 transition-colors">
                    <TD>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500/30 to-cyan-500/30 border border-slate-300 flex items-center justify-center text-xs font-extrabold text-slate-700">
                          {initials(d.name)}
                        </div>
                        <span className="font-bold text-slate-900 text-sm">{d.name}</span>
                      </div>
                    </TD>
                    <TD>
                      <div className="font-mono text-slate-700 text-sm font-semibold">{d.phone}</div>
                      {d.emergency_contact && <div className="text-xs text-slate-400 font-medium mt-0.5">SOS: {d.emergency_contact}</div>}
                    </TD>
                    <TD><span className="font-mono text-slate-600 text-sm font-semibold">{d.license_no || '—'}</span></TD>
                    <TD>{d.route ? <span className="bg-blue-50 text-[#004c8f] border border-blue-200 px-2.5 py-1 rounded-lg text-xs font-bold">{d.route}</span> : <span className="text-slate-400">—</span>}</TD>
                    <TD><StatusBadge active={d.is_active} /></TD>
                    <TD><ActionBtns item={d} /></TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationFooter totalItems={filtered(drivers, ['name', 'phone', 'license_no']).length} label="drivers" />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          VEHICLE FLEET TABLE
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'vehicle' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-[#003366] border-b-4 border-[#ed1c24] px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-400" /> Vehicle Fleet Registry
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Manage transport trucks, vans, tempos, container capacities, and registrations</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#003366] border-b-4 border-[#ed1c24]">
                  <TH>Vehicle No</TH>
                  <TH>Type</TH>
                  <TH>Capacity</TH>
                  <TH>Registration</TH>
                  <TH>Status</TH>
                  <TH>Actions</TH>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm font-semibold">Loading vehicle fleet...</td></tr>
                ) : filtered(vehicles, ['vehicle_number', 'vehicle_type', 'registration_no']).length === 0 ? (
                  <EmptyTable colSpan={6} message="No vehicles found" />
                ) : paginate(filtered(vehicles, ['vehicle_number', 'vehicle_type', 'registration_no'])).map(v => {
                  const typeColors = { Truck: 'bg-blue-100 text-blue-700 border-blue-200', Van: 'bg-emerald-100 text-emerald-700 border-emerald-200', 'Mini-Truck': 'bg-amber-100 text-amber-700 border-amber-200' };
                  const typeEmoji = { Truck: '🚛', Van: '🚐', 'Mini-Truck': '🛻', Tempo: '🚌', Container: '📦' };
                  return (
                    <tr key={v.id} className="hover:bg-blue-50/40 transition-colors">
                      <TD><span className="font-mono font-extrabold text-cyan-600 text-sm">{v.vehicle_number}</span></TD>
                      <TD>
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${typeColors[v.vehicle_type] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {typeEmoji[v.vehicle_type] || '🚗'} {v.vehicle_type}
                        </span>
                      </TD>
                      <TD><span className="text-slate-700 text-sm">{v.capacity || '—'}</span></TD>
                      <TD><span className="font-mono text-slate-500 text-xs">{v.registration_no || '—'}</span></TD>
                      <TD><StatusBadge active={v.is_active} /></TD>
                      <TD><ActionBtns item={v} /></TD>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationFooter totalItems={filtered(vehicles, ['vehicle_number', 'vehicle_type', 'registration_no']).length} label="vehicles" />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          ROUTE MASTER TABLE
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'route' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-[#003366] border-b-4 border-[#ed1c24] px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <RouteIcon className="w-4 h-4 text-emerald-400" /> Route Master &amp; Shift Schedules
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Define which routes have Morning, Evening, or Specific-Day dispatches with custom cut-off and departure timings</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="bg-emerald-900/40 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg font-bold">
                {(routes || []).length} Total Routes
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#003366] border-b-4 border-[#ed1c24]">
                  <TH>Route Details</TH>
                  <TH>🌅 Morning Dispatch</TH>
                  <TH>🌆 Evening Dispatch</TH>
                  <TH>Assigned Parties</TH>
                  <TH>Actions</TH>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-12 text-slate-400 text-sm font-semibold">Loading delivery routes...</td></tr>
                ) : filtered(routes, ['route_code', 'route_name']).length === 0 ? (
                  <EmptyTable colSpan={5} message="No routes found" />
                ) : paginate(filtered(routes, ['route_code', 'route_name'])).map(r => {
                  const scheds = Array.isArray(r.schedules) ? r.schedules : [];
                  
                  // Find Morning trip
                  const morningTrip = scheds.find(s => s.trip_name?.toLowerCase().includes('morning') || (s.dispatch_time && parseInt(s.dispatch_time.split(':')[0], 10) < 12 && s.dispatch_type !== 'ON_DEMAND'));
                  
                  // Find Evening trip
                  const eveningTrip = scheds.find(s => s.trip_name?.toLowerCase().includes('evening') || (s.dispatch_time && parseInt(s.dispatch_time.split(':')[0], 10) >= 12 && parseInt(s.dispatch_time.split(':')[0], 10) < 21 && s.dispatch_type !== 'ON_DEMAND'));

                  return (
                    <tr key={r.id} className="hover:bg-blue-50/40 transition-colors">
                      {/* Route Code & Name */}
                      <TD>
                        <div>
                          <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 text-xs">
                            {r.route_code}
                          </span>
                          <div className="font-bold text-slate-900 text-sm mt-1">{r.route_name}</div>
                        </div>
                      </TD>

                      {/* 🌅 Morning Slot */}
                      <TD>
                        {morningTrip ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-extrabold bg-amber-50 text-amber-900 border border-amber-200">
                                <Sunrise className="w-3 h-3 text-amber-600" />
                                Active
                              </span>
                              {morningTrip.frequency === 'WEEKLY_SPECIFIC_DAYS' && morningTrip.selected_days ? (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200">
                                  {(() => {
                                    try {
                                      const d = typeof morningTrip.selected_days === 'string' ? JSON.parse(morningTrip.selected_days) : morningTrip.selected_days;
                                      return Array.isArray(d) && d.length < 7 ? d.map(x => x.slice(0, 3)).join(', ') : 'Daily';
                                    } catch(e) { return 'Custom'; }
                                  })()}
                                </span>
                              ) : (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-700">
                                  Daily (All Days)
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-slate-600">
                              Cutoff: <strong className="text-amber-800">{fmtTime12(morningTrip.cutoff_time)}</strong> • Disp: <strong className="text-blue-800">{fmtTime12(morningTrip.dispatch_time)}</strong>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs font-semibold italic bg-slate-50 px-2 py-1 rounded border border-slate-200">
                            No Morning Shift
                          </span>
                        )}
                      </TD>

                      {/* 🌆 Evening Slot */}
                      <TD>
                        {eveningTrip ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-extrabold bg-indigo-50 text-indigo-900 border border-indigo-200">
                                <Sunset className="w-3 h-3 text-indigo-600" />
                                Active
                              </span>
                              {eveningTrip.frequency === 'WEEKLY_SPECIFIC_DAYS' && eveningTrip.selected_days ? (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200">
                                  {(() => {
                                    try {
                                      const d = typeof eveningTrip.selected_days === 'string' ? JSON.parse(eveningTrip.selected_days) : eveningTrip.selected_days;
                                      return Array.isArray(d) && d.length < 7 ? d.map(x => x.slice(0, 3)).join(', ') : 'Daily';
                                    } catch(e) { return 'Custom'; }
                                  })()}
                                </span>
                              ) : (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-700">
                                  Daily (All Days)
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-slate-600">
                              Cutoff: <strong className="text-amber-800">{fmtTime12(eveningTrip.cutoff_time)}</strong> • Disp: <strong className="text-blue-800">{fmtTime12(eveningTrip.dispatch_time)}</strong>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs font-semibold italic bg-slate-50 px-2 py-1 rounded border border-slate-200">
                            No Evening Shift
                          </span>
                        )}
                      </TD>

                      {/* Assigned Parties */}
                      <TD>
                        <span className="bg-blue-50 text-[#004c8f] border border-blue-200 px-2.5 py-1 rounded-lg text-xs font-bold">
                          {(parties || []).filter(p => p.route_name === r.route_name).length} Parties
                        </span>
                      </TD>

                      {/* Actions */}
                      <TD>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => openEdit(r)}
                            className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#004c8f] border border-blue-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs">
                            <Edit2 className="w-3.5 h-3.5" /> Edit Shift &amp; Days
                          </button>
                          <button onClick={() => setDeleteItem(r)}
                            className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold flex items-center gap-1 cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      </TD>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationFooter totalItems={filtered(routes, ['route_code', 'route_name']).length} label="routes" />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SALESMAN MASTER TABLE
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'salesman' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-[#003366] border-b-4 border-[#ed1c24] px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-amber-400" /> Salesman Master
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Sales representatives assigned to customer parties</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#003366] border-b-4 border-[#ed1c24]">
                  <TH>#</TH>
                  <TH>Salesman Name</TH>
                  <TH>Assigned Parties</TH>
                  <TH>Actions</TH>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={4} className="text-center py-12 text-slate-400 text-sm font-semibold">Loading salesmen...</td></tr>
                ) : filtered(salesmen, ['name']).length === 0 ? (
                  <EmptyTable colSpan={4} message="No salesmen found" />
                ) : paginate(filtered(salesmen, ['name'])).map((s, i) => (
                  <tr key={s.id || i} className="hover:bg-blue-50/40 transition-colors">
                    <TD><span className="text-slate-500 font-bold text-sm">{(currentPage - 1) * pageSize + i + 1}</span></TD>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center text-xs font-extrabold text-amber-700">
                          {initials(s.name)}
                        </div>
                        <span className="font-bold text-slate-900 text-sm">{s.name}</span>
                      </div>
                    </TD>
                    <TD>
                      <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-lg text-xs font-bold">
                        {(parties || []).filter(p => p.salesman === s.name).length} Parties
                      </span>
                    </TD>
                    <TD>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => openEdit(s)}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#004c8f] border border-blue-200 text-xs font-bold flex items-center gap-1 cursor-pointer">
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button onClick={() => setDeleteItem(s)}
                          className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold flex items-center gap-1 cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationFooter totalItems={filtered(salesmen, ['name']).length} label="salesmen" />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          WAREHOUSE MASTER TABLE
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'warehouse' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-[#003366] border-b-4 border-[#ed1c24] px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <WarehouseIcon className="w-4 h-4 text-purple-400" /> Warehouse Management
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Register, edit, and manage multi-warehouse domains with prefix logic</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="bg-emerald-900/40 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg font-bold">
                {(warehouses || []).filter(w => w.is_active).length} Active
              </span>
              <span className="bg-red-900/40 text-red-400 border border-red-500/30 px-2.5 py-1 rounded-lg font-bold">
                {(warehouses || []).filter(w => !w.is_active).length} Inactive
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#003366] border-b-4 border-[#ed1c24]">
                  <TH>Warehouse Code</TH>
                  <TH>Warehouse Name</TH>
                  <TH>Prefix Logic</TH>
                  <TH>Contact Person</TH>
                  <TH>Mobile</TH>
                  <TH>Email Address</TH>
                  <TH>Status</TH>
                  <TH>Actions</TH>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-12 text-slate-400 text-sm font-semibold">Loading warehouses...</td></tr>
                ) : filtered(warehouses, ['warehouse_code', 'warehouse_name', 'contact_person']).length === 0 ? (
                  <EmptyTable colSpan={8} message="No warehouses found" />
                ) : paginate(filtered(warehouses, ['warehouse_code', 'warehouse_name', 'contact_person'])).map(wh => (
                  <tr key={wh.id} className="hover:bg-blue-50/40 transition-colors">
                    <TD><span className="font-mono font-extrabold text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-lg border border-cyan-200">{wh.warehouse_code || wh.code}</span></TD>
                    <TD><span className="font-bold text-slate-900 text-sm">{wh.warehouse_name || wh.name}</span></TD>
                    <TD><span className="font-mono text-slate-600 text-sm font-semibold">{wh.prefix_logic || '—'}</span></TD>
                    <TD><span className="text-slate-700 text-sm font-medium">{wh.contact_person || '—'}</span></TD>
                    <TD><span className="font-mono text-slate-600 text-sm">{wh.phone || wh.mobile || '—'}</span></TD>
                    <TD><span className="text-slate-500 text-sm">{wh.email || '—'}</span></TD>
                    <TD><StatusBadge active={wh.is_active} /></TD>
                    <TD><ActionBtns item={wh} /></TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationFooter totalItems={filtered(warehouses, ['warehouse_code', 'warehouse_name', 'contact_person']).length} label="warehouses" />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          USER ACCOUNT MASTER TABLE
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'user' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-[#003366] border-b-4 border-[#ed1c24] px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400" /> User Account Master
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Manage system operators, warehouse administrators, auditors, and security roles</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="bg-emerald-900/40 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg font-bold">
                {(users || []).filter(u => u.is_active).length} Active
              </span>
              <span className="bg-red-900/40 text-red-400 border border-red-500/30 px-2.5 py-1 rounded-lg font-bold">
                {(users || []).filter(u => !u.is_active).length} Disabled
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[#003366] border-b-4 border-[#ed1c24]">
                  <TH>Full Name</TH>
                  <TH>Email Address (Login ID)</TH>
                  <TH>Security Role</TH>
                  <TH>Last Active Login</TH>
                  <TH>Status</TH>
                  <TH>Actions</TH>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400 text-sm font-semibold">Loading user accounts...</td></tr>
                ) : filtered(users, ['full_name', 'email', 'role_name']).length === 0 ? (
                  <EmptyTable colSpan={6} message="No users found" />
                ) : paginate(filtered(users, ['full_name', 'email', 'role_name'])).map(u => {
                  const roleBadge = {
                    'Super Admin':      'bg-red-100 text-red-700 border-red-200',
                    'Warehouse Admin':  'bg-amber-100 text-amber-700 border-amber-200',
                    'Operator':         'bg-purple-100 text-purple-700 border-purple-200',
                    'Auditor':          'bg-blue-100 text-blue-700 border-blue-200',
                    'Viewer':           'bg-blue-100 text-blue-700 border-blue-200',
                  }[u.role_name] || 'bg-slate-100 text-slate-600 border-slate-200';
                  return (
                    <tr key={u.id} className="hover:bg-blue-50/40 transition-colors">
                      <TD>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-xs font-extrabold text-indigo-700">
                            {initials(u.full_name || u.name || '')}
                          </div>
                          <span className="font-bold text-slate-900 text-sm">{u.full_name || u.name}</span>
                        </div>
                      </TD>
                      <TD><span className="font-mono text-slate-600 text-sm">{u.email}</span></TD>
                      <TD>
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border ${roleBadge}`}>
                          {u.role_name}
                        </span>
                      </TD>
                      <TD>
                        <span className="font-mono text-slate-500 text-xs">
                          {u.last_login ? new Date(u.last_login).toLocaleString('en-IN') : 'Never'}
                        </span>
                      </TD>
                      <TD><StatusBadge active={u.is_active} falseLabel="Disabled" /></TD>
                      <TD><ActionBtns item={u} /></TD>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationFooter totalItems={filtered(users, ['full_name', 'email', 'role_name']).length} label="users" />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          DATABASE & SYSTEM SETTINGS TAB
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-[#003366] border-b-4 border-[#ed1c24] px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400" /> Enterprise Database Configuration
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Configure live MySQL database credentials, test connectivity, and auto-sync schema
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-blue-900/60 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-lg text-xs font-bold font-mono">
                  Engine: {sysConfig.dbType || 'MYSQL'}
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveSysConfig} className="p-6 space-y-6">
              {/* Database Engine Selector */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                  Active Database Engine
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { id: 'MYSQL', label: '🐬 MySQL (Primary)', desc: 'Enterprise MySQL / MariaDB' },
                    { id: 'SQLITE', label: '📁 SQLite (File)', desc: 'Local Embedded File Store' },
                    { id: 'MSSQL', label: '🏢 Microsoft SQL Server', desc: 'Enterprise MSSQL Cluster' },
                    { id: 'POSTGRES', label: '🐘 PostgreSQL', desc: 'Open Source Relational' }
                  ].map(engine => (
                    <button
                      key={engine.id}
                      type="button"
                      onClick={() => setSysConfig(prev => ({ ...prev, dbType: engine.id }))}
                      className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                        sysConfig.dbType === engine.id
                          ? 'border-[#004c8f] bg-blue-50/60 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                      }`}
                    >
                      <div className="font-bold text-sm text-slate-900">{engine.label}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{engine.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* MySQL Settings */}
              {sysConfig.dbType === 'MYSQL' && (
                <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-200 space-y-4">
                  <div className="text-xs font-extrabold text-[#003366] uppercase tracking-wider flex items-center gap-1.5">
                    🐬 MySQL Server Parameters
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Host / IP Address</label>
                      <input
                        type="text"
                        value={sysConfig.mysql?.host || ''}
                        onChange={e => setSysConfig(prev => ({ ...prev, mysql: { ...prev.mysql, host: e.target.value } }))}
                        placeholder="127.0.0.1"
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:border-[#004c8f]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Port</label>
                      <input
                        type="number"
                        value={sysConfig.mysql?.port || 3306}
                        onChange={e => setSysConfig(prev => ({ ...prev, mysql: { ...prev.mysql, port: parseInt(e.target.value, 10) } }))}
                        placeholder="3306"
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:border-[#004c8f]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Database Name</label>
                      <input
                        type="text"
                        value={sysConfig.mysql?.database || ''}
                        onChange={e => setSysConfig(prev => ({ ...prev, mysql: { ...prev.mysql, database: e.target.value } }))}
                        placeholder="wms_enterprise_db"
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:border-[#004c8f]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Username</label>
                      <input
                        type="text"
                        value={sysConfig.mysql?.user || ''}
                        onChange={e => setSysConfig(prev => ({ ...prev, mysql: { ...prev.mysql, user: e.target.value } }))}
                        placeholder="root"
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:border-[#004c8f]"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-600 mb-1">Password</label>
                      <input
                        type="password"
                        value={sysConfig.mysql?.password || ''}
                        onChange={e => setSysConfig(prev => ({ ...prev, mysql: { ...prev.mysql, password: e.target.value } }))}
                        placeholder="MySQL Password"
                        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:border-[#004c8f]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* SQLite Settings */}
              {sysConfig.dbType === 'SQLITE' && (
                <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-200 space-y-4">
                  <div className="text-xs font-extrabold text-[#003366] uppercase tracking-wider">
                    📁 SQLite Storage File
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Database File Relative Path</label>
                    <input
                      type="text"
                      value={sysConfig.sqlite?.dbPath || ''}
                      onChange={e => setSysConfig(prev => ({ ...prev, sqlite: { ...prev.sqlite, dbPath: e.target.value } }))}
                      placeholder="data/wms_enterprise.db"
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:border-[#004c8f]"
                    />
                  </div>
                </div>
              )}

              {/* Connection Test Result Banner */}
              {testResult && (
                <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                  testResult.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-red-50 border-red-300 text-red-800'
                }`}>
                  {testResult.success ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />}
                  <div className="text-sm">
                    <div className="font-bold">{testResult.success ? 'Connection Successful!' : 'Connection Error'}</div>
                    <div className="text-xs mt-0.5">{testResult.message}</div>
                    {testResult.tablesFound !== undefined && (
                      <div className="text-xs font-mono font-semibold mt-1">Tables Found in Database: {testResult.tablesFound}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Auto Sync Result Banner */}
              {syncResult && (
                <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                  syncResult.success
                    ? 'bg-blue-50 border-blue-300 text-blue-800'
                    : 'bg-red-50 border-red-300 text-red-800'
                }`}>
                  {syncResult.success ? <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />}
                  <div className="text-sm">
                    <div className="font-bold">{syncResult.message}</div>
                    {syncResult.details && (
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2 font-mono text-xs">
                        <div className="bg-white/80 p-1.5 rounded border border-blue-200">Warehouses: {syncResult.details.warehouses}</div>
                        <div className="bg-white/80 p-1.5 rounded border border-blue-200">Parties: {syncResult.details.parties}</div>
                        <div className="bg-white/80 p-1.5 rounded border border-blue-200">Pick Tickets: {syncResult.details.pickTickets}</div>
                        <div className="bg-white/80 p-1.5 rounded border border-blue-200">Billings: {syncResult.details.billings}</div>
                        <div className="bg-white/80 p-1.5 rounded border border-blue-200">Audit Logs: {syncResult.details.auditLogs}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleTestDb}
                    disabled={testingDb}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-extrabold tracking-wide uppercase transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {testingDb ? 'Testing Connection...' : '⚡ Test Connection'}
                  </button>
                  <button
                    type="button"
                    onClick={handle1ClickSync}
                    disabled={syncingDb}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold tracking-wide uppercase transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    {syncingDb ? 'Syncing Tables...' : '🔄 1-Click Auto-Sync Schema'}
                  </button>
                </div>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#004c8f] hover:bg-[#003a6d] text-white rounded-xl text-xs font-extrabold tracking-wide uppercase transition-colors shadow cursor-pointer"
                >
                  Save Database Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          DELETE CONFIRM MODAL
      ═══════════════════════════════════════════════════════════════ */}
      {deleteItem && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-sm border border-slate-200 shadow-2xl overflow-hidden">
            <div className="bg-[#0f172a] px-6 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white">Confirm Delete</h3>
                <p className="text-[11px] text-slate-400">This action cannot be undone</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-700 font-medium">
                Are you sure you want to permanently delete{' '}
                <strong className="text-slate-900">
                  {deleteItem.party_name || deleteItem.name || deleteItem.route_name || deleteItem.vehicle_number || ''}
                </strong>
                {deleteItem.party_code && <span className="font-mono text-purple-600 ml-1">({deleteItem.party_code})</span>}
                {deleteItem.employee_code && <span className="font-mono text-cyan-600 ml-1">({deleteItem.employee_code})</span>}
                ?
              </p>
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-200">
                <button onClick={() => setDeleteItem(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold cursor-pointer transition-colors">
                  Cancel
                </button>
                <button onClick={handleDelete} disabled={deleting}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2 transition-colors">
                  <Trash2 className="w-4 h-4" />
                  {deleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          ADD / EDIT MODAL
      ═══════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-2xl border border-slate-200 shadow-2xl my-3 sm:my-8 overflow-hidden max-h-[92vh] flex flex-col">
            {/* Modal dark header */}
            <div className="bg-[#003366] border-b-4 border-[#ed1c24] px-4 sm:px-8 py-3.5 sm:py-5 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#004c8f] flex items-center justify-center shadow shrink-0">
                  {activeTab === 'party'     && <Store className="w-5 h-5 text-white" />}
                  {activeTab === 'worker'    && <UserCheck className="w-5 h-5 text-white" />}
                  {activeTab === 'driver'    && <Truck className="w-5 h-5 text-white" />}
                  {activeTab === 'vehicle'   && <Briefcase className="w-5 h-5 text-white" />}
                  {activeTab === 'route'     && <RouteIcon className="w-5 h-5 text-white" />}
                  {activeTab === 'salesman'  && <User className="w-5 h-5 text-white" />}
                  {activeTab === 'warehouse' && <WarehouseIcon className="w-5 h-5 text-white" />}
                  {activeTab === 'user'      && <ShieldCheck className="w-5 h-5 text-white" />}
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                    {editingItem ? 'Edit' : 'Register New'} {TABS.find(t => t.id === activeTab)?.label}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-400 font-medium">Fill in all required fields marked with <span className="text-red-500 font-bold">*</span></p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold cursor-pointer"
                title="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 sm:p-8 space-y-5 overflow-y-auto flex-1">

              {/* ── PARTY FORM ── */}
              {activeTab === 'party' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Party Code / ID <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <input value={f('party_code')} onChange={e => sf('party_code', e.target.value.toUpperCase())} required placeholder="e.g. PTY-001"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-mono font-bold text-slate-900 uppercase focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Party / Client Business Name <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <input value={f('party_name')} onChange={e => sf('party_name', e.target.value)} required placeholder="e.g. Acme SuperMarkets"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Delivery Route <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <select value={f('route_name')} onChange={e => sf('route_name', e.target.value)} required
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors">
                        <option value="">-- Select Route --</option>
                        {(routes || []).map(r => <option key={r.id} value={r.route_name}>{r.route_name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Assigned Salesman <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <select value={f('salesman')} onChange={e => sf('salesman', e.target.value)} required
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors">
                        <option value="">-- Select Salesman --</option>
                        {(salesmen || []).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Mobile Contact</label>
                      <input value={f('phone')} onChange={e => sf('phone', e.target.value)} placeholder="+91 98765 43210" type="tel"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-mono text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">GST Number</label>
                      <input value={f('gstin')} onChange={e => sf('gstin', e.target.value.toUpperCase())} placeholder="07AAAAA0000A1Z5"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-mono text-slate-900 uppercase focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Credit Limit (₹)</label>
                    <input value={f('credit_limit')} onChange={e => sf('credit_limit', e.target.value)} type="number" min="0" placeholder="500000"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                  </div>
                </>
              )}

              {/* ── WORKER FORM ── */}
              {activeTab === 'worker' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Employee Code / ID <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <input value={f('employee_code')} onChange={e => sf('employee_code', e.target.value.toUpperCase())} required placeholder="e.g. EMP-10492"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-mono font-bold text-slate-900 uppercase focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Worker Full Name <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <input value={f('name')} onChange={e => sf('name', e.target.value)} required placeholder="e.g. Ramesh Kumar"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Mobile Number</label>
                      <input value={f('phone')} onChange={e => sf('phone', e.target.value)} placeholder="+91 98765 43210" type="tel"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-mono text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Operational Floor Role <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <select value={f('role')} onChange={e => sf('role', e.target.value)} required
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors">
                        <option value="Picker">Picker (Fulfillment)</option>
                        <option value="Checker">Checker (Quality Assurance)</option>
                        <option value="Helper">Helper (Sorting &amp; Support)</option>
                      </select>
                    </div>
                  </div>
                  <label className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                    <input type="checkbox" checked={!!f('is_active')} onChange={e => sf('is_active', e.target.checked)} className="w-4 h-4 accent-blue-600" />
                    <span className="text-sm font-semibold text-slate-700">Active &amp; Available for Shifts</span>
                  </label>
                </>
              )}

              {/* ── DRIVER FORM ── */}
              {activeTab === 'driver' && (
                <>
                  <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 mb-2">
                    <p className="text-xs font-extrabold text-indigo-700 uppercase tracking-widest">Driver Identity</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Driver Name <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <input value={f('name')} onChange={e => sf('name', e.target.value)} required placeholder="e.g. Ravi Kumar"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Mobile Number <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <input value={f('phone')} onChange={e => sf('phone', e.target.value)} required placeholder="+91 98765 43210" type="tel"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-mono text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">License Number <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <input value={f('license_no')} onChange={e => sf('license_no', e.target.value.toUpperCase())} required placeholder="MH14-20110012345"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-mono uppercase text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Emergency Contact</label>
                      <input value={f('emergency_contact')} onChange={e => sf('emergency_contact', e.target.value)} placeholder="+91 98765 00000" type="tel"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-mono text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Assigned Route</label>
                    <input value={f('route')} onChange={e => sf('route', e.target.value)} placeholder="ANY (Default)"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                  </div>
                  <label className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                    <input type="checkbox" checked={!!f('is_active')} onChange={e => sf('is_active', e.target.checked)} className="w-4 h-4 accent-blue-600" />
                    <span className="text-sm font-semibold text-slate-700">Driver is Active and available for dispatch scheduling</span>
                  </label>
                </>
              )}

              {/* ── VEHICLE FORM ── */}
              {activeTab === 'vehicle' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Vehicle Number <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <input value={f('vehicle_number')} onChange={e => sf('vehicle_number', e.target.value.toUpperCase())} required placeholder="TX-TRUCK-01"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-mono font-bold uppercase text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Vehicle Type <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <select value={f('vehicle_type')} onChange={e => sf('vehicle_type', e.target.value)} required
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors">
                        <option value="Truck">🚛 Truck</option>
                        <option value="Van">🚐 Van</option>
                        <option value="Mini-Truck">🛻 Mini-Truck</option>
                        <option value="Tempo">🚌 Tempo</option>
                        <option value="Container">📦 Container</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Capacity</label>
                      <input value={f('capacity')} onChange={e => sf('capacity', e.target.value)} placeholder="5 Ton / 50 Cartons"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Registration No</label>
                      <input value={f('registration_no')} onChange={e => sf('registration_no', e.target.value.toUpperCase())} placeholder="MH-12-TX-9932"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-mono uppercase text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                    </div>
                  </div>
                  <label className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                    <input type="checkbox" checked={!!f('is_active')} onChange={e => sf('is_active', e.target.checked)} className="w-4 h-4 accent-blue-600" />
                    <span className="text-sm font-semibold text-slate-700">Vehicle is Active and available for dispatch</span>
                  </label>
                </>
              )}

              {/* ── ROUTE FORM ── */}
              {activeTab === 'route' && (
                <div className="space-y-4">
                  {/* Route Basic Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Route Code <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <input value={f('route_code')} onChange={e => sf('route_code', e.target.value.toUpperCase())} required placeholder="e.g. BHIWADI / MAN-01"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-mono font-bold uppercase text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Route Name <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <input value={f('route_name')} onChange={e => sf('route_name', e.target.value)} required placeholder="e.g. Bhiwadi Industrial Route"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                    </div>
                  </div>

                  {/* 🌅 Morning Shift Configuration */}
                  <div className={`p-4 rounded-2xl border transition-all ${
                    f('morning_enabled') 
                      ? 'bg-amber-50/50 border-amber-300 shadow-xs' 
                      : 'bg-slate-50 border-slate-200 opacity-75'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!f('morning_enabled')}
                          onChange={e => sf('morning_enabled', e.target.checked)}
                          className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                        />
                        <span className="text-xs font-extrabold text-amber-950 uppercase flex items-center gap-1.5">
                          <Sunrise className="w-4 h-4 text-amber-600" /> 🌅 Morning Dispatch Slot
                        </span>
                      </label>
                      {f('morning_enabled') && (
                        <span className="text-[11px] font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-md">
                          Active
                        </span>
                      )}
                    </div>

                    {f('morning_enabled') && (
                      <div className="space-y-3 pt-1">
                        {/* Cutoff & Dispatch Times */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] font-extrabold text-slate-700 uppercase">Order Cut-off Time</label>
                              <span className="text-[10px] font-mono font-bold text-amber-700">{fmtTime12(f('morning_cutoff') || '08:00')}</span>
                            </div>
                            <input
                              type="time"
                              value={f('morning_cutoff') || '08:00'}
                              onChange={e => sf('morning_cutoff', e.target.value)}
                              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#004c8f]"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] font-extrabold text-slate-700 uppercase">Vehicle Dispatch Time</label>
                              <span className="text-[10px] font-mono font-bold text-blue-700">{fmtTime12(f('morning_dispatch') || '09:30')}</span>
                            </div>
                            <input
                              type="time"
                              value={f('morning_dispatch') || '09:30'}
                              onChange={e => sf('morning_dispatch', e.target.value)}
                              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#004c8f]"
                            />
                          </div>
                        </div>

                        {/* Morning Days Selection */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-extrabold text-slate-700 uppercase">Morning Dispatch Days:</span>
                            <div className="flex gap-2 text-[10px]">
                              <button
                                type="button"
                                onClick={() => sf('morning_days', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])}
                                className="font-bold text-[#004c8f] hover:underline cursor-pointer"
                              >
                                All Days (Daily)
                              </button>
                              <span className="text-slate-300">|</span>
                              <button
                                type="button"
                                onClick={() => sf('morning_days', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])}
                                className="font-bold text-[#004c8f] hover:underline cursor-pointer"
                              >
                                Mon-Sat
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                              const activeDays = Array.isArray(f('morning_days')) ? f('morning_days') : [];
                              const isSelected = activeDays.includes(day);
                              return (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => {
                                    const next = isSelected ? activeDays.filter(d => d !== day) : [...activeDays, day];
                                    sf('morning_days', next);
                                  }}
                                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  {day.slice(0, 3)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 🌆 Evening Shift Configuration */}
                  <div className={`p-4 rounded-2xl border transition-all ${
                    f('evening_enabled') 
                      ? 'bg-indigo-50/50 border-indigo-300 shadow-xs' 
                      : 'bg-slate-50 border-slate-200 opacity-75'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!f('evening_enabled')}
                          onChange={e => sf('evening_enabled', e.target.checked)}
                          className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                        />
                        <span className="text-xs font-extrabold text-indigo-950 uppercase flex items-center gap-1.5">
                          <Sunset className="w-4 h-4 text-indigo-600" /> 🌆 Evening Dispatch Slot
                        </span>
                      </label>
                      {f('evening_enabled') && (
                        <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-md">
                          Active
                        </span>
                      )}
                    </div>

                    {f('evening_enabled') && (
                      <div className="space-y-3 pt-1">
                        {/* Cutoff & Dispatch Times */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] font-extrabold text-slate-700 uppercase">Order Cut-off Time</label>
                              <span className="text-[10px] font-mono font-bold text-amber-700">{fmtTime12(f('evening_cutoff') || '18:00')}</span>
                            </div>
                            <input
                              type="time"
                              value={f('evening_cutoff') || '18:00'}
                              onChange={e => sf('evening_cutoff', e.target.value)}
                              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#004c8f]"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] font-extrabold text-slate-700 uppercase">Vehicle Dispatch Time</label>
                              <span className="text-[10px] font-mono font-bold text-blue-700">{fmtTime12(f('evening_dispatch') || '19:30')}</span>
                            </div>
                            <input
                              type="time"
                              value={f('evening_dispatch') || '19:30'}
                              onChange={e => sf('evening_dispatch', e.target.value)}
                              className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#004c8f]"
                            />
                          </div>
                        </div>

                        {/* Evening Days Selection */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-extrabold text-slate-700 uppercase">Evening Dispatch Days:</span>
                            <div className="flex gap-2 text-[10px]">
                              <button
                                type="button"
                                onClick={() => sf('evening_days', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])}
                                className="font-bold text-[#004c8f] hover:underline cursor-pointer"
                              >
                                All Days (Daily)
                              </button>
                              <span className="text-slate-300">|</span>
                              <button
                                type="button"
                                onClick={() => sf('evening_days', ['Tuesday', 'Friday'])}
                                className="font-bold text-indigo-700 hover:underline cursor-pointer"
                              >
                                Tue &amp; Fri
                              </button>
                              <span className="text-slate-300">|</span>
                              <button
                                type="button"
                                onClick={() => sf('evening_days', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])}
                                className="font-bold text-[#004c8f] hover:underline cursor-pointer"
                              >
                                Mon-Sat
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                              const activeDays = Array.isArray(f('evening_days')) ? f('evening_days') : [];
                              const isSelected = activeDays.includes(day);
                              return (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => {
                                    const next = isSelected ? activeDays.filter(d => d !== day) : [...activeDays, day];
                                    sf('evening_days', next);
                                  }}
                                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  {day.slice(0, 3)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── SALESMAN FORM ── */}
              {activeTab === 'salesman' && (
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Salesman Full Name <span className="text-red-500 font-bold ml-0.5">*</span></label>
                  <input value={f('name')} onChange={e => sf('name', e.target.value)} required placeholder="e.g. Rajesh Kumar"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                </div>
              )}

              {/* ── WAREHOUSE FORM ── */}
              {activeTab === 'warehouse' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Warehouse Code <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <input value={f('warehouse_code')} onChange={e => sf('warehouse_code', e.target.value.toUpperCase())} required placeholder="e.g. WH03"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-mono font-bold uppercase text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Warehouse Name <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <input value={f('warehouse_name')} onChange={e => sf('warehouse_name', e.target.value)} required placeholder="e.g. Delhi North Hub"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Prefix Logic <span className="text-red-500 font-bold ml-0.5">*</span>
                        <span className="ml-1 text-[10px] text-slate-400 normal-case font-normal">(auto-prepended to pick ticket numbers)</span>
                      </label>
                      <input value={f('prefix_logic')} onChange={e => sf('prefix_logic', e.target.value.toUpperCase())} required placeholder="e.g. PIK26-"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-mono font-bold uppercase text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Contact Person <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <input value={f('contact_person')} onChange={e => sf('contact_person', e.target.value)} required placeholder="e.g. Ramesh Sharma"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Mobile Number <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <input value={f('phone')} onChange={e => sf('phone', e.target.value)} required placeholder="+91 98765 43210" type="tel"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-mono text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Email Address <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <input value={f('email')} onChange={e => sf('email', e.target.value)} required placeholder="admin@warehouse.com" type="email"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Physical Address <span className="text-red-500 font-bold ml-0.5">*</span></label>
                    <input value={f('address')} onChange={e => sf('address', e.target.value)} required placeholder="e.g. 104 Industrial Area, Building B, New Delhi"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                  </div>
                  <label className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                    <input type="checkbox" checked={!!f('is_active')} onChange={e => sf('is_active', e.target.checked)} className="w-4 h-4 accent-blue-600" />
                    <span className="text-sm font-semibold text-slate-700">Set Active on Registration</span>
                  </label>
                </>
              )}

              {/* ── USER FORM ── */}
              {activeTab === 'user' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Full Name <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <input value={f('full_name')} onChange={e => sf('full_name', e.target.value)} required placeholder="e.g. Liam Johnson"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Email Address (Login ID) <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <input value={f('email')} onChange={e => sf('email', e.target.value)} required placeholder="e.g. liam@wmsenterprise.com" type="email"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                    </div>
                  </div>
                  {!editingItem && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Login Password <span className="text-red-500 font-bold ml-0.5">*</span></label>
                        <input value={f('password')} onChange={e => sf('password', e.target.value)} required placeholder="Password" type="password"
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                      </div>
                      <div>
                        <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Confirm Password <span className="text-red-500 font-bold ml-0.5">*</span></label>
                        <input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="Confirm Password" type="password"
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors" />
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Security Access Role <span className="text-red-500 font-bold ml-0.5">*</span></label>
                      <select value={f('role_name')} onChange={e => sf('role_name', e.target.value)} required
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors">
                        <option value="Super Admin">Super Admin</option>
                        <option value="Warehouse Admin">Warehouse Admin</option>
                        <option value="Operator">Operator</option>
                        <option value="Auditor">Auditor</option>
                        <option value="Viewer">Viewer</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-1.5">Authorized Warehouse Context</label>
                      <select value={f('warehouse_id')} onChange={e => sf('warehouse_id', e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 focus:border-[#004c8f] focus:bg-white focus:outline-none transition-colors">
                        <option value="">Global / All Warehouses</option>
                        {(warehouses || []).map(wh => (
                          <option key={wh.id} value={wh.id}>{wh.warehouse_name || wh.name} ({wh.warehouse_code || wh.code})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <label className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                    <input type="checkbox" checked={!!f('is_active')} onChange={e => sf('is_active', e.target.checked)} className="w-4 h-4 accent-blue-600" />
                    <span className="text-sm font-semibold text-slate-700">Account is Active and permitted to sign in</span>
                  </label>
                </>
              )}

              {/* Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold cursor-pointer transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="px-8 py-3 bg-[#004c8f] hover:bg-[#003a6d] text-white rounded-xl text-sm font-bold uppercase tracking-wider shadow-md disabled:opacity-50 cursor-pointer transition-colors">
                  {submitting ? 'Saving...' : editingItem ? 'Save Changes' : 'Register Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          ROUTE SCHEDULES CONFIGURATION MODAL (SINGLE SOURCE OF TRUTH)
      ═══════════════════════════════════════════════════════════════ */}
      {scheduleModalRoute && (
        <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl w-full max-w-4xl border border-slate-200 shadow-2xl my-4 overflow-hidden max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-[#003366] border-b-4 border-[#ed1c24] px-6 py-4 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
                    <span>Dispatch Schedules:</span>
                    <span className="text-emerald-300 font-mono">{scheduleModalRoute.route_name}</span>
                    <span className="text-xs font-mono bg-white/10 text-slate-200 px-2 py-0.5 rounded">
                      {scheduleModalRoute.route_code}
                    </span>
                  </h3>
                  <p className="text-[11px] sm:text-xs text-slate-300">
                    Configure multi-trip daily dispatches, weekday-specific departures, cutoff timings, and on-demand triggers.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setScheduleModalRoute(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold cursor-pointer transition-colors"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Clean Tabular Form */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5">
              {/* Top Quick Action Presets Bar */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    Quick Dispatch Setup:
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Add standard slots in 1-click or customize timings below.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handle1ClickAddMorningAndEvening}
                    disabled={savingSchedule}
                    className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-indigo-600 hover:opacity-95 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                  >
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>1-Click Morning &amp; Evening Setup</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('MORNING')}
                    className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Sunrise className="w-3.5 h-3.5 text-amber-600" />
                    <span>+ Morning (08:00)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('EVENING')}
                    className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Sunset className="w-3.5 h-3.5 text-indigo-600" />
                    <span>+ Evening (18:00)</span>
                  </button>
                </div>
              </div>

              {/* Main Tabular Schedule Table */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="bg-[#003366] px-5 py-3.5 flex items-center justify-between text-white">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-extrabold uppercase tracking-wider">
                      Configured Route Trips ({routeSchedules.length})
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-300">
                    Active trips automatically feed the Operations Console
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Slot / Shift</th>
                        <th className="px-4 py-3">Trip Name</th>
                        <th className="px-4 py-3">Frequency / Days</th>
                        <th className="px-4 py-3">Order Cut-off Time</th>
                        <th className="px-4 py-3">Vehicle Dispatch Time</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {loadingSchedules ? (
                        <tr>
                          <td colSpan={8} className="text-center py-10 text-slate-400 font-bold">
                            Loading route schedules...
                          </td>
                        </tr>
                      ) : routeSchedules.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-12 text-slate-500">
                            <div className="flex flex-col items-center gap-2">
                              <Clock className="w-8 h-8 text-slate-300" />
                              <span className="font-bold text-slate-700">No scheduled trips configured for this route.</span>
                              <span className="text-xs text-slate-400">
                                Click "1-Click Morning &amp; Evening Setup" above or use the form below to add a trip.
                              </span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        routeSchedules.map((sched, idx) => {
                          const isMorning = sched.trip_name?.toLowerCase().includes('morning') || (sched.dispatch_time && parseInt(sched.dispatch_time.split(':')[0], 10) < 12);
                          const isEvening = sched.trip_name?.toLowerCase().includes('evening') || (sched.dispatch_time && parseInt(sched.dispatch_time.split(':')[0], 10) >= 12);
                          const isEditing = editingScheduleId === sched.id;

                          let daysSummary = 'Daily (All Days)';
                          if (sched.frequency === 'ON_DEMAND') daysSummary = 'On-Demand';
                          else if (sched.frequency === 'WEEKLY_SPECIFIC_DAYS' && sched.selected_days) {
                            try {
                              const parsed = typeof sched.selected_days === 'string' ? JSON.parse(sched.selected_days) : sched.selected_days;
                              daysSummary = Array.isArray(parsed) && parsed.length < 7
                                ? parsed.map(d => d.slice(0, 3)).join(', ')
                                : 'Daily';
                            } catch (e) {
                              daysSummary = 'Custom';
                            }
                          }

                          return (
                            <tr
                              key={sched.id}
                              className={`transition-colors ${isEditing ? 'bg-blue-50/90 font-semibold' : 'hover:bg-slate-50'}`}
                            >
                              <td className="px-4 py-3.5 font-mono text-slate-500 font-bold">
                                {idx + 1}
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-extrabold border ${
                                  isMorning
                                    ? 'bg-amber-50 text-amber-900 border-amber-200'
                                    : isEvening
                                    ? 'bg-indigo-50 text-indigo-900 border-indigo-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}>
                                  {isMorning ? <Sunrise className="w-3.5 h-3.5 text-amber-600" /> : isEvening ? <Sunset className="w-3.5 h-3.5 text-indigo-600" /> : <Clock className="w-3.5 h-3.5 text-slate-500" />}
                                  <span>{isMorning ? 'Morning' : isEvening ? 'Evening' : sched.dispatch_type === 'ON_DEMAND' ? 'On-Demand' : 'Custom'}</span>
                                </span>
                              </td>
                              <td className="px-4 py-3.5 font-bold text-slate-900">
                                {sched.trip_name}
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap">
                                <span className="text-slate-700 font-medium">{daysSummary}</span>
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap font-mono">
                                {sched.cutoff_time ? (
                                  <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                    {sched.cutoff_time} ({fmtTime12(sched.cutoff_time)})
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">No Cutoff</span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 whitespace-nowrap font-mono">
                                {sched.dispatch_time ? (
                                  <span className="font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                    {sched.dispatch_time} ({fmtTime12(sched.dispatch_time)})
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">On-Demand</span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSchedule(sched)}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer inline-flex items-center gap-1 transition-colors ${
                                    sched.is_active
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                      : 'bg-slate-100 text-slate-500 border-slate-300'
                                  }`}
                                >
                                  {sched.is_active ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-slate-400" />}
                                  <span>{sched.is_active ? 'Active' : 'Disabled'}</span>
                                </button>
                              </td>
                              <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleEditScheduleClick(sched)}
                                    className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#004c8f] border border-blue-200 text-xs font-bold cursor-pointer transition-colors"
                                  >
                                    <Edit2 className="w-3 h-3 inline mr-1" /> Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSchedule(sched.id)}
                                    className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-bold cursor-pointer transition-colors"
                                  >
                                    <Trash2 className="w-3 h-3 inline mr-1" /> Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Clean, Form Row to Add or Edit Schedule */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                      {editingScheduleId ? 'Edit Selected Trip' : '+ Add New Trip to this Route'}
                    </h4>
                  </div>
                  {editingScheduleId && (
                    <button
                      type="button"
                      onClick={handleResetScheduleForm}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Cancel Editing
                    </button>
                  )}
                </div>

                <form onSubmit={handleSaveSchedule} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {/* Shift Selector */}
                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-700 uppercase mb-1">
                        Shift Preset
                      </label>
                      <select
                        onChange={(e) => applyPreset(e.target.value)}
                        value={
                          scheduleForm.trip_name?.toLowerCase().includes('morning') ? 'MORNING' :
                          scheduleForm.trip_name?.toLowerCase().includes('evening') ? 'EVENING' :
                          scheduleForm.trip_name?.toLowerCase().includes('night') ? 'NIGHT' :
                          scheduleForm.dispatch_type === 'ON_DEMAND' ? 'ON_DEMAND' : 'CUSTOM'
                        }
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#004c8f]"
                      >
                        <option value="MORNING">🌅 Morning (08:00 - 09:30)</option>
                        <option value="EVENING">🌆 Evening (18:00 - 19:30)</option>
                        <option value="NIGHT">🌙 Night (21:00 - 22:30)</option>
                        <option value="ON_DEMAND">⚡ On-Demand</option>
                        <option value="CUSTOM">⚙️ Custom Trip</option>
                      </select>
                    </div>

                    {/* Trip Name */}
                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-700 uppercase mb-1">
                        Trip Label <span className="text-red-500 font-bold ml-0.5">*</span>
                      </label>
                      <input
                        type="text"
                        value={scheduleForm.trip_name}
                        onChange={(e) => setScheduleForm(prev => ({ ...prev, trip_name: e.target.value }))}
                        required
                        placeholder="e.g. Morning Dispatch"
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#004c8f]"
                      />
                    </div>

                    {/* Frequency */}
                    <div>
                      <label className="block text-[11px] font-extrabold text-slate-700 uppercase mb-1">
                        Frequency <span className="text-red-500 font-bold ml-0.5">*</span>
                      </label>
                      <select
                        value={scheduleForm.frequency}
                        onChange={(e) => setScheduleForm(prev => ({ ...prev, frequency: e.target.value }))}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#004c8f]"
                      >
                        <option value="DAILY">Daily (Every Day)</option>
                        <option value="WEEKLY_SPECIFIC_DAYS">Specific Days</option>
                        <option value="ON_DEMAND">On-Demand Only</option>
                      </select>
                    </div>

                    {/* Cutoff Time */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-extrabold text-slate-700 uppercase">
                          Cutoff Time
                        </label>
                        {scheduleForm.cutoff_time && (
                          <span className="text-[10px] font-mono font-bold text-amber-700">
                            {fmtTime12(scheduleForm.cutoff_time)}
                          </span>
                        )}
                      </div>
                      <input
                        type="time"
                        value={scheduleForm.cutoff_time}
                        onChange={(e) => setScheduleForm(prev => ({ ...prev, cutoff_time: e.target.value }))}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#004c8f]"
                      />
                    </div>

                    {/* Dispatch Time */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-extrabold text-slate-700 uppercase">
                          Dispatch Time
                        </label>
                        {scheduleForm.dispatch_time && (
                          <span className="text-[10px] font-mono font-bold text-blue-700">
                            {fmtTime12(scheduleForm.dispatch_time)}
                          </span>
                        )}
                      </div>
                      <input
                        type="time"
                        value={scheduleForm.dispatch_time}
                        onChange={(e) => setScheduleForm(prev => ({ ...prev, dispatch_time: e.target.value }))}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#004c8f]"
                      />
                    </div>
                  </div>

                  {/* Day Checkboxes if Specific Days */}
                  {scheduleForm.frequency === 'WEEKLY_SPECIFIC_DAYS' && (
                    <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1.5">
                      <span className="text-[11px] font-extrabold text-slate-600 uppercase">Active Days:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => {
                          const active = (scheduleForm.selected_days || []).includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleDayInSchedule(day)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                                active
                                  ? 'bg-[#003366] text-white border-[#003366]'
                                  : 'bg-slate-50 text-slate-600 border-slate-200'
                              }`}
                            >
                              {day.slice(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!scheduleForm.is_active}
                        onChange={(e) => setScheduleForm(prev => ({ ...prev, is_active: e.target.checked }))}
                        className="w-4 h-4 accent-[#003366]"
                      />
                      <span className="text-xs font-bold text-slate-700">Set Active on Save</span>
                    </label>

                    <button
                      type="submit"
                      disabled={savingSchedule}
                      className="px-6 py-2.5 bg-[#003366] hover:bg-[#004c8f] text-white text-xs font-extrabold rounded-xl shadow cursor-pointer transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{savingSchedule ? 'Saving...' : editingScheduleId ? 'Update Trip' : 'Save Trip to Route'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <span>All schedule updates are live and automatically sync with the Operations Console.</span>
              <button
                type="button"
                onClick={() => setScheduleModalRoute(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
