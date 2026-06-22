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

  const fetchSecrets = async (showLoading = true) => {
    if (!context || !namespace) {
      setSecrets([]);
      return;
    }

    if (showLoading) setLoading(true);
    try {
      const result = await invoke<Secret[]>('get_secrets', { context, namespace });
      setSecrets(result);
    } catch (error) {
      console.error('Failed to fetch secrets', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecrets();
  }, [context, namespace]);

  return { secrets, loading, refresh: () => fetchSecrets(true) };
}
