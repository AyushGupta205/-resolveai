import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  BarChart3,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

export default function PerformanceAnalyticsPage() {
  const [analytics, setAnalytics] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [aRes, oRes] = await Promise.all([
        adminApi.getAnalytics(),
        adminApi.getOverview(),
      ]);
      setAnalytics(aRes.data.analytics);
      setOverview(oRes.data.overview);
    } catch (err) {
      console.error('Failed to load analytics', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <LoadingSpinner message="Generating analytics reports..." size="large" />;
  }

  const formatMinutes = (min) => {
    if (!min) return 'N/A';
    if (min < 60) return `${min} minutes`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2 mb-1">
          <BarChart3 className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
            SLA & Quality Analytics
          </span>
        </div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          First-Response SLA Compliance & Volume Trends
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Target First-Response SLA: <strong>4.0 Calendar Hours</strong>. Derived strictly from persistent timestamps.
        </p>
      </div>

      {/* SLA Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Average First Response</span>
            <Clock className="w-5 h-5 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {formatMinutes(overview?.avgFirstResponseMinutes)}
          </p>
          <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
            Calculated between <code className="bg-slate-100 px-1 py-0.5 rounded">created_at</code> and the first qualifying <strong className="text-slate-700">public agent reply</strong>. Excludes unreplied tickets from average calculation.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-rose-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total SLA Breaches</span>
            <AlertCircle className="w-5 h-5 text-rose-600" />
          </div>
          <p className="text-2xl font-bold text-rose-600 mt-2">{overview?.slaBreachCount || 0}</p>
          <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
            Tickets where either a reply was sent after the 4-hour window, or the current time exceeded the deadline without a public response.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-emerald-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Responded Sample Size</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {overview?.respondedTicketsCount || 0}{' '}
            <span className="text-sm font-normal text-slate-400">/ {overview?.totalTickets || 0} tickets</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
            Internal notes do not count toward first response, preserving SLA timer integrity.
          </p>
        </div>
      </div>

      {/* Ticket Volume Over Time Line Chart */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Ticket Creation Volume Timeline</h2>
            <p className="text-xs text-slate-400">Daily ticket distribution across recent dates</p>
          </div>
          <TrendingUp className="w-4 h-4 text-slate-400" />
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={analytics?.volumeOverTime || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  fontSize: '12px',
                }}
              />
              <Line
                type="monotone"
                dataKey="count"
                name="New Tickets"
                stroke="#6366f1"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#6366f1' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Distribution Breakdown */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Category Volume & Proportion</h2>
          <p className="text-xs text-slate-400">Breakdown of support topics handled by the team</p>
        </div>

        <div className="space-y-3">
          {(analytics?.categoryDistribution || []).map((cat) => {
            const total = overview?.totalTickets || 1;
            const pct = Math.round((cat.count / total) * 100);

            return (
              <div key={cat.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-800">{cat.category}</span>
                  <span className="text-slate-500 font-mono">
                    {cat.count} tickets ({pct}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
