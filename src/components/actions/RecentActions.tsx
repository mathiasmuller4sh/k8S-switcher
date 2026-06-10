import React from 'react';
import { TerminalSquare, Terminal, Plug, Trash2, FileText, History } from 'lucide-react';
import { useActionHistory, ActionRecord } from '../../hooks/useActionHistory';
import { invoke } from '@tauri-apps/api/core';
import { ask } from '@tauri-apps/plugin-dialog';

interface RecentActionsProps {
  isContextSelected: boolean;
  namespace?: string;
}

export function RecentActions({ namespace }: RecentActionsProps) {
  const { getTopActions, clearHistory, removeAction } = useActionHistory();

  const topActions = getTopActions(namespace);

  if (topActions.length === 0) {
    return null;
  }

  const handleReplay = async (action: ActionRecord) => {
    try {
      if (action.type === 'Describe') {
        await invoke('open_describe', { context: action.context, namespace: action.namespace, podName: action.podName });
      } else if (action.type === 'Logs') {
        await invoke('open_logs', { context: action.context, namespace: action.namespace, podName: action.podName });
      } else if (action.type === 'Shell') {
        await invoke('open_shell', { context: action.context, namespace: action.namespace, podName: action.podName });
      } else if (action.type === 'PortForward') {
        await invoke('start_port_forward', { 
          context: action.context, 
          namespace: action.namespace, 
          podName: action.podName, 
          localPort: action.localPort || 8080, 
          podPort: action.podPort || 8080 
        });
      }
    } catch (e) {
      console.error('Failed to replay action', e);
    }
  };

  const handleRemove = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const confirmed = await ask('Voulez-vous vraiment supprimer cette action ?', {
      title: 'K8s Switcher',
      kind: 'warning',
    });
    
    if (confirmed) {
      removeAction(id);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'Describe': return <FileText size={12} className="text-purple-400" />;
      case 'Logs': return <TerminalSquare size={12} className="text-blue-400" />;
      case 'Shell': return <Terminal size={12} className="text-green-400" />;
      case 'PortForward': return <Plug size={12} className="text-yellow-400" />;
      default: return null;
    }
  };

  return (
    <div className="ui-top-actions-container">
      <div className="ui-top-actions-header">
        <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)' }}>
          <History size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
          Top Actions
        </span>
        <button 
          onClick={clearHistory}
          title="Clear history"
          style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
        >
          <Trash2 size={12} />
        </button>
      </div>
      <div className="ui-top-actions-list">
        {topActions.map(action => (
          <div key={action.id} className="ui-top-action-pill" onClick={() => handleReplay(action)}>
            {getIcon(action.type)}
            <span className="ui-top-action-text" title={`${action.type} on ${action.podName}`}>
              {action.type} {action.type === 'PortForward' && `${action.localPort}:${action.podPort}`}
            </span>
            <div className="ui-top-action-count" title={`Used ${action.count || 1} times`}>
              {action.count || 1}
            </div>
            <button 
              className="ui-top-action-remove" 
              onClick={(e) => handleRemove(e, action.id)}
              title="Remove"
            >
              <Trash2 size={10} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
