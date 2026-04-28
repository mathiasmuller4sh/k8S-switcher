import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function useKubeContexts() {
  const [contexts, setContexts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContexts = async () => {
      setLoading(true);
      try {
        const result = await invoke<string[]>('get_contexts');
        setContexts(result);
      } catch (error) {
        console.error('Failed to fetch contexts', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContexts();
  }, []);

  return { contexts, loading };
}
