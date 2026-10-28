import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  Ticket,
  AlertCircle,
  Clock,
  Users,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';

const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminData();
  }, []);

  async function fetchAdminData() {
    setLoading(true);
    try {
      const [oRes, aRes] = await Promise.all([
        adminApi.getOverview(),
        adminApi.getAnalytics(),
      ]);
      setOverview(oRes.data.overview);
      setAnalytics(aRes.data.analytics);
    } catch (err) {
      console.error('Failed to load admin overview', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <LoadingSpinner message="Calculating organization metrics..." size="large" />;
  }

  const formatMinutes = (min) => {
    if (!min) return 'N/A';
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-purple-700">
              Executive Administration
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            System Performance & SLA Operations
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time telemetry on customer inquiries, specialist workloads, and SLA compliance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/admin/agents"
            className="px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold border border-purple-200 transition-colors"
          >
            Manage Staff ({overview?.activeAgents || 0} Active)
          </Link>
          <Link
            to="/agent/queue"
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            Inspect Queue
          </Link>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tickets */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Tickets</span>
            <Ticket className="w-5 h-5 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{overview?.totalTickets || 0}</p>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
            <span>{overview?.openTickets || 0} open</span>
            <span>•</span>
            <span>{overview?.inProgressTickets || 0} in progress</span>
          </div>
        </div>

        {/* SLA Breach Count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-rose-500">
            <span className="text-xs font-semibold uppercase tracking-wider">SLA Breaches</span>
            <AlertCircle className="w-5 h-5 text-rose-600" />
          </div>
          <p className="text-2xl font-bold text-rose-600 mt-2">{overview?.slaBreachCount || 0}</p>
          <span className="text-xs text-rose-500 font-medium mt-1 block">
            Target SLA: 4 hours
          </span>
        </div>

        {/* Avg First Response Time */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Response Time</span>
            <Clock className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {formatMinutes(overview?.avgFirstResponseMinutes)}
          </p>
          <span className="text-xs text-slate-400 mt-1 block">
            Based on {overview?.respondedTicketsCount || 0} answered tickets
          </span>
        </div>

        {/* Staff Utilization */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Staff</span>
            <Users className="w-5 h-5 text-purple-500" />
          </div>
          <p className="text-2xl font-bold text-purple-700 mt-2">
            {overview?.activeAgents || 0} <span className="text-sm font-normal text-slate-400">/ {overview?.totalAgents || 0}</span>
          </p>
          <span className="text-xs text-slate-400 mt-1 block">
            Round-robin pool active
          </span>
        </div>
      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown Chart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Tickets by Category</h2>
              <p className="text-xs text-slate-400">Distribution across AI-classified topic buckets</p>
            </div>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.categoryDistribution || []} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="category" type="category" tick={{ fontSize: 10 }} width={110} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Priority Breakdown Chart */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Tickets by Priority</h2>
              <p className="text-xs text-slate-400">Severity classification across queue</p>
            </div>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics?.priorityDistribution || []}
                  dataKey="count"
                  nameKey="priority"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ priority, percent }) => `${priority} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {(analytics?.priorityDistribution || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Agent Performance Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Specialist Workload & SLA Compliance</h2>
            <p className="text-xs text-slate-400">Individual operational metrics for active round-robin agents</p>
          </div>
          <Link
            to="/admin/agents"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            <span>Manage All Agents</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <th className="py-3 px-4">Specialist</th>
                <th className="py-3 px-4">Total Assigned</th>
                <th className="py-3 px-4">Resolved</th>
                <th className="py-3 px-4">SLA Met</th>
                <th className="py-3 px-4">SLA Breached</th>
                <th className="py-3 px-4 text-right">Compliance Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {(analytics?.agentPerformance || []).map((agent) => {
                const totalAssigned = agent.total_assigned || 0;
                const slaMet = agent.sla_met_count || 0;
                const rate = totalAssigned > 0 ? Math.round((slaMet / totalAssigned) * 100) : 100;

                return (
                  <tr key={agent.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {agent.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">{totalAssigned}</td>
                    <td className="py-3.5 px-4 text-emerald-600 font-medium">{agent.resolved_count || 0}</td>
                    <td className="py-3.5 px-4 text-indigo-600 font-medium">{slaMet}</td>
                    <td className="py-3.5 px-4 text-rose-600 font-medium">{agent.sla_breached_count || 0}</td>
                    <td className="py-3.5 px-4 text-right font-bold">
                      <span className={rate >= 80 ? 'text-emerald-600' : 'text-amber-600'}>
                        {rate}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
