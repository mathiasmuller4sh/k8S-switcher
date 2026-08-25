import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { invoke } from '@tauri-apps/api/core';

interface RolloutRestartButtonProps {
  context: string;
  namespace: string;
  podName: string;
  iconOnly?: boolean;
}

export function RolloutRestartButton({ context, namespace, podName, iconOnly = false }: RolloutRestartButtonProps) {
  const [loading, setLoading] = useState(false);
  

  const handleRestart = async () => {
    setLoading(true);
    try {
      await invoke('rollout_restart', { context, namespace, podName });
      // Show success notification or feedback if needed
    } catch (e) {
      console.error('Failed to rollout restart', e);
      // Show error feedback
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      variant={iconOnly ? "ghost" : "secondary"}
      onClick={handleRestart}
      disabled={loading}
      title="Rollout Restart parent resource"
      icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
      iconOnly={iconOnly}
    >
      {!iconOnly && "Restart"}
    </Button>
  );
}
