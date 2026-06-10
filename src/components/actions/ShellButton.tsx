import { Terminal } from 'lucide-react';
import { Button } from '../ui/Button';
import { invoke } from '@tauri-apps/api/core';
import { useSettings } from '../../hooks/useSettings';
import { useActionHistory } from '../../hooks/useActionHistory';

interface ShellButtonProps {
  context: string;
  namespace: string;
  podName: string;
}

export function ShellButton({ context, namespace, podName }: ShellButtonProps) {
  const { addAction } = useActionHistory();
  const { settings } = useSettings();

  const handleOpenShell = async () => {
    try {
      await invoke('open_shell', { context, namespace, podName , terminalApp: settings.terminalApp });
      addAction({ type: 'Shell', context, namespace, podName });
    } catch (error) {
      console.error('Failed to open shell', error);
    }
  };

  return (
    <Button 
      variant="secondary" 
      icon={<Terminal size={16} />} 
      onClick={handleOpenShell}
      disabled={!podName}
    >
      Shell
    </Button>
  );
}
