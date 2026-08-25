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
  metrics?: {
    cpu: string;
    memory: string;
  };
}

export function useKubePods(context: string, namespace: string) {
  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchPods = async (showLoading = true) => {
    if (!context || !namespace) {
      setPods([]);
      setError(null);
      return;
    }

    if (showLoading) setLoading(true);
    setError(null);
    try {
      const result = await invoke<Pod[]>('get_pods', { context, namespace });
      
      // Fetch metrics concurrently but don't fail if they error out
      try {
        const metrics = await invoke<Record<string, { cpu: string; memory: string }>>('get_all_pod_metrics', { context, namespace });
        if (metrics) {
          result.forEach(pod => {
            if (metrics[pod.name]) {
              pod.metrics = metrics[pod.name];
            }
          });
        }
      } catch (metricsErr) {
        console.warn('Failed to fetch pod metrics', metricsErr);
      }

      setPods(result);
    } catch (err: any) {
      console.error('Failed to fetch pods', err);
      setError(String(err));
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchPods();
  }, [context, namespace]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchPods(false); // Don't show loading state on auto-refresh
    }, 5000); // 5 seconds
    
    return () => clearInterval(interval);
  }, [context, namespace, autoRefresh]);

  return { pods, loading, error, refresh: () => fetchPods(true), autoRefresh, setAutoRefresh };
}
