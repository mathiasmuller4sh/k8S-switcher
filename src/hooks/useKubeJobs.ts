import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface JobInfo {
  name: string;
  status: string;
  startTime: string;
  completionTime?: string;
  duration: string;
  cronjobName?: string;
}

export function useKubeJobs(context: string, namespace: string) {
  const [jobs, setJobs] = useState<JobInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchJobs = async (showLoading = true) => {
    if (!context || !namespace) {
      setJobs([]);
      return;
    }

    if (showLoading) setLoading(true);
    try {
      const result = await invoke<JobInfo[]>('get_jobs', { context, namespace });
      setJobs(result);
    } catch (error) {
      console.error('Failed to fetch jobs', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [context, namespace]);

  useEffect(() => {
    let isActive = true;
    let timeout: any;

    const poll = async () => {
      if (!isActive) return;
      await fetchJobs(false);
      if (isActive) {
        timeout = setTimeout(poll, 10000); // Poll every 10s
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

  return { jobs, loading, refresh: () => fetchJobs(true), autoRefresh, setAutoRefresh };
}
