import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function useKubeNamespaces(context: string) {
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!context) return;

    const fetchNamespaces = async () => {
      setLoading(true);
      try {
        const result = await invoke<string[]>('get_namespaces', { context });
        setNamespaces(result);
      } catch (error) {
        console.error('Failed to fetch namespaces', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNamespaces();
  }, [context]);

  return { namespaces, loading };
}
