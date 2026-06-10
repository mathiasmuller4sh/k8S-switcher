import { FileText } from 'lucide-react';
import { Button } from '../ui/Button';
import { invoke } from '@tauri-apps/api/core';
import { useSettings } from '../../hooks/useSettings';
import { useActionHistory } from '../../hooks/useActionHistory';

interface DescribeButtonProps {
  context: string;
  namespace: string;
  podName: string;
}

export function DescribeButton({ context, namespace, podName }: DescribeButtonProps) {
  const { addAction } = useActionHistory();
  const { settings } = useSettings();

  const handleDescribe = async () => {
    try {
      await invoke('open_describe', { context, namespace, podName , terminalApp: settings.terminalApp });
      addAction({ type: 'Describe', context, namespace, podName });
    } catch (error) {
      console.error('Failed to describe pod', error);
    }
  };

  return (
    <Button 
      variant="secondary" 
      icon={<FileText size={16} />} 
      onClick={handleDescribe}
      disabled={!podName}
    >
      Describe
    </Button>
  );
}
