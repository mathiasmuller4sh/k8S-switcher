import { useState } from 'react';
import { useKubePvcs } from '../../hooks/useKubePvcs';
import { K8sAuthError } from '../ui/K8sAuthError';
import { ChevronDown, ChevronUp, Database, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';

interface PvcListProps {
  context: string;
  namespace: string;
}

export function PvcList({ context, namespace }: PvcListProps) {
  const { pvcs, loading, error, refresh } = useKubePvcs(context, namespace);
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!context || !namespace) {
    return <div className="ui-empty-state">Select a context and namespace</div>;
  }

  if (error) {
    return (
      <Card className={`ui-pod-list-card`}>
        <CardContent style={{ padding: '24px' }}>
          <K8sAuthError error={error} onRetry={refresh} resourceName="PVCs" />
        </CardContent>
      </Card>
    );
  }

  if (loading && pvcs.length === 0) {
    return <div className="ui-empty-state">Loading PVCs...</div>;
  }

  if (pvcs.length === 0) {
    return <div className="ui-empty-state">No PVCs found in this namespace.</div>;
  }

  return (
    <Card className={`ui-pvc-list-card ${isCollapsed ? 'collapsed' : ''}`}>
      <CardHeader 
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', flex: 1 }}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          <Database size={14} className="text-primary" />
          <span className="ui-action-title">PVCs in {namespace} ({pvcs.length})</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
          <button 
            className={`ui-header-action-btn ${loading ? 'spinning' : ''}`}
            onClick={refresh}
            title="Refresh PVCs"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </CardHeader>
      
      {!isCollapsed && (
        <CardContent style={{ padding: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="ui-pvc-list" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="ui-pvc-list-header">
              <span>Name</span>
              <span style={{ textAlign: 'center' }}>Size</span>
              <span style={{ textAlign: 'center' }}>Status</span>
              <span style={{ textAlign: 'right' }}>Storage Class</span>
            </div>
            <div className="ui-pvc-list-content" style={{ flex: 1, overflowY: 'auto' }}>
              {pvcs.map((pvc) => (
                <div key={pvc.name} className="ui-pvc-item">
                  <div className="ui-pvc-name-block">
                    <span className="ui-pvc-name" title={pvc.name}>{pvc.name}</span>
                    <div className="ui-pvc-meta">
                      {(pvc.accessModes || []).join(', ')} • {pvc.age}
                    </div>
                  </div>
                  <span className="ui-pvc-capacity" style={{ textAlign: 'center' }}>{pvc.capacity}</span>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <span className={`ui-pvc-status status-${pvc.status.toLowerCase()}`}>
                      {pvc.status}
                    </span>
                  </div>
                  <span className="ui-pvc-storage-class" style={{ textAlign: 'right' }}>
                    {pvc.storageClass}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
