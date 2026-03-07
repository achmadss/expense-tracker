'use client';

import { useState } from 'react';
import { XCircle } from 'lucide-react';

interface Props {
  id: string;
  disabled?: boolean;
  onSuccess?: () => void;
}

export default function CancelButton({ id, disabled = false, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);

  const handleCancel = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to cancel this expense? The processing will be stopped and you can reprocess it later.'
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/expenses/${id}/cancel`, { method: 'POST' });
      if (res.ok) {
        onSuccess?.();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to cancel expense.');
      }
    } catch {
      alert('Failed to cancel expense.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleCancel}
      disabled={disabled || loading}
      className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <XCircle className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Cancelling...' : 'Cancel'}
    </button>
  );
}
