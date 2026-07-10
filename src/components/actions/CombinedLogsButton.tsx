import { useState, useRef, useEffect } from 'react';
import { TerminalSquare, ChevronDown, Layers, Cloud } from 'lucide-react';
import { Button } from '../ui/Button';
import { invoke } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
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
  const [defaultAction, setDefaultAction] = useState(() => {
    return localStorage.getItem('k8switcher-last-log-action') || 'pod';
  });
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
      key: bestMatch.key,
      selector: `${bestMatch.key}=${bestMatch.value}`,
      value: bestMatch.value
    };
  };

  const appInfo = getAppSelector();

  const executeAction = async (actionId: string) => {
    if (actionId === 'app' && !appInfo) {
      actionId = 'pod';
    }

    setDefaultAction(actionId);
    localStorage.setItem('k8switcher-last-log-action', actionId);
    setIsOpen(false);

    try {
      if (actionId === 'pod') {
        await invoke('open_logs', { context, namespace, podName, terminalApp: settings.terminalApp });
        addAction({ type: 'Logs', context, namespace, podName });
      } else if (actionId === 'app' && appInfo) {
        await invoke('open_logs_by_label', { 
          context, 
          namespace, 
          labelSelector: appInfo.selector,
          terminalApp: settings.terminalApp 
        });
      } else if (actionId === 'gcp') {
        const namespaceQuery = `resource.labels.namespace_name="${namespace}"`;
        let appQuery = '';
        
        if (appInfo) {
          const labelKey = appInfo.key === 'app' ? 'app' : appInfo.key;
          appQuery = `\nlabels."k8s-pod/${labelKey}"="${appInfo.value}"`;
        } else {
          appQuery = `\nresource.labels.pod_name="${podName}"`;
        }

        const query = `${namespaceQuery}${appQuery}`;
        const url = `https://console.cloud.google.com/logs/query;query=${encodeURIComponent(query)};timeRange=PT1H`;
        
        await openUrl(url);
      }
    } catch (error) {
      console.error(`Failed to execute log action ${actionId}`, error);
    }
  };

  const getDefaultIcon = () => {
    const action = (defaultAction === 'app' && !appInfo) ? 'pod' : defaultAction;
    if (action === 'app') return <Layers size={14} />;
    if (action === 'gcp') return <Cloud size={14} />;
    return <TerminalSquare size={14} />;
  };

  const getDefaultLabel = () => {
    const action = (defaultAction === 'app' && !appInfo) ? 'pod' : defaultAction;
    if (action === 'app') return 'Tag';
    if (action === 'gcp') return 'GCP';
    return 'Log';
  };

  return (
    <div className="ui-dropdown-container" ref={dropdownRef} style={{ position: 'relative', display: 'flex', flex: 1 }}>
      <div style={{ display: 'flex', width: '100%', height: '100%' }}>
        <Button 
          variant="secondary" 
          onClick={(e) => { e.stopPropagation(); executeAction(defaultAction); }}
          disabled={!podName}
          icon={getDefaultIcon()}
          style={{ 
            flex: 3, 
            minWidth: 0,
            borderTopRightRadius: 0, 
            borderBottomRightRadius: 0, 
            borderRight: '1px solid rgba(0,0,0,0.3)',
            paddingLeft: '8px',
            paddingRight: '8px'
          }}
        >
          {getDefaultLabel()}
        </Button>
        <Button 
          variant="secondary" 
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          disabled={!podName}
          style={{ 
            flex: 1,
            minWidth: 0,
            borderTopLeftRadius: 0, 
            borderBottomLeftRadius: 0, 
            paddingLeft: '6px',
            paddingRight: '6px'
          }}
        >
          <ChevronDown size={14} />
        </Button>
      </div>
      
      {isOpen && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          right: 0,
          marginBottom: '4px',
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
            onClick={(e) => { e.stopPropagation(); executeAction('pod'); }}
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
              onClick={(e) => { e.stopPropagation(); executeAction('app'); }}
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

          <div style={{ height: '1px', backgroundColor: '#313244', margin: '2px 0' }}></div>
          
          <button 
            onClick={(e) => { e.stopPropagation(); executeAction('gcp'); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '6px 10px', width: '100%', textAlign: 'left',
              borderRadius: '4px', border: 'none', background: 'transparent',
              color: '#cdd6f4', cursor: 'pointer', fontSize: '0.8rem'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Cloud size={14} /> GCP Logs
          </button>
        </div>
      )}
    </div>
  );
}
