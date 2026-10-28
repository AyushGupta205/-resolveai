import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Ticket,
  PlusCircle,
  Users,
  BarChart3,
  Sparkles,
  LogOut,
  ShieldCheck,
  Headphones,
  User,
} from 'lucide-react';

export default function Sidebar({ onCloseMobile }) {
  const { user, logout } = useAuth();

  const roleNavItems = {
    customer: [
      { to: '/customer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/customer/tickets', label: 'My Tickets', icon: Ticket },
      { to: '/customer/tickets/new', label: 'Create Ticket', icon: PlusCircle },
    ],
    agent: [
      { to: '/agent/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/agent/queue', label: 'Ticket Queue', icon: Ticket },
    ],
    admin: [
      { to: '/admin/dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
      { to: '/agent/queue', label: 'All Tickets', icon: Ticket },
      { to: '/admin/agents', label: 'Staff Management', icon: Users },
      { to: '/admin/analytics', label: 'Analytics & SLA', icon: BarChart3 },
    ],
  };

  const items = (user && roleNavItems[user.role]) || [];

  const roleBadgeConfig = {
    customer: { label: 'Customer', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: User },
    agent: { label: 'Support Specialist', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: Headphones },
    admin: { label: 'Administrator', bg: 'bg-purple-50 text-purple-700 border-purple-200', icon: ShieldCheck },
  };

  const currentRoleBadge = (user && roleBadgeConfig[user.role]) || roleBadgeConfig.customer;
  const RoleIcon = currentRoleBadge.icon;

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-full shadow-sm">
      {/* Brand Logo Header */}
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-100">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight text-slate-900 block leading-tight">
              Resolve<span className="text-indigo-600">AI</span>
            </span>
            <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase block">
              Intelligent Desk
            </span>
          </div>
        </div>
      </div>

      {/* Role Badge Indicator */}
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
        <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${currentRoleBadge.bg}`}>
          <RoleIcon className="w-3.5 h-3.5" />
          <span>{currentRoleBadge.label} Portal</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
          Navigation
        </div>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User info and Logout Footer */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <p className="text-sm font-semibold text-slate-800 truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            title="Log out"
            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
