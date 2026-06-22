import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface WorkloadInfo {
  kind: String;
  name: string;
  ready: string;
  up_to_date: string;
  available: string;
  age: string;
}

export function useKubeWorkloads(context: string, namespace: string) {
  const [workloads, setWorkloads] = useState<WorkloadInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchWorkloads = useCallback(async (showLoadingState = true) => {
    if (!context || !namespace) {
      setWorkloads([]);
      return;
    }

    if (showLoadingState) setLoading(true);
    setError(null);

    try {
      const data = await invoke<WorkloadInfo[]>('get_workloads', { context, namespace });
      setWorkloads(data);
    } catch (err) {
      console.error('Failed to fetch workloads:', err);
      setError(err as string);
    } finally {
      if (showLoadingState) setLoading(false);
    }
  }, [context, namespace]);

  useEffect(() => {
    fetchWorkloads(true);
  }, [fetchWorkloads]);

  useEffect(() => {
    let intervalId: number;
    if (autoRefresh) {
      intervalId = window.setInterval(() => {
        fetchWorkloads(false);
      }, 5000);
    }
    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [autoRefresh, fetchWorkloads]);

  return { workloads, loading, error, refresh: () => fetchWorkloads(true), autoRefresh, setAutoRefresh };
}
