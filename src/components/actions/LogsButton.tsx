import { TerminalSquare } from 'lucide-react';
import { Button } from '../ui/Button';
import { invoke } from '@tauri-apps/api/core';
import { useSettings } from '../../hooks/useSettings';
import { useActionHistory } from '../../hooks/useActionHistory';

interface LogsButtonProps {
  context: string;
  namespace: string;
  podName: string;
}

export function LogsButton({ context, namespace, podName }: LogsButtonProps) {
  const { addAction } = useActionHistory();
  const { settings } = useSettings();

  const handleOpenLogs = async () => {
    try {
      await invoke('open_logs', { context, namespace, podName , terminalApp: settings.terminalApp });
      addAction({ type: 'Logs', context, namespace, podName });
    } catch (error) {
      console.error('Failed to open logs', error);
    }
  };

  return (
    <Button 
      variant="secondary" 
      icon={<TerminalSquare size={16} />} 
      onClick={handleOpenLogs}
      disabled={!podName}
    >
      Logs
    </Button>
  );
}
