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
  ChevronLeft,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';

export default function Layout({ children }) {
  const { user, activeWarehouse, warehouses, switchWarehouse, logout } = useAuth();
  const { notifications } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
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

  const operationsNav = [
    { label: 'Dashboard Panel', path: '/dashboard', icon: LayoutDashboard, iconColor: 'text-indigo-600', badgeBg: 'bg-indigo-50' },
    { label: 'Dispatch Planning', path: '/dispatch-planning', icon: Truck, iconColor: 'text-blue-600', badgeBg: 'bg-blue-50' },
    { label: 'Pick Ticket Entry', path: '/pick-tickets', icon: ClipboardList, iconColor: 'text-amber-600', badgeBg: 'bg-amber-50' },
    { label: 'Billing Entry', path: '/billing', icon: Receipt, iconColor: 'text-emerald-600', badgeBg: 'bg-emerald-50' },
    { label: 'Route Bill Status', path: '/route-bill-status', icon: Route, iconColor: 'text-purple-600', badgeBg: 'bg-purple-50' },
    { label: 'E-Way Bill System', path: '/ewaybill', icon: FileSpreadsheet, iconColor: 'text-teal-600', badgeBg: 'bg-teal-50' },
    { label: 'CSV Excel Import', path: '/import', icon: Upload, iconColor: 'text-pink-600', badgeBg: 'bg-pink-50' }
  ];

  const mastersNav = [
    { label: 'Master Registries', path: '/masters', icon: Layers, iconColor: 'text-cyan-600', badgeBg: 'bg-cyan-50' }
  ];

  const adminNav = [
    { label: 'Live Leaderboard', path: '/leaderboard', icon: Trophy, iconColor: 'text-amber-500', badgeBg: 'bg-amber-50' },
    { label: 'Reports & Audits', path: '/reports', icon: BarChart3, iconColor: 'text-blue-600', badgeBg: 'bg-blue-50' }
  ];

  const renderNavSection = (title, items, isMobile = false) => (
    <div className="mb-4">
      {(!collapsed || isMobile) && (
        <div className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider px-3 mb-2">
          {title}
        </div>
      )}
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
              title={collapsed && !isMobile ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-xs transition-all duration-200 group relative ${
                isActive
                  ? 'bg-[#003366] text-white shadow-md border-r-4 border-[#ed1c24]'
                  : 'text-slate-700 hover:bg-slate-100/90 hover:text-[#004c8f]'
              } ${collapsed && !isMobile ? 'justify-center px-0' : ''}`}
            >
              {/* Colorful Icon Badge Container */}
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : `${item.badgeBg} ${item.iconColor}`
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>

              {(!collapsed || isMobile) && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#f3f7fa] text-slate-800 w-full">
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
            {renderNavSection('Operations', operationsNav, true)}
            {renderNavSection('Master Registries', mastersNav, true)}
            {renderNavSection('System Admin', adminNav, true)}
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

      {/* Desktop Sidebar Navigation - Collapsible */}
      <aside
        className={`hidden md:flex flex-col justify-between shrink-0 ${
          collapsed ? 'w-20' : 'w-64'
        } bg-white border-r border-slate-200 z-20 shadow-sm transition-all duration-300 ease-in-out relative`}
      >
        <div>
          {/* App Branding & Collapse Toggle */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 overflow-hidden">
              <img src="/thessbuddy_logo.png" alt="TheSSBuddy" className="h-9 w-auto object-contain rounded-lg shrink-0" />
              {!collapsed && (
                <div className="overflow-hidden">
                  <h1 className="font-black text-base text-[#003366] tracking-tight truncate">TheSSBuddy</h1>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block truncate">Business Companion</span>
                </div>
              )}
            </div>

            {/* Collapse/Expand Toggle Button */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 rounded-lg bg-slate-100 hover:bg-[#003366] hover:text-white text-slate-500 transition-colors shadow-sm cursor-pointer shrink-0"
              title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Active Warehouse Context in Desktop Sidebar */}
          {!collapsed ? (
            <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] font-extrabold text-[#003366] uppercase tracking-wider">
                <Building2 className="w-3.5 h-3.5 text-[#004c8f]" /> Active Warehouse
              </div>

              {['Admin', 'Super Admin', 'Warehouse Admin', 'ADMIN', 'SUPER_ADMIN', 'WAREHOUSE_ADMIN', 'SuperAdmin'].includes(user?.role) ? (
                <select
                  value={activeWarehouse?.id || ''}
                  onChange={(e) => switchWarehouse(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:border-[#004c8f] focus:outline-none cursor-pointer shadow-xs"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.warehouse_name} ({w.warehouse_code})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 truncate">
                  {activeWarehouse?.warehouse_name || 'Warehouse'}
                </div>
              )}
            </div>
          ) : (
            <div className="p-2 border-b border-slate-200 flex justify-center">
              <span className="w-3 h-3 rounded-full bg-emerald-500" title={`Warehouse: ${activeWarehouse?.warehouse_name || 'Active'}`} />
            </div>
          )}

          {/* Desktop Scrollable Navigation */}
          <nav className="p-3 overflow-y-auto max-h-[calc(100vh-170px)]">
            {renderNavSection('Operations', operationsNav, false)}
            {renderNavSection('Master Registries', mastersNav, false)}
            {renderNavSection('System Admin', adminNav, false)}
          </nav>
        </div>

        {/* Profile Info & Logout Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/80">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} mb-2 px-1`}>
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center font-bold text-[#003366] text-xs shrink-0 shadow-sm">
                {user?.full_name?.substring(0, 2).toUpperCase() || 'TB'}
              </div>
              {!collapsed && (
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-slate-800 truncate">{user?.full_name || 'User'}</p>
                  <span className="text-[10px] font-bold text-[#003366] uppercase block">{user?.role || 'Role'}</span>
                </div>
              )}
            </div>

            {!collapsed && (
              <button
                onClick={() => { logout(); navigate('/login'); }}
                title="Secure Log Out"
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>

          {!collapsed && (
            <div className="text-center text-[10px] text-slate-400 font-semibold border-t border-slate-200/80 pt-2">
              Designed By Shailendra Singh
            </div>
          )}
        </div>
      </aside>

      {/* Main Workspace Viewport with Responsive Top Header */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Solid Plain Navy Blue Header Bar with Crimson Red Bottom Accent Line */}
        <header className="bg-[#003366] border-b-4 border-[#ed1c24] px-2.5 sm:px-6 py-2 sm:py-3 flex items-center justify-between z-10 shadow-md text-white shrink-0 w-full overflow-hidden">
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 shrink">
            {/* Hamburger Button for Mobile */}
            <button
              onClick={() => setMobileOpen(true)}
              className="p-1.5 sm:p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors md:hidden cursor-pointer shrink-0"
              title="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <img src="/thessbuddy_logo.png" alt="TheSSBuddy" className="h-6 sm:h-8 w-auto object-contain bg-white/10 p-0.5 sm:p-1 rounded-lg border border-white/20 shrink-0" />
            <h2 className="text-sm sm:text-xl font-black text-white tracking-wide truncate">
              TheSSBuddy
            </h2>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Live Date & Time Indicator (Desktop & Tablet) */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0"></span>
              <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>
                {now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, {now.toLocaleTimeString('en-IN')}
              </span>
            </div>

            {/* Warehouse Switcher Dropdown in Header */}
            <div className="flex items-center gap-1 sm:gap-2 bg-white/10 border border-white/20 rounded-xl px-2 sm:px-3 py-1.5 text-xs text-white max-w-[125px] sm:max-w-xs">
              <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-300 shrink-0" />
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
                      className="text-slate-400 hover:text-slate-700 p-1 rounded-md"
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
          </div>
        </header>

        {/* Page Content Viewport - 100% Full Width (No Blank Borders) */}
        <main className="flex-1 overflow-y-auto p-2 sm:p-4 md:p-5 lg:p-6 bg-[#f4f7fb] w-full">
          <div className="w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}


