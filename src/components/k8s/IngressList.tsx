import { useState } from 'react';
import { useKubeIngresses } from '../../hooks/useKubeIngresses';
import { K8sAuthError } from '../ui/K8sAuthError';
import { ChevronDown, ChevronUp, Globe, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';

interface IngressListProps {
  context: string;
  namespace: string;
}

export function IngressList({ context, namespace }: IngressListProps) {
  const { ingresses, loading, error, refresh } = useKubeIngresses(context, namespace);
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!context || !namespace) {
    return <div className="ui-empty-state">Select a context and namespace</div>;
  }

  if (error) {
    return (
      <Card className={`ui-pod-list-card`}>
        <CardContent style={{ padding: '24px' }}>
          <K8sAuthError error={error} onRetry={refresh} resourceName="Ingresses" />
        </CardContent>
      </Card>
    );
  }

  if (loading && ingresses.length === 0) {
    return <div className="ui-empty-state">Loading Ingresses...</div>;
  }

  if (ingresses.length === 0) {
    return <div className="ui-empty-state">No Ingresses found in this namespace.</div>;
  }

  return (
    <Card className={`ui-ingress-list-card ${isCollapsed ? 'collapsed' : ''}`}>
      <CardHeader 
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', flex: 1 }}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          <Globe size={14} className="text-primary" />
          <span className="ui-action-title">Ingresses in {namespace} ({ingresses.length})</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
          <button 
            className={`ui-header-action-btn ${loading ? 'spinning' : ''}`}
            onClick={refresh}
            title="Refresh Ingresses"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </CardHeader>
      
      {!isCollapsed && (
        <CardContent style={{ padding: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="ui-ingress-list" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="ui-ingress-list-header">
              <span>Name</span>
              <span>Hosts</span>
              <span>Address</span>
              <span style={{ textAlign: 'center' }}>Ports</span>
              <span style={{ textAlign: 'right' }}>Age</span>
            </div>
            <div className="ui-ingress-list-content" style={{ flex: 1, overflowY: 'auto' }}>
              {ingresses.map((ingress) => (
                <div key={ingress.name} className="ui-ingress-item">
                  <span className="ui-ingress-name" title={ingress.name}>{ingress.name}</span>
                  <span className="ui-ingress-hosts" title={ingress.hosts}>{ingress.hosts}</span>
                  <span className="ui-ingress-address" title={ingress.address}>{ingress.address || '-'}</span>
                  <span className="ui-ingress-ports" style={{ textAlign: 'center' }}>{ingress.ports}</span>
                  <span className="ui-ingress-age" style={{ textAlign: 'right' }}>{ingress.age}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
