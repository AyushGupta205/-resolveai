import React, { useState, useEffect } from 'react';
import { adminApi } from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import {
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Headphones,
  Clock,
  ShieldCheck,
  Check,
  X,
} from 'lucide-react';

export default function AgentManagementPage() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchAgents();
  }, []);

  async function fetchAgents() {
    setLoading(true);
    try {
      const res = await adminApi.getAgents();
      setAgents(res.data.agents || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch agent staff.');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus(agent) {
    const nextStatus = agent.is_active === 1 ? 0 : 1;
    setUpdatingId(agent.id);
    setError('');
    setSuccess('');

    try {
      await adminApi.updateAgentStatus(agent.id, { is_active: nextStatus });
      setSuccess(
        `Specialist ${agent.name} has been ${nextStatus === 1 ? 'activated' : 'deactivated'}. Assigned tickets remain preserved.`
      );
      setTimeout(() => setSuccess(''), 4000);
      await fetchAgents();
    } catch (err) {
      setError(err.message || 'Failed to update agent status.');
    } finally {
      setUpdatingId(null);
    }
  }

  const formatMinutes = (min) => {
    if (!min) return 'No replies yet';
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-700">
              Staff Administration
            </span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Support Specialists & Workload
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Activate or deactivate agents in the round-robin ticket dispatch pool. Deactivation safely skips an agent without affecting existing assignments.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-400 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')} className="text-emerald-400 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Staff Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <LoadingSpinner message="Loading support staff..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="py-3 px-4">Specialist</th>
                  <th className="py-3 px-4">Round-Robin Status</th>
                  <th className="py-3 px-4">Active Workload</th>
                  <th className="py-3 px-4">Resolved Tickets</th>
                  <th className="py-3 px-4">Total Assigned</th>
                  <th className="py-3 px-4">Avg Response Time</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {agents.map((agent) => {
                  const isActive = agent.is_active === 1;
                  const isUpdating = updatingId === agent.id;

                  return (
                    <tr key={agent.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-400'
                          }`}>
                            <Headphones className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block leading-tight">{agent.name}</span>
                            <span className="text-xs text-slate-400">{agent.email}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active in Rotation
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            Inactive / On Leave
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {agent.active_workload || 0}
                      </td>

                      <td className="py-3.5 px-4 text-emerald-600 font-medium">
                        {agent.resolved_tickets_count || 0}
                      </td>

                      <td className="py-3.5 px-4 text-slate-700">
                        {agent.assigned_tickets_count || 0}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {formatMinutes(agent.avg_response_time_minutes)}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStatus(agent)}
                          disabled={isUpdating}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                            isActive
                              ? 'border-rose-200 text-rose-700 hover:bg-rose-50'
                              : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {isUpdating
                            ? 'Updating...'
                            : isActive
                            ? 'Deactivate'
                            : 'Activate in Rotation'}
                        </button>
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
