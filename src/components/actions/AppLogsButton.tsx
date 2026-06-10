import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettings } from '../../hooks/useSettings';
import { Layers } from 'lucide-react';
import { Button } from '../ui/Button';

interface AppLogsButtonProps {
  context: string;
  namespace: string;
  labels: Record<string, string>;
}

export function AppLogsButton({ context, namespace, labels }: AppLogsButtonProps) {
  const [loading, setLoading] = useState(false);
  const { settings } = useSettings();

  // Try to find the most relevant app label
  const getAppSelector = () => {
    const ignoredKeys = [
      'pod-template-hash', 
      'controller-revision-hash', 
      'statefulset.kubernetes.io/pod-name',
      'heritage',
      'release',
      'chart'
    ];
    
    // Find all labels that are not technical/internal
    const candidates = Object.entries(labels)
      .filter(([key]) => !ignoredKeys.some(ignored => key.toLowerCase().includes(ignored)))
      .map(([key, value]) => ({ key, value }));

    if (candidates.length === 0) return null;

    // Strategy: pick the one with the shortest value (usually the most generic app name)
    // If lengths are equal, prioritize keys like 'app' or 'name'
    const bestMatch = candidates.reduce((prev, curr) => {
      if (curr.value.length < prev.value.length) return curr;
      if (curr.value.length === prev.value.length) {
        const priorityKeys = ['app', 'name', 'component'];
        if (priorityKeys.includes(curr.key) && !priorityKeys.includes(prev.key)) return curr;
      }
      return prev;
    });

    return {
      selector: `${bestMatch.key}=${bestMatch.value}`,
      value: bestMatch.value
    };
  };

  const appInfo = getAppSelector();

  const handleOpenLogs = async () => {
    if (!appInfo) return;
    setLoading(true);
    try {
      await invoke('open_logs_by_label', { 
        context, 
        namespace, 
        labelSelector: appInfo.selector 
      , terminalApp: settings.terminalApp });
    } catch (error) {
      console.error('Failed to open app logs', error);
    } finally {
      setLoading(false);
    }
  };

  if (!appInfo) return null;

  return (
    <Button
      variant="ghost"
      onClick={handleOpenLogs}
      disabled={loading}
      className="ui-action-btn"
      title={`Logs for all pods with ${appInfo.selector}`}
    >
      <Layers size={14} className="mr-2" />
      Logs ({appInfo.value})
    </Button>
  );
}
