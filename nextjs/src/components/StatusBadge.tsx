'use client';

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const styles: Record<string, string> = {
    unprocessed: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50',
    processing: 'bg-blue-900/50 text-blue-300 border border-blue-700/50',
    completed: 'bg-green-900/50 text-green-300 border border-green-700/50',
    failed: 'bg-red-900/50 text-red-300 border border-red-700/50',
    cancelled: 'bg-[#3e3e42] text-[#858585] border border-[#3e3e42]',
  };

  const labels: Record<string, string> = {
    unprocessed: 'Unprocessed',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status] || 'bg-[#3e3e42] text-[#858585]'}`}>
      {labels[status] || status}
    </span>
  );
}
