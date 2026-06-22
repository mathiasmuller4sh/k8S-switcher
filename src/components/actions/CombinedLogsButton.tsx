import { useState, useRef, useEffect } from 'react';
import { TerminalSquare, ChevronDown, Layers } from 'lucide-react';
import { Button } from '../ui/Button';
import { invoke } from '@tauri-apps/api/core';
import { useSettings } from '../../hooks/useSettings';
import { useActionHistory } from '../../hooks/useActionHistory';

interface CombinedLogsButtonProps {
  context: string;
  namespace: string;
  podName: string;
  labels: Record<string, string>;
}

export function CombinedLogsButton({ context, namespace, podName, labels }: CombinedLogsButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { addAction } = useActionHistory();
  const { settings } = useSettings();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpenPodLogs = async () => {
    setIsOpen(false);
    try {
      await invoke('open_logs', { context, namespace, podName, terminalApp: settings.terminalApp });
      addAction({ type: 'Logs', context, namespace, podName });
    } catch (error) {
      console.error('Failed to open logs', error);
    }
  };

  const getAppSelector = () => {
    const ignoredKeys = [
      'pod-template-hash', 
      'controller-revision-hash', 
      'statefulset.kubernetes.io/pod-name',
      'heritage',
      'release',
      'chart'
    ];
    
    const candidates = Object.entries(labels)
      .filter(([key]) => !ignoredKeys.some(ignored => key.toLowerCase().includes(ignored)))
      .map(([key, value]) => ({ key, value }));

    if (candidates.length === 0) return null;

    const bestMatch = candidates.reduce((prev, curr) => {
      if (curr.value.length < prev.value.length) return curr;
      if (curr.value.length === prev.value.length) {
        const priorityKeys = ['app', 'name', 'component'];
        if (priorityKeys.includes(curr.key) && !priorityKeys.includes(prev.key)) return curr;
      }
      return prev;
    });

    return {
      selector: `${bestMatch.key}=${bestMatch.value}`,
      value: bestMatch.value
    };
  };

  const appInfo = getAppSelector();

  const handleOpenAppLogs = async () => {
    setIsOpen(false);
    if (!appInfo) return;
    try {
      await invoke('open_logs_by_label', { 
        context, 
        namespace, 
        labelSelector: appInfo.selector,
        terminalApp: settings.terminalApp 
      });
    } catch (error) {
      console.error('Failed to open app logs', error);
    }
  };

  return (
    <div className="ui-dropdown-container" ref={dropdownRef} style={{ position: 'relative', display: 'flex', flex: 1 }}>
      <Button 
        variant="secondary" 
        onClick={() => setIsOpen(!isOpen)}
        disabled={!podName}
        icon={<TerminalSquare size={16} />}
        style={{ width: '100%', height: '100%' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          <span>Logs</span>
          <ChevronDown size={14} />
        </div>
      </Button>
      
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: '4px',
          backgroundColor: '#1e1e2e',
          border: '1px solid #313244',
          borderRadius: '6px',
          padding: '4px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          zIndex: 50,
          minWidth: '150px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)'
        }}>
          <button 
            onClick={handleOpenPodLogs}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '6px 10px', width: '100%', textAlign: 'left',
              borderRadius: '4px', border: 'none', background: 'transparent',
              color: '#cdd6f4', cursor: 'pointer', fontSize: '0.8rem'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <TerminalSquare size={14} /> Pod Logs
          </button>
          
          {appInfo && (
            <button 
              onClick={handleOpenAppLogs}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 10px', width: '100%', textAlign: 'left',
                borderRadius: '4px', border: 'none', background: 'transparent',
                color: '#cdd6f4', cursor: 'pointer', fontSize: '0.8rem'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Layers size={14} /> Tag ({appInfo.value})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
