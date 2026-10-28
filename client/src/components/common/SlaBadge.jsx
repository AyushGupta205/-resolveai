import React from 'react';
import { AlertCircle, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function SlaBadge({ sla }) {
  if (!sla) return null;

  if (sla.status === 'overdue') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 shadow-sm animate-pulse">
        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
        <span>OVERDUE {sla.formattedTime ? `(${sla.formattedTime})` : ''}</span>
      </span>
    );
  }

  if (sla.status === 'approaching') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-sm">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
        <span>Approaching SLA ({sla.formattedTime})</span>
      </span>
    );
  }

  if (sla.status === 'met') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        <span>SLA Met</span>
      </span>
    );
  }

  if (sla.status === 'breached_responded') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
        <AlertCircle className="w-3.5 h-3.5 text-orange-600" />
        <span>Responded (Breached)</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
      <Clock className="w-3.5 h-3.5 text-slate-500" />
      <span>{sla.formattedTime || 'Within SLA'}</span>
    </span>
  );
}
