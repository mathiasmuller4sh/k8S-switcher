import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface ContainerResources {
  name: string;
  cpuRequest: string;
  memoryRequest: string;
  cpuLimit: string;
  memoryLimit: string;
}

export interface Pod {
  name: string;
  status: string;
  age: string;
  image: string;
  ports: number[];
  containers: ContainerResources[];
  labels: Record<string, string>;
}

export function useKubePods(context: string, namespace: string) {
  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchPods = async (showLoading = true) => {
    if (!context || !namespace) {
      setPods([]);
      return;
    }

    if (showLoading) setLoading(true);
    try {
      const result = await invoke<Pod[]>('get_pods', { context, namespace });
      setPods(result);
    } catch (error) {
      console.error('Failed to fetch pods', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchPods();
  }, [context, namespace]);

  useEffect(() => {
    let interval: any;
    if (autoRefresh && context && namespace) {
      interval = setInterval(() => {
        fetchPods(false);
      }, 5000); // 5 seconds polling
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, context, namespace]);

  return { pods, loading, refresh: () => fetchPods(true), autoRefresh, setAutoRefresh };
}
