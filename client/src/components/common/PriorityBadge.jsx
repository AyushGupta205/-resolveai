import React from 'react';

const PRIORITY_CONFIG = {
  urgent: {
    label: 'Urgent',
    className: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
  },
  high: {
    label: 'High',
    className: 'bg-orange-50 text-orange-700 border-orange-200 font-semibold',
  },
  medium: {
    label: 'Medium',
    className: 'bg-slate-100 text-slate-700 border-slate-200 font-medium',
  },
  low: {
    label: 'Low',
    className: 'bg-slate-50 text-slate-600 border-slate-200 font-medium',
  },
};

export default function PriorityBadge({ priority }) {
  const config = PRIORITY_CONFIG[priority] || {
    label: priority,
    className: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${config.className}`}
    >
      {config.label}
    </span>
  );
}
