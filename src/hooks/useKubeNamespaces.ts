import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function useKubeNamespaces(context: string) {
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNamespaces = useCallback(async (showLoading = true) => {
    if (!context) return;
    if (showLoading) setLoading(true);
    
    try {
      const result = await invoke<string[]>('get_namespaces', { context });
      setNamespaces(result);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch namespaces', err);
      setError(err as string);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [context]);

  useEffect(() => {
    fetchNamespaces();
  }, [fetchNamespaces]);

  // Auto-refresh when there is an authentication error
  useEffect(() => {
    let intervalId: number;
    if (error && (error.includes('gcloud auth login') || error.includes('Reauthentication failed'))) {
      intervalId = window.setInterval(() => {
        fetchNamespaces(false); // background poll
      }, 3000);
    }
    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [error, fetchNamespaces]);

  return { namespaces, loading, error, refresh: fetchNamespaces };
}
