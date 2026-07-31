import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface KubeEvent {
  eventType: string;
  reason: string;
  object: string;
  message: string;
  age: string;
}

export function useKubeEvents(context: string, namespace: string) {
  const [events, setEvents] = useState<KubeEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchEvents = async (showLoading = true) => {
    if (!context || !namespace) {
      setEvents([]);
      setError(null);
      return;
    }

    if (showLoading) setLoading(true);
    setError(null);
    try {
      const result = await invoke<KubeEvent[]>('get_events', { context, namespace });
      setEvents(result);
    } catch (err: any) {
      console.error('Failed to fetch Events', err);
      setError(String(err));
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [context, namespace]);

  useEffect(() => {
    let interval: any;
    if (autoRefresh && context && namespace) {
      interval = setInterval(() => {
        fetchEvents(false);
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, context, namespace]);

  return { events, loading, error, refresh: () => fetchEvents(true), autoRefresh, setAutoRefresh };
}
