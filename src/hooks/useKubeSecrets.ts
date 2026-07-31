import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface Secret {
  name: string;
  secretType: string;
  dataCount: number;
  age: string;
}

export function useKubeSecrets(context: string, namespace: string) {
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSecrets = async (showLoading = true) => {
    if (!context || !namespace) {
      setSecrets([]);
      setError(null);
      return;
    }

    if (showLoading) setLoading(true);
    setError(null);
    try {
      const result = await invoke<Secret[]>('get_secrets', { context, namespace });
      setSecrets(result);
    } catch (err: any) {
      console.error('Failed to fetch secrets', err);
      setError(String(err));
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecrets();
  }, [context, namespace]);

  return { secrets, loading, error, refresh: () => fetchSecrets(true) };
}
