import { useState } from 'react';
import { useKubeEvents } from '../../hooks/useKubeEvents';
import { K8sAuthError } from '../ui/K8sAuthError';
import { ChevronDown, ChevronUp, Activity, RefreshCw, Zap, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { invoke } from '@tauri-apps/api/core';

interface EventListProps {
  context: string;
  namespace: string;
}

export function EventList({ context, namespace }: EventListProps) {
  const { events, loading, error, refresh, autoRefresh, setAutoRefresh } = useKubeEvents(context, namespace);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleClear = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setClearing(true);
    try {
      await invoke('clear_events', { context, namespace });
      refresh();
    } catch (err) {
      console.error('Failed to clear events', err);
    } finally {
      setClearing(false);
    }
  };

  if (!context || !namespace) {
    return <div className="ui-empty-state">Select a context and namespace</div>;
  }

  if (error) {
    return (
      <Card className={`ui-pod-list-card`}>
        <CardContent style={{ padding: '24px' }}>
          <K8sAuthError error={error} onRetry={refresh} resourceName="Events" />
        </CardContent>
      </Card>
    );
  }

  if (loading && events.length === 0) {
    return <div className="ui-empty-state">Loading Events...</div>;
  }

  if (events.length === 0) {
    return <div className="ui-empty-state">No Events found in this namespace.</div>;
  }

  return (
    <Card className={`ui-event-list-card ${isCollapsed ? 'collapsed' : ''}`}>
      <CardHeader 
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', flex: 1 }}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          <Activity size={14} className="text-primary" />
          <span className="ui-action-title">Events in {namespace} ({events.length})</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
          <button 
            className={`ui-header-action-btn ${clearing ? 'spinning' : ''}`}
            onClick={handleClear}
            title="Clear Events"
            disabled={clearing}
          >
            <Trash2 size={14} className={clearing ? 'animate-spin' : ''} />
            <span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>CLEAR</span>
          </button>
          <button 
            className={`ui-header-action-btn ${loading && !clearing ? 'spinning' : ''}`}
            onClick={refresh}
            title="Refresh Events"
          >
            <RefreshCw size={14} className={loading && !clearing ? 'animate-spin' : ''} />
          </button>
          <button 
            className={`ui-header-action-btn ${autoRefresh ? 'active' : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? "Disable Live Reload" : "Enable Live Reload"}
          >
            <Zap size={14} fill={autoRefresh ? "currentColor" : "none"} />
            <span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>LIVE</span>
          </button>
        </div>
      </CardHeader>
      
      {!isCollapsed && (
        <CardContent style={{ padding: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="ui-event-list" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="ui-event-list-header">
              <span style={{ textAlign: 'center' }}>Type</span>
              <span>Reason</span>
              <span>Object</span>
              <span>Message</span>
              <span style={{ textAlign: 'right' }}>Age</span>
            </div>
            <div className="ui-event-list-content" style={{ flex: 1, overflowY: 'auto' }}>
              {events.map((event, i) => (
                <div key={i} className="ui-event-item">
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <span className={`ui-event-type type-${event.eventType.toLowerCase()}`}>
                      {event.eventType}
                    </span>
                  </div>
                  <span className="ui-event-reason" title={event.reason}>{event.reason}</span>
                  <span className="ui-event-object" title={event.object}>{event.object}</span>
                  <span className="ui-event-message" title={event.message}>{event.message}</span>
                  <span className="ui-event-age" style={{ textAlign: 'right' }}>{event.age}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
