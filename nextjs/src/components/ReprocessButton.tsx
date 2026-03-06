'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface Props {
  id: string;
  disabled?: boolean;
  onSuccess?: () => void;
}

export default function ReprocessButton({ id, disabled = false, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);

  const handleReprocess = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to reprocess this expense? This will run OCR and LLM extraction again using existing images.'
    );
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/expenses/${id}/redo`, { method: 'POST' });
      if (res.ok) {
        onSuccess?.();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to reprocess expense.');
      }
    } catch {
      alert('Failed to reprocess expense.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleReprocess}
      disabled={disabled || loading}
      className="inline-flex items-center gap-2 px-4 py-2 border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Reprocessing...' : 'Reprocess'}
    </button>
  );
}
