import React from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ message = 'Loading...', size = 'default' }) {
  const sizeClasses = size === 'small' ? 'w-4 h-4' : size === 'large' ? 'w-10 h-10' : 'w-6 h-6';

  return (
    <div className="flex flex-col items-center justify-center p-8 text-slate-500">
      <Loader2 className={`${sizeClasses} animate-spin text-indigo-600 mb-2`} />
      {message && <span className="text-sm font-medium">{message}</span>}
    </div>
  );
}
