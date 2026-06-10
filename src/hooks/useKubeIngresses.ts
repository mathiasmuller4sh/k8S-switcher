import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface Ingress {
  name: string;
  hosts: string;
  address: string;
  ports: string;
  age: string;
}

export function useKubeIngresses(context: string, namespace: string) {
  const [ingresses, setIngresses] = useState<Ingress[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchIngresses = async (showLoading = true) => {
    if (!context || !namespace) {
      setIngresses([]);
      return;
    }

    if (showLoading) setLoading(true);
    try {
      const result = await invoke<Ingress[]>('get_ingresses', { context, namespace });
      setIngresses(result);
    } catch (error) {
      console.error('Failed to fetch Ingresses', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchIngresses();
  }, [context, namespace]);

  useEffect(() => {
    let interval: any;
    if (autoRefresh && context && namespace) {
      interval = setInterval(() => {
        fetchIngresses(false);
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, context, namespace]);

  return { ingresses, loading, refresh: () => fetchIngresses(true), autoRefresh, setAutoRefresh };
}
