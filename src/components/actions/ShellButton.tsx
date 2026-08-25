import { Terminal } from 'lucide-react';
import { Button } from '../ui/Button';
import { invoke } from '@tauri-apps/api/core';
import { useSettings } from '../../hooks/useSettings';
import { useActionHistory } from '../../hooks/useActionHistory';
import { useTerminal } from '../../hooks/useTerminal';

interface ShellButtonProps {
  context: string;
  namespace: string;
  podName: string;
  iconOnly?: boolean;
}

export function ShellButton({ context, namespace, podName, iconOnly = false }: ShellButtonProps) {
  const { addAction } = useActionHistory();
  const { settings } = useSettings();
  const { openTerminal } = useTerminal();

  const handleOpenShell = async () => {
    try {
      if (settings.terminalApp === 'Interne') {
        openTerminal(`Shell: ${podName}`, "kubectl", [
          "--context", context,
          "-n", namespace,
          "exec", "-it", podName,
          "--", "/bin/sh"
        ]);
      } else {
        await invoke('open_shell', { context, namespace, podName, terminalApp: settings.terminalApp });
      }
      addAction({ type: 'Shell', context, namespace, podName });
    } catch (error) {
      console.error('Failed to open shell', error);
    }
  };

  return (
    <Button 
      variant={iconOnly ? "ghost" : "secondary"}
      icon={<Terminal size={14} />} 
      onClick={handleOpenShell}
      disabled={!podName}
      title="Shell"
      iconOnly={iconOnly}
    >
      {!iconOnly && "Shell"}
    </Button>
  );
}
