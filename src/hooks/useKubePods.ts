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
}

export function useKubePods(context: string, namespace: string) {
  const [pods, setPods] = useState<Pod[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!context || !namespace) {
      setPods([]);
      return;
    }

    const fetchPods = async () => {
      setLoading(true);
      try {
        const result = await invoke<Pod[]>('get_pods', { context, namespace });
        setPods(result);
      } catch (error) {
        console.error('Failed to fetch pods', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPods();
  }, [context, namespace]);

  return { pods, loading };
}
