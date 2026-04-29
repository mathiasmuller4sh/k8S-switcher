import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Layers } from 'lucide-react';
import { Button } from '../ui/Button';

interface AppLogsButtonProps {
  context: string;
  namespace: string;
  labels: Record<string, string>;
}

export function AppLogsButton({ context, namespace, labels }: AppLogsButtonProps) {
  const [loading, setLoading] = useState(false);

  // Try to find the most relevant app label
  const getAppSelector = () => {
    const priorityLabels = ['app', 'app.kubernetes.io/name', 'name', 'service', 'component'];
    for (const key of priorityLabels) {
      if (labels[key]) {
        return `${key}=${labels[key]}`;
      }
    }
    return null;
  };

  const selector = getAppSelector();

  const handleOpenLogs = async () => {
    if (!selector) return;
    setLoading(true);
    try {
      await invoke('open_logs_by_label', { 
        context, 
        namespace, 
        labelSelector: selector 
      });
    } catch (error) {
      console.error('Failed to open app logs', error);
    } finally {
      setLoading(false);
    }
  };

  if (!selector) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleOpenLogs}
      disabled={loading}
      className="ui-action-btn"
      title={`Logs for all pods with ${selector}`}
    >
      <Layers size={14} className="mr-2" />
      App Logs
    </Button>
  );
}
