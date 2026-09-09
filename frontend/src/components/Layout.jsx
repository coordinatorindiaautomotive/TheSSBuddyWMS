import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  LayoutDashboard,
  Truck,
  FileSpreadsheet,
  Users,
  Trophy,
  BarChart3,
  LogOut,
  Bell,
  Building2,
  Upload,
  ClipboardList,
  Receipt,
  Layers,
  Route,
  Clock,
  Menu,
  X
} from 'lucide-react';

export default function Layout({ children }) {
  const { user, activeWarehouse, warehouses, switchWarehouse, logout } = useAuth();
  const { notifications } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [now, setNow] = useState(new Date());

  // Auto-close mobile drawer on route navigation
  useEffect(() => {
    setMobileOpen(false);
    setShowNotifications(false);
  }, [location.pathname]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const allNavItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, iconColor: 'text-indigo-600', badgeBg: 'bg-indigo-50' },
    { label: 'Dispatch Planning', path: '/dispatch-planning', icon: Truck, iconColor: 'text-blue-600', badgeBg: 'bg-blue-50' },
    { label: 'Pick Ticket Entry', path: '/pick-tickets', icon: ClipboardList, iconColor: 'text-amber-600', badgeBg: 'bg-amber-50' },
    { label: 'Billing Entry', path: '/billing', icon: Receipt, iconColor: 'text-emerald-600', badgeBg: 'bg-emerald-50' },
    { label: 'Route Bill Status', path: '/route-bill-status', icon: Route, iconColor: 'text-purple-600', badgeBg: 'bg-purple-50' },
    { label: 'E-Way Bill System', path: '/ewaybill', icon: FileSpreadsheet, iconColor: 'text-teal-600', badgeBg: 'bg-teal-50' },
    { label: 'Master Registries', path: '/masters', icon: Layers, iconColor: 'text-cyan-600', badgeBg: 'bg-cyan-50' },
    { label: 'CSV Excel Import', path: '/import', icon: Upload, iconColor: 'text-pink-600', badgeBg: 'bg-pink-50' },
    { label: 'Live Leaderboard', path: '/leaderboard', icon: Trophy, iconColor: 'text-amber-500', badgeBg: 'bg-amber-50' },
    { label: 'Reports & Audits', path: '/reports', icon: BarChart3, iconColor: 'text-blue-600', badgeBg: 'bg-blue-50' }
  ];

  const operationsNav = allNavItems.slice(0, 6);
  const mastersNav = allNavItems.slice(6, 7);
  const adminNav = allNavItems.slice(7);

  const renderNavSection = (title, items) => (
    <div className="mb-4">
      <div className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider px-3 mb-2">
        {title}
      </div>
      <div className="space-y-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive =
            location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path) && item.path !== '/dispatch' && item.path !== '/masters');

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-xs transition-all duration-200 group relative ${
                isActive
                  ? 'bg-[#003366] text-white shadow-md border-r-4 border-[#ed1c24]'
                  : 'text-slate-700 hover:bg-slate-100/90 hover:text-[#004c8f]'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : `${item.badgeBg} ${item.iconColor}`
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#f3f7fa] text-slate-800 w-full">
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* Mobile Slide-Out Drawer Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200 flex flex-col justify-between shadow-2xl transform transition-transform duration-300 ease-in-out md:hidden ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Mobile Drawer Header */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-3 overflow-hidden">
              <img src="/thessbuddy_logo.png" alt="TheSSBuddy" className="h-9 w-auto object-contain rounded-lg shrink-0" />
              <div className="overflow-hidden">
                <h1 className="font-black text-base text-[#003366] tracking-tight truncate">TheSSBuddy</h1>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block truncate">Business Companion</span>
              </div>
            </div>
            <button
              onClick={() => setMobileOpen(false)}
              className="p-1.5 rounded-lg bg-slate-200/80 hover:bg-red-50 hover:text-red-600 text-slate-600 transition-colors cursor-pointer"
              title="Close Menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Active Warehouse Switcher in Mobile Drawer */}
          <div className="p-3 bg-blue-50/60 border-b border-blue-100 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-[#003366] uppercase tracking-wider">
              <Building2 className="w-3.5 h-3.5 text-[#004c8f]" /> Active Warehouse
            </div>
            {['Admin', 'Super Admin', 'Warehouse Admin', 'ADMIN', 'SUPER_ADMIN', 'WAREHOUSE_ADMIN', 'SuperAdmin'].includes(user?.role) ? (
              <select
                value={activeWarehouse?.id || ''}
                onChange={(e) => switchWarehouse(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-800 focus:border-[#004c8f] focus:outline-none cursor-pointer shadow-xs"
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.warehouse_name} ({w.warehouse_code})
                  </option>
                ))}
              </select>
            ) : (
              <div className="bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-800 truncate">
                {activeWarehouse?.warehouse_name || 'Warehouse'}
              </div>
            )}
          </div>

          {/* Mobile Nav Links */}
          <nav className="p-3 overflow-y-auto max-h-[calc(100vh-220px)]">
            {renderNavSection('Operations', operationsNav)}
            {renderNavSection('Master Registries', mastersNav)}
            {renderNavSection('System Admin', adminNav)}
          </nav>
        </div>

        {/* Mobile Profile & Logout Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/90">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center font-bold text-[#003366] text-xs shrink-0 shadow-sm">
                {user?.full_name?.substring(0, 2).toUpperCase() || 'TB'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-800 truncate">{user?.full_name || 'User'}</p>
                <span className="text-[10px] font-bold text-[#003366] uppercase block">{user?.role || 'Role'}</span>
              </div>
            </div>

            <button
              onClick={() => { logout(); navigate('/login'); }}
              title="Secure Log Out"
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <div className="text-center text-[10px] text-slate-400 font-semibold border-t border-slate-200/80 pt-2">
            Designed By Shailendra Singh
          </div>
        </div>
      </aside>

      {/* Top Header Bar */}
      <header className="bg-[#003366] border-b-4 border-[#ed1c24] px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between z-20 shadow-md text-white shrink-0 w-full">
        {/* Left App Logo & Title */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Mobile Menu Hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors md:hidden cursor-pointer shrink-0"
            title="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link to="/dashboard" className="flex items-center gap-2.5 group">
            <img src="/thessbuddy_logo.png" alt="TheSSBuddy" className="h-7 sm:h-8 w-auto object-contain bg-white/10 p-1 rounded-lg border border-white/20 group-hover:scale-105 transition-transform shrink-0" />
            <div className="flex flex-col">
              <span className="text-sm sm:text-base font-black text-white tracking-wide leading-tight">
                TheSSBuddy
              </span>
              <span className="hidden sm:inline text-[9px] font-bold text-cyan-200 tracking-wider uppercase">
                Business Companion
              </span>
            </div>
          </Link>
        </div>

        {/* Right Header Actions: Clock, Warehouse Switcher, Notifications, Profile & Logout */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Live Date & Time Indicator */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0"></span>
            <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>
              {now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, {now.toLocaleTimeString('en-IN')}
            </span>
          </div>

          {/* Warehouse Switcher Dropdown */}
          <div className="flex items-center gap-1 sm:gap-2 bg-white/10 border border-white/20 rounded-xl px-2.5 py-1.5 text-xs text-white max-w-[130px] sm:max-w-[220px]">
            <Building2 className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
            <span className="hidden sm:inline font-semibold text-slate-200 shrink-0">Warehouse:</span>
            {['Admin', 'Super Admin', 'Warehouse Admin', 'ADMIN', 'SUPER_ADMIN', 'WAREHOUSE_ADMIN', 'SuperAdmin'].includes(user?.role) ? (
              <select
                value={activeWarehouse?.id || ''}
                onChange={(e) => switchWarehouse(e.target.value)}
                className="bg-transparent text-white font-bold focus:outline-none cursor-pointer text-xs w-full min-w-0 truncate"
              >
                {warehouses.map(w => (
                  <option key={w.id} value={w.id} className="bg-[#003366] text-white">
                    {w.warehouse_name} ({w.warehouse_code})
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-extrabold text-cyan-200 font-mono truncate text-xs">
                {activeWarehouse?.warehouse_code || 'WH-01'}
              </span>
            )}
          </div>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-1.5 sm:p-2 text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer shrink-0"
              title="Notifications"
            >
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              {notifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 text-slate-800">
                <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Live Dispatch Alerts</h4>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="text-slate-400 hover:text-slate-700 p-1 rounded-md cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">No active alerts</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {notifications.map(n => (
                      <div key={n.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                        <p className="text-slate-800 font-semibold">{n.message}</p>
                        <span className="text-[10px] text-slate-500 block mt-1">{n.time}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User Profile & Logout Desktop */}
          <div className="flex items-center gap-2 pl-2 border-l border-white/20">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-sm">
              {user?.full_name?.substring(0, 2).toUpperCase() || 'TB'}
            </div>
            <div className="hidden md:block leading-tight text-left">
              <p className="text-xs font-bold text-white truncate max-w-[120px]">{user?.full_name || 'User'}</p>
              <span className="text-[10px] font-semibold text-cyan-200 uppercase block">{user?.role || 'Role'}</span>
            </div>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              title="Secure Log Out"
              className="p-1.5 sm:p-2 text-white/80 hover:text-white hover:bg-red-600/90 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Top Horizontal Navigation Strip (Desktop & Tablet) */}
      <nav className="hidden md:flex bg-white border-b border-slate-200 shadow-xs px-3 sm:px-6 py-1.5 items-center gap-1.5 overflow-x-auto w-full shrink-0 z-10 custom-scrollbar">
        {allNavItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path) && item.path !== '/dispatch' && item.path !== '/masters');

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-xs whitespace-nowrap transition-all duration-150 shrink-0 ${
                isActive
                  ? 'bg-[#003366] text-white shadow-sm border-b-2 border-[#ed1c24]'
                  : 'text-slate-600 hover:text-[#003366] hover:bg-slate-100'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : item.iconColor}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Main Workspace Viewport - 100% Full Width (No Blank Borders) */}
      <main className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-5 lg:p-6 bg-[#f4f7fb] w-full">
        <div className="w-full">
          {children}
        </div>
      </main>
    </div>
  );
}

