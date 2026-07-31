import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface Pvc {
  name: string;
  status: string;
  capacity: string;
  accessModes: string[];
  storageClass: string;
  age: string;
}

export function useKubePvcs(context: string, namespace: string) {
  const [pvcs, setPvcs] = useState<Pvc[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchPvcs = async (showLoading = true) => {
    if (!context || !namespace) {
      setPvcs([]);
      setError(null);
      return;
    }

    if (showLoading) setLoading(true);
    setError(null);
    try {
      const result = await invoke<Pvc[]>('get_pvcs', { context, namespace });
      setPvcs(result);
    } catch (err: any) {
      console.error('Failed to fetch PVCs', err);
      setError(String(err));
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchPvcs();
  }, [context, namespace]);

  useEffect(() => {
    let interval: any;
    if (autoRefresh && context && namespace) {
      interval = setInterval(() => {
        fetchPvcs(false);
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, context, namespace]);

  return { pvcs, loading, error, refresh: () => fetchPvcs(true), autoRefresh, setAutoRefresh };
}
