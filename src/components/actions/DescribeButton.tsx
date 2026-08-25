import { FileText } from 'lucide-react';
import { Button } from '../ui/Button';
import { invoke } from '@tauri-apps/api/core';
import { useSettings } from '../../hooks/useSettings';
import { useActionHistory } from '../../hooks/useActionHistory';
import { useTerminal } from '../../hooks/useTerminal';

interface DescribeButtonProps {
  context: string;
  namespace: string;
  podName: string;
  kind?: string;
  iconOnly?: boolean;
}

export function DescribeButton({ context, namespace, podName, kind, iconOnly = false }: DescribeButtonProps) {
  const { addAction } = useActionHistory();
  const { settings } = useSettings();
  const { openTerminal } = useTerminal();

  const handleDescribe = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (settings.terminalApp === 'Interne') {
        openTerminal(`Describe: ${podName}`, "kubectl", [
          "--context", context,
          "-n", namespace,
          "describe", kind || "pod", podName
        ]);
      } else {
        await invoke('open_describe', { context, namespace, podName, kind, terminalApp: settings.terminalApp });
      }
      addAction({ type: 'Describe', context, namespace, podName });
    } catch (error) {
      console.error('Failed to describe', error);
    }
  };

  return (
    <Button 
      variant={iconOnly ? "ghost" : "secondary"}
      icon={<FileText size={14} />} 
      onClick={handleDescribe}
      disabled={!podName}
      title="Describe"
      iconOnly={iconOnly}
    >
      {!iconOnly && "Describe"}
    </Button>
  );
}
