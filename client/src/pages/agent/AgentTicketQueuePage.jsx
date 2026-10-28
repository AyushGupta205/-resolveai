import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ticketApi, adminApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';
import PriorityBadge from '../../components/common/PriorityBadge';
import SlaBadge from '../../components/common/SlaBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Headphones,
  ArrowRight,
} from 'lucide-react';

const CATEGORIES = [
  'Technical Issue',
  'Billing and Payments',
  'Account Access',
  'Feature Request',
  'Bug Report',
  'General Inquiry',
];

export default function AgentTicketQueuePage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const [assignedAgentId, setAssignedAgentId] = useState('');
  const [sortBy, setSortBy] = useState('deadline'); // Default to SLA deadline to prioritize urgent items!
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchAgents();
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [search, status, priority, category, assignedAgentId, sortBy, page]);

  async function fetchAgents() {
    try {
      const res = await adminApi.getAgents();
      setAgents(res.data.agents || []);
    } catch (e) {
      // Non-admins might get 403 on full agent list, which is totally expected
    }
  }

  async function fetchTickets() {
    setLoading(true);
    try {
      const params = {
        search: search.trim() || undefined,
        status: status || undefined,
        priority: priority || undefined,
        category: category || undefined,
        assigned_agent_id: assignedAgentId || undefined,
        sortBy,
        page,
        limit: 12,
      };

      const res = await ticketApi.getTickets(params);
      setTickets(res.data.tickets || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
      setTotal(res.data.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to load queue', err);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setSearch('');
    setStatus('');
    setPriority('');
    setCategory('');
    setAssignedAgentId('');
    setSortBy('deadline');
    setPage(1);
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Support Ticket Queue</h1>
          <p className="text-xs text-slate-500 mt-1">
            Global ticket queue sorted by SLA deadline priority ({total} tickets)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setAssignedAgentId(user?.id.toString());
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              assignedAgentId === user?.id.toString()
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            Assigned to Me
          </button>
          <button
            onClick={() => {
              setAssignedAgentId('');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              assignedAgentId === ''
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            All Queue
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by ticket ID, subject, or description..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="waiting_customer">Waiting on Customer</option>
              <option value="resolved">Resolved</option>
            </select>

            <select
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[150px] truncate"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {agents.length > 0 && (
              <select
                value={assignedAgentId}
                onChange={(e) => {
                  setAssignedAgentId(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[150px] truncate"
              >
                <option value="">All Specialists</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            )}

            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="deadline">Sort: SLA Deadline</option>
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="priority">Sort: Priority</option>
            </select>

            {(search || status || priority || category || assignedAgentId || sortBy !== 'deadline') && (
              <button
                onClick={handleReset}
                className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-900 font-medium underline"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Ticket Queue Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <LoadingSpinner message="Filtering queue..." />
        ) : tickets.length === 0 ? (
          <EmptyState
            title="No tickets in queue"
            description="No tickets match your specified filters."
            action={
              <button
                onClick={handleReset}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reset Filters
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Specialist</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">SLA Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {tickets.map((t) => {
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
                      <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                        {t.agent_name ? (
                          <span className="flex items-center gap-1 font-medium">
                            <Headphones className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{t.agent_name}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
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
                          <span>Open</span>
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page <strong className="text-slate-800">{page}</strong> of{' '}
              <strong className="text-slate-800">{totalPages}</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
