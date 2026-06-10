import React, { useState } from 'react';
import { Unplug, Plug } from 'lucide-react';
import { Button } from '../ui/Button';
import { invoke } from '@tauri-apps/api/core';
import { useSettings } from '../../hooks/useSettings';
import { useActionHistory } from '../../hooks/useActionHistory';

interface PortForwardButtonProps {
  context: string;
  namespace: string;
  podName: string;
  podPorts: number[];
}

export function PortForwardButton({ context, namespace, podName, podPorts }: PortForwardButtonProps) {
  const firstPort = podPorts.length > 0 ? String(podPorts[0]) : '8080';
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const { settings } = useSettings();
  const [localPort, setLocalPort] = useState(firstPort);
  const [podPort, setPodPort] = useState(firstPort);
  const { addAction } = useActionHistory();
  
  // Reset ports when pod changes
  React.useEffect(() => {
    const p = podPorts.length > 0 ? String(podPorts[0]) : '8080';
    setLocalPort(p);
    setPodPort(p);
    setIsActive(false);
  }, [podName]);

  const togglePortForward = async () => {
    if (!localPort || !podPort) return;
    
    setLoading(true);
    try {
      if (isActive) {
        await invoke('stop_port_forward', { podName });
        setIsActive(false);
      } else {
        const lp = parseInt(localPort, 10);
        const pp = parseInt(podPort, 10);
        await invoke('start_port_forward', { 
          context, 
          namespace, 
          podName, 
          localPort: lp, 
          podPort: pp 
        , terminalApp: settings.terminalApp });
        addAction({ type: 'PortForward', context, namespace, podName, localPort: lp, podPort: pp });
        setIsActive(true);
      }
    } catch (error) {
      console.error('Failed to toggle port forward', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ui-port-forward-wrapper">
      <div className="ui-port-inputs">
        <input 
          type="number" 
          className="ui-port-input" 
          value={localPort}
          onChange={e => setLocalPort(e.target.value)}
          placeholder="Local"
          disabled={isActive || loading}
          title="Local Port"
        />
        <span className="ui-port-separator">:</span>
        <input 
          type="number" 
          className="ui-port-input" 
          value={podPort}
          onChange={e => setPodPort(e.target.value)}
          placeholder="Pod"
          disabled={isActive || loading}
          title="Pod Port"
        />
      </div>
      <Button 
        variant={isActive ? 'primary' : 'secondary'}
        icon={isActive ? <Plug size={16} /> : <Unplug size={16} />} 
        onClick={togglePortForward}
        disabled={!podName || loading || !localPort || !podPort}
        isLoading={loading}
      >
        {isActive ? 'Connected' : 'Forward'}
      </Button>
    </div>
  );
}
