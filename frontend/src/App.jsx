import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ToastProvider } from './context/ToastContext';

import Layout from './components/Layout';
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
import DispatchPlanning from './pages/DispatchPlanning';
import DispatchList from './pages/DispatchList';
import DispatchDetail from './pages/DispatchDetail';
import Tracking from './pages/Tracking';
import DeliveryBoard from './pages/DeliveryBoard';

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
                      <Routes>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/pick-tickets" element={<PickTickets />} />
                        <Route path="/billing" element={<Billing />} />
                        <Route path="/route-bill-status" element={<RouteBillStatus />} />
                        <Route path="/dispatch-planning" element={<DispatchPlanning />} />
                        <Route path="/dispatch" element={<DispatchList />} />
                        <Route path="/dispatch/plan" element={<DispatchPlanning />} />
                        <Route path="/dispatch/:id" element={<DispatchDetail />} />
                        <Route path="/tracking/:id" element={<Tracking />} />
                        <Route path="/delivery" element={<DeliveryBoard />} />
                        <Route path="/control-tower" element={<ControlTower />} />
                        <Route path="/ewaybill" element={<EWayBill />} />
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
                    </Layout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </HashRouter>
        </ToastProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

