import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function useKubeContexts() {
  const [contexts, setContexts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContexts = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<string[]>('get_contexts');
      setContexts(result);
    } catch (err: any) {
      console.error('Failed to fetch contexts', err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContexts();
  }, []);

  return { contexts, loading, error, refresh: fetchContexts };
}
