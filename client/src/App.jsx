import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './layouts/AppLayout';
import LoadingSpinner from './components/common/LoadingSpinner';

// Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import CustomerDashboard from './pages/customer/CustomerDashboard';
import CreateTicketPage from './pages/customer/CreateTicketPage';
import CustomerTicketListPage from './pages/customer/CustomerTicketListPage';
import CustomerTicketDetailPage from './pages/customer/CustomerTicketDetailPage';
import AgentDashboard from './pages/agent/AgentDashboard';
import AgentTicketQueuePage from './pages/agent/AgentTicketQueuePage';
import AgentTicketDetailPage from './pages/agent/AgentTicketDetailPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AgentManagementPage from './pages/admin/AgentManagementPage';
import PerformanceAnalyticsPage from './pages/admin/PerformanceAnalyticsPage';
import NotFoundPage from './pages/error/NotFoundPage';
import UnauthorizedPage from './pages/error/UnauthorizedPage';

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingSpinner message="Checking authentication..." size="large" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}

function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingSpinner message="Loading ResolveAI..." size="large" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'customer') return <Navigate to="/customer/dashboard" replace />;
  if (user.role === 'agent') return <Navigate to="/agent/dashboard" replace />;
  if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;

  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Root & Auth Routes */}
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Customer Routes */}
          <Route
            path="/customer"
            element={
              <ProtectedRoute allowedRoles={['customer']}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/customer/dashboard" replace />} />
            <Route path="dashboard" element={<CustomerDashboard />} />
            <Route path="tickets" element={<CustomerTicketListPage />} />
            <Route path="tickets/new" element={<CreateTicketPage />} />
            <Route path="tickets/:id" element={<CustomerTicketDetailPage />} />
          </Route>

          {/* Agent Routes (Accessible by Agent and Admin) */}
          <Route
            path="/agent"
            element={
              <ProtectedRoute allowedRoles={['agent', 'admin']}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/agent/dashboard" replace />} />
            <Route path="dashboard" element={<AgentDashboard />} />
            <Route path="queue" element={<AgentTicketQueuePage />} />
            <Route path="tickets/:id" element={<AgentTicketDetailPage />} />
          </Route>

          {/* Admin Routes (Restricted to Admin Only) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="agents" element={<AgentManagementPage />} />
            <Route path="analytics" element={<PerformanceAnalyticsPage />} />
          </Route>

          {/* 404 Catch-All */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
