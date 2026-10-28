import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function UnauthorizedPage() {
  const { user } = useAuth();

  const homeRoute =
    user?.role === 'customer'
      ? '/customer/dashboard'
      : user?.role === 'agent'
      ? '/agent/dashboard'
      : user?.role === 'admin'
      ? '/admin/dashboard'
      : '/login';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mb-4 shadow-xs">
        <ShieldAlert className="w-8 h-8" />
      </div>
      <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">403 — Access Denied</h1>
      <p className="mt-2 text-sm text-slate-500 max-w-sm">
        You do not have administrative permissions to view this resource. Role-based security prevents unauthorized access.
      </p>
      <div className="mt-6">
        <Link
          to={homeRoute}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Your Portal</span>
        </Link>
      </div>
    </div>
  );
}
