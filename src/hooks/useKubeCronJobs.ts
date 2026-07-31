import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface CronJobInfo {
  name: string;
  schedule: string;
  suspend: boolean;
  active: number;
  lastSchedule: string;
  age: string;
}

export function useKubeCronJobs(context: string, namespace: string) {
  const [cronjobs, setCronJobs] = useState<CronJobInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchCronJobs = async (showLoading = true) => {
    if (!context || !namespace) {
      setCronJobs([]);
      setError(null);
      return;
    }

    if (showLoading) setLoading(true);
    setError(null);
    try {
      const result = await invoke<CronJobInfo[]>('get_cronjobs', { context, namespace });
      setCronJobs(result);
    } catch (error) {
      console.error('Failed to fetch cronjobs', error);
      setError(String(error));
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchCronJobs();
  }, [context, namespace]);

  useEffect(() => {
    let isActive = true;
    let timeout: any;

    const poll = async () => {
      if (!isActive) return;
      await fetchCronJobs(false);
      if (isActive) {
        timeout = setTimeout(poll, 10000); // Poll every 10s for cronjobs
      }
    };

    if (autoRefresh && context && namespace) {
      timeout = setTimeout(poll, 10000);
    }

    return () => {
      isActive = false;
      if (timeout) clearTimeout(timeout);
    };
  }, [autoRefresh, context, namespace]);

  return { cronjobs, loading, error, refresh: () => fetchCronJobs(true), autoRefresh, setAutoRefresh };
}
