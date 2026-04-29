import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface RolloutRestartButtonProps {
  context: string;
  namespace: string;
  podName: string;
}

export function RolloutRestartButton({ context, namespace, podName }: RolloutRestartButtonProps) {
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
    <button 
      className="ui-button ui-button-secondary"
      onClick={handleRestart}
      disabled={loading}
      title="Rollout Restart parent resource"
      style={{ gap: '8px' }}
    >
      <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
      <span>Restart</span>
    </button>
  );
}
