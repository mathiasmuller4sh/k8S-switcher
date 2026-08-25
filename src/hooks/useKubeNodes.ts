import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface NodeInfo {
  name: string;
  status: string;
  version: string;
  age: string;
  cpu: string;
  memory: string;
  podsCount: number;
  pods: { namespace: string; name: string; cpu: string; memory: string }[];
}

export function useKubeNodes(context: string) {
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNodes = async (showLoading = true) => {
    if (!context) {
      setNodes([]);
      setError(null);
      return;
    }

    if (showLoading) setLoading(true);
    setError(null);
    try {
      const result = await invoke<NodeInfo[]>('get_nodes', { context });
      setNodes(result);
    } catch (err: any) {
      console.error('Failed to fetch nodes', err);
      setError(String(err));
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchNodes();
  }, [context]);

  return { nodes, loading, error, refresh: () => fetchNodes(true) };
}
