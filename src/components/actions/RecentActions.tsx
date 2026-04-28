import React, { useState, useEffect } from 'react';
import { TerminalSquare, Terminal, Plug, Play, Trash2, FileText, ChevronDown, ChevronUp, History } from 'lucide-react';
import { useActionHistory, ActionRecord } from '../../hooks/useActionHistory';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardHeader } from '../ui/Card';

interface RecentActionsProps {
  isContextSelected: boolean;
}

export function RecentActions({ isContextSelected }: RecentActionsProps) {
  const { history, clearHistory, removeAction } = useActionHistory();
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Auto-collapse when context is selected, expand when empty
  useEffect(() => {
    setIsCollapsed(isContextSelected);
  }, [isContextSelected]);

  if (history.length === 0) {
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

  const handleRemove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Voulez-vous vraiment supprimer cette action ?')) {
      removeAction(id);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'Describe': return <FileText size={14} className="text-purple-400" />;
      case 'Logs': return <TerminalSquare size={14} className="text-blue-400" />;
      case 'Shell': return <Terminal size={14} className="text-green-400" />;
      case 'PortForward': return <Plug size={14} className="text-yellow-400" />;
      default: return null;
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card className={`ui-recent-actions ${isCollapsed ? 'collapsed' : ''}`}>
      <CardHeader 
        className="ui-recent-actions-header" 
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          <History size={14} className="text-primary" />
          <span className="ui-action-title">Recent Actions ({history.length})</span>
        </div>
        <button 
          className="ui-recent-actions-clear" 
          onClick={(e) => {
            e.stopPropagation();
            clearHistory();
          }} 
          title="Clear history"
        >
          <Trash2 size={14} />
        </button>
      </CardHeader>
      {!isCollapsed && (
        <CardContent className="ui-recent-actions-list">
          {history.map(action => (
            <div key={action.id} className="ui-recent-action-item" onClick={() => handleReplay(action)}>
              <div className="ui-recent-action-icon">{getIcon(action.type)}</div>
              <div className="ui-recent-action-details">
                <div className="ui-recent-action-pod">{action.podName}</div>
                <div className="ui-recent-action-meta">
                  {action.type} • {formatTime(action.timestamp)}
                  {action.type === 'PortForward' && ` • ${action.localPort}:${action.podPort}`}
                </div>
              </div>
              <div className="ui-recent-action-buttons">
                <button 
                  className="ui-recent-action-delete" 
                  onClick={(e) => handleRemove(e, action.id)}
                  title="Remove action"
                >
                  <Trash2 size={14} />
                </button>
                <button className="ui-recent-action-play">
                  <Play size={14} />
                </button>
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
