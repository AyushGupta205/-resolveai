import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ticketApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';
import PriorityBadge from '../../components/common/PriorityBadge';
import SlaBadge from '../../components/common/SlaBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import {
  Ticket,
  Clock,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Headphones,
  User,
  Filter,
} from 'lucide-react';

export default function AgentDashboard() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'overdue', 'approaching', 'unassigned'

  useEffect(() => {
    fetchDashboardTickets();
  }, []);

  async function fetchDashboardTickets() {
    setLoading(true);
    try {
      // Fetch queue tickets
      const res = await ticketApi.getTickets({ limit: 50 });
      setTickets(res.data.tickets || []);
    } catch (err) {
      console.error('Failed to load tickets', err);
    } finally {
      setLoading(false);
    }
  }

  // Derive stats
  const assignedToMe = tickets.filter((t) => t.assigned_agent_id === user?.id);
  const overdueTickets = tickets.filter((t) => t.sla?.isOverdue);
  const approachingSla = tickets.filter((t) => t.sla?.isApproaching);
  const openCount = assignedToMe.filter((t) => t.status === 'open').length;
  const inProgressCount = assignedToMe.filter((t) => t.status === 'in_progress').length;
  const resolvedCount = assignedToMe.filter((t) => t.status === 'resolved').length;

  let displayedTickets = tickets;
  if (filterMode === 'my_assigned') {
    displayedTickets = assignedToMe;
  } else if (filterMode === 'overdue') {
    displayedTickets = overdueTickets;
  } else if (filterMode === 'approaching') {
    displayedTickets = approachingSla;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Agent Command Center
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Specialist Dashboard: {user?.name}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Prioritize tickets approaching SLA breach, generate AI draft replies, and resolve inquiries.
          </p>
        </div>

        <Link
          to="/agent/queue"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs hover:shadow transition-all whitespace-nowrap self-start sm:self-auto"
        >
          <span>Open Full Ticket Queue</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <button
          onClick={() => setFilterMode('all')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            filterMode === 'all'
              ? 'bg-indigo-50/60 border-indigo-300 ring-2 ring-indigo-200'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Queue Total</span>
            <Ticket className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-2">{tickets.length}</p>
          <span className="text-[10px] text-slate-400 mt-1 block">Active workspace pool</span>
        </button>

        <button
          onClick={() => setFilterMode('my_assigned')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            filterMode === 'my_assigned'
              ? 'bg-indigo-50/60 border-indigo-300 ring-2 ring-indigo-200'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Assigned to Me</span>
            <Headphones className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-extrabold text-indigo-600 mt-2">{assignedToMe.length}</p>
          <span className="text-[10px] text-slate-400 mt-1 block">{inProgressCount} in progress</span>
        </button>

        <button
          onClick={() => setFilterMode('overdue')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            filterMode === 'overdue'
              ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-200'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-rose-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">SLA Overdue</span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-extrabold text-rose-600 mt-2">{overdueTickets.length}</p>
          <span className="text-[10px] text-rose-500 font-semibold mt-1 block">Requires instant action</span>
        </button>

        <button
          onClick={() => setFilterMode('approaching')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            filterMode === 'approaching'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-amber-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">&lt; 1h to Breach</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-extrabold text-amber-600 mt-2">{approachingSla.length}</p>
          <span className="text-[10px] text-amber-600 font-medium mt-1 block">Approaching deadline</span>
        </button>

        <div className="p-4 rounded-2xl border bg-white border-slate-200 text-left">
          <div className="flex items-center justify-between text-emerald-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Resolved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-600 mt-2">{resolvedCount}</p>
          <span className="text-[10px] text-slate-400 mt-1 block">Closed successfully</span>
        </div>
      </div>

      {/* Ticket List Header with Filter Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {filterMode === 'overdue'
                ? '🚨 Overdue Tickets (Immediate Attention Required)'
                : filterMode === 'approaching'
                ? '⚠️ Approaching SLA Deadline Tickets'
                : filterMode === 'my_assigned'
                ? 'My Assigned Tickets'
                : 'Priority Ticket Queue'}
            </h2>
            <p className="text-xs text-slate-400">
              Showing {displayedTickets.length} tickets matching active view
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 rounded-lg transition-all ${
                filterMode === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterMode('my_assigned')}
              className={`px-3 py-1 rounded-lg transition-all ${
                filterMode === 'my_assigned' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Mine
            </button>
            <button
              onClick={() => setFilterMode('overdue')}
              className={`px-3 py-1 rounded-lg transition-all ${
                filterMode === 'overdue' ? 'bg-rose-500 text-white shadow-xs' : 'text-rose-600 hover:text-rose-800'
              }`}
            >
              Overdue ({overdueTickets.length})
            </button>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner message="Loading queue..." />
        ) : displayedTickets.length === 0 ? (
          <EmptyState
            title="Queue is clear"
            description="No tickets currently match this operational filter."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="py-3 px-4">Ticket ID</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">SLA Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {displayedTickets.map((t) => {
                  const isOverdue = t.sla?.isOverdue;
                  return (
                    <tr
                      key={t.id}
                      className={`transition-colors ${
                        isOverdue ? 'bg-rose-50/30 hover:bg-rose-50/60' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-medium text-xs text-slate-600">
                        {t.id}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs font-semibold text-slate-900 truncate">
                        <Link to={`/agent/tickets/${t.id}`} className="hover:text-indigo-600 block truncate">
                          {t.subject}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                        <span className="font-medium text-slate-800 block">{t.customer_name}</span>
                        <span className="text-[11px] text-slate-400">{t.customer_email}</span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 font-medium whitespace-nowrap">
                        {t.category}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <SlaBadge sla={t.sla} />
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <Link
                          to={`/agent/tickets/${t.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors"
                        >
                          <span>Manage</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
