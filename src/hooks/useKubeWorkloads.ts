import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface WorkloadInfo {
  kind: string;
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
      setError(String(err));
    } finally {
      if (showLoadingState) setLoading(false);
    }
  }, [context, namespace]);

  useEffect(() => {
    fetchWorkloads();
  }, [context, namespace]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchWorkloads(false); // Don't show loading state on auto-refresh
    }, 5000); // 5 seconds
    
    return () => clearInterval(interval);
  }, [context, namespace, autoRefresh]);

  return { workloads, loading, error, refresh: () => fetchWorkloads(true), autoRefresh, setAutoRefresh };
}
