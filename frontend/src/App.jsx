import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ToastProvider } from './context/ToastContext';

import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ControlTower from './pages/ControlTower';
import RouteBillStatus from './pages/RouteBillStatus';
import EWayBill from './pages/EWayBill';
import PickTickets from './pages/PickTickets';
import Billing from './pages/Billing';
import MasterRegistries from './pages/MasterRegistries';
import Import from './pages/Import';
import Leaderboard from './pages/Leaderboard';
import Reports from './pages/Reports';
import DispatchList from './pages/DispatchList';
import DispatchDetail from './pages/DispatchDetail';
import Tracking from './pages/Tracking';
import DeliveryBoard from './pages/DeliveryBoard';
import LEDDashboard from './pages/LEDDashboard';
import ReturnEntry from './pages/ReturnEntry';
import ReturnRegister from './pages/ReturnRegister';
import DmsPending from './pages/DmsPending';
import ReturnDetail from './pages/ReturnDetail';
import ReturnReports from './pages/ReturnReports';
import ArrangeEntry from './pages/ArrangeEntry';
import ArrangeRegister from './pages/ArrangeRegister';
import ArrangeDetail from './pages/ArrangeDetail';
import ArrangeReports from './pages/ArrangeReports';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#F4F7FB] text-[#004C8F] font-bold text-sm">
        Loading TheSSBuddy Enterprise Portal...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SocketProvider>
          <ToastProvider>
            <HashRouter>
              <Routes>
                <Route path="/login" element={<Login />} />

                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <ErrorBoundary>
                          <Routes>
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/pick-tickets" element={<PickTickets />} />
                            <Route path="/billing" element={<Billing />} />
                            <Route path="/route-bill-status" element={<RouteBillStatus />} />
                            <Route path="/dispatch-planning" element={<Navigate to="/led" replace />} />
                            <Route path="/dispatch" element={<DispatchList />} />
                            <Route path="/dispatch/plan" element={<Navigate to="/led" replace />} />
                            <Route path="/dispatch/:id" element={<DispatchDetail />} />
                            <Route path="/tracking/:id" element={<Tracking />} />
                            <Route path="/delivery" element={<DeliveryBoard />} />
                            <Route path="/control-tower" element={<LEDDashboard />} />
                            <Route path="/led" element={<LEDDashboard />} />
                            <Route path="/ewaybill" element={<EWayBill />} />

                            {/* Return Module Routes */}
                            <Route path="/return/new" element={<ReturnEntry />} />
                            <Route path="/return/edit/:id" element={<ReturnEntry />} />
                            <Route path="/return/register" element={<ReturnRegister />} />
                            <Route path="/return/dms-pending" element={<DmsPending />} />
                            <Route path="/return/view/:id" element={<ReturnDetail />} />
                            <Route path="/return/reports" element={<ReturnReports />} />
                            <Route path="/return" element={<Navigate to="/return/register" replace />} />

                            {/* Arrange Module Routes */}
                            <Route path="/arrange/new" element={<ArrangeEntry />} />
                            <Route path="/arrange/edit/:id" element={<ArrangeEntry />} />
                            <Route path="/arrange/register" element={<ArrangeRegister />} />
                            <Route path="/arrange/view/:id" element={<ArrangeDetail />} />
                            <Route path="/arrange/reports" element={<ArrangeReports />} />
                            <Route path="/arrange" element={<Navigate to="/arrange/register" replace />} />

                            <Route path="/masters" element={<MasterRegistries />} />
                            <Route path="/parties" element={<MasterRegistries />} />
                            <Route path="/vehicles" element={<MasterRegistries />} />
                            <Route path="/drivers" element={<MasterRegistries />} />
                            <Route path="/warehouses" element={<MasterRegistries />} />
                            <Route path="/users" element={<MasterRegistries />} />
                            <Route path="/import" element={<Import />} />
                            <Route path="/leaderboard" element={<Leaderboard />} />
                            <Route path="/reports" element={<Reports />} />
                            <Route path="*" element={<Navigate to="/dashboard" replace />} />
                          </Routes>
                        </ErrorBoundary>
                      </Layout>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </HashRouter>
          </ToastProvider>
        </SocketProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

