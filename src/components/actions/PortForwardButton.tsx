import { useState, useRef, useEffect } from 'react';
import { Plug } from 'lucide-react';
import { Button } from '../ui/Button';
import { invoke } from '@tauri-apps/api/core';
import { useSettings } from '../../hooks/useSettings';
import { useActionHistory } from '../../hooks/useActionHistory';
import { useTerminal } from '../../hooks/useTerminal';

interface PortForwardButtonProps {
  context: string;
  namespace: string;
  podName: string;
  podPorts: number[];
  iconOnly?: boolean;
}

export function PortForwardButton({ context, namespace, podName, podPorts, iconOnly = false }: PortForwardButtonProps) {
  const getDefaultPort = (ports: number[]) => {
    if (ports.length === 0) return '8080';
    const preferredPorts = [8080, 80, 3000, 4200, 5000, 8000, 9000, 443];
    for (const pref of preferredPorts) {
      if (ports.includes(pref)) return String(pref);
    }
    return String(ports[0]);
  };

  const initialPort = getDefaultPort(podPorts);
  const [localPort, setLocalPort] = useState(initialPort);
  const [podPort, setPodPort] = useState(initialPort);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { settings } = useSettings();
  const { addAction } = useActionHistory();
  const { openTerminal } = useTerminal();
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset ports when pod changes
  useEffect(() => {
    const p = getDefaultPort(podPorts);
    setLocalPort(p);
    setPodPort(p);
  }, [podName, podPorts]);

  const startPortForward = async () => {
    if (!localPort || !podPort) return;
    
    const lp = parseInt(localPort, 10);
    const pp = parseInt(podPort, 10);
    
    if (settings.terminalApp === 'Interne') {
      openTerminal(`PF: ${localPort}:${podPort} (${podName})`, "kubectl", [
        "--context", context,
        "-n", namespace,
        "port-forward", `pod/${podName}`,
        `${lp}:${pp}`
      ]);
    } else {
      await invoke('start_port_forward', { 
        context, 
        namespace, 
        podName, 
        localPort: lp, 
        podPort: pp,
        terminalApp: settings.terminalApp
      });
    }
    
    addAction({ type: 'PortForward', context, namespace, podName, localPort: lp, podPort: pp });
    if (iconOnly) {
      setIsOpen(false);
    }
  };

  if (iconOnly) {
    return (
      <div style={{ position: 'relative' }} ref={dropdownRef}>
        <Button 
          variant="ghost"
          icon={<Plug size={14} />} 
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          disabled={!podName}
          title="Port Forward"
          iconOnly={true}
        />
        
        {isOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '4px',
            backgroundColor: '#1e1e2e',
            border: '1px solid #313244',
            borderRadius: '6px',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 50,
            minWidth: '200px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ fontSize: '0.75rem', color: '#a6adc8', fontWeight: 600 }}>Port Forward</div>
            <div className="ui-port-inputs" style={{ marginBottom: 0 }}>
              <input 
                type="number" 
                className="ui-port-input" 
                value={localPort}
                onChange={e => setLocalPort(e.target.value)}
                placeholder="Local"
                title="Local Port"
              />
              <span className="ui-port-separator">:</span>
              <input 
                type="number" 
                className="ui-port-input" 
                value={podPort}
                onChange={e => setPodPort(e.target.value)}
                placeholder="Pod"
                title="Pod Port"
              />
            </div>
            <Button 
              variant="secondary"
              icon={<Plug size={14} />} 
              onClick={(e) => { e.stopPropagation(); startPortForward(); }}
              disabled={!podName || !localPort || !podPort}
            >
              Start Forward
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="ui-port-forward-wrapper">
      <div className="ui-port-inputs">
        <input 
          type="number" 
          className="ui-port-input" 
          value={localPort}
          onChange={e => setLocalPort(e.target.value)}
          placeholder="Local"
          title="Local Port"
        />
        <span className="ui-port-separator">:</span>
        <input 
          type="number" 
          className="ui-port-input" 
          value={podPort}
          onChange={e => setPodPort(e.target.value)}
          placeholder="Pod"
          title="Pod Port"
        />
      </div>
      <Button 
        variant="secondary"
        icon={<Plug size={14} />} 
        onClick={startPortForward}
        disabled={!podName || !localPort || !podPort}
      >
        Forward
      </Button>
    </div>
  );
}
