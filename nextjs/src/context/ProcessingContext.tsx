'use client';

import { createContext, useContext, useRef, useState, useCallback } from 'react';

interface ReprocessProgress {
  targetStatus: string;
  batchIds: string[];
  done: number;
}

interface ProcessingContextValue {
  progress: ReprocessProgress | null;
  startReprocess: (status: string, ids: string[]) => void;
}

const ProcessingContext = createContext<ProcessingContextValue>({
  progress: null,
  startReprocess: () => {},
});

export function ProcessingProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<ReprocessProgress | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const startReprocess = useCallback((status: string, ids: string[]) => {
    eventSourceRef.current?.close();
    setProgress({ targetStatus: status, batchIds: ids, done: 0 });

    const batchSet = new Set(ids);
    const es = new EventSource('/api/expenses/stream');
    eventSourceRef.current = es;

    let done = 0;

    es.onmessage = (event) => {
      try {
        const { expense } = JSON.parse(event.data);
        if (batchSet.has(expense.id) && (expense.status === 'completed' || expense.status === 'failed')) {
          done += 1;
          setProgress((prev) => prev ? { ...prev, done } : null);
          if (done >= ids.length) {
            es.close();
            eventSourceRef.current = null;
            setProgress(null);
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, []);

  return (
    <ProcessingContext.Provider value={{ progress, startReprocess }}>
      {children}
    </ProcessingContext.Provider>
  );
}

export function useProcessing() {
  return useContext(ProcessingContext);
}
