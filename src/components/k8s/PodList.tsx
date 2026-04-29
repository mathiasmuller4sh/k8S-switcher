import { useState } from 'react';
import { Pod, useKubePods } from '../../hooks/useKubePods';
import { ChevronDown, ChevronUp, Box, RefreshCw, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';

interface PodListProps {
  context: string;
  namespace: string;
  selectedPod: string;
  onSelectPod: (pod: Pod) => void;
}

function shortImage(image: string): string {
  // Keep only the part after the last slash, and truncate tag at 12 chars
  const name = image.split('/').pop() || image;
  const [repo, tag] = name.split(':');
  if (!tag) return repo;
  return `${repo}:${tag.slice(0, 12)}${tag.length > 12 ? '…' : ''}`;
}

export function PodList({ context, namespace, selectedPod, onSelectPod }: PodListProps) {
  const { pods, loading, refresh, autoRefresh, setAutoRefresh } = useKubePods(context, namespace);
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!context || !namespace) {
    return <div className="ui-empty-state">Select a context and namespace</div>;
  }

  if (loading) {
    return <div className="ui-empty-state">Loading pods...</div>;
  }

  if (pods.length === 0) {
    return <div className="ui-empty-state">No pods found in this namespace.</div>;
  }

  return (
    <Card className={`ui-pod-list-card ${isCollapsed ? 'collapsed' : ''}`}>
      <CardHeader 
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          <Box size={14} className="text-primary" />
          <span className="ui-action-title">Pods in {namespace} ({pods.length})</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
          <button 
            className={`ui-header-action-btn ${loading ? 'spinning' : ''}`}
            onClick={refresh}
            title="Refresh pods"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
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
        <CardContent style={{ padding: 0 }}>
          <div className="ui-pod-list">
            <div className="ui-pod-list-header">
              <span>Name</span>
              <span style={{ textAlign: 'right' }}>Age</span>
              <span style={{ textAlign: 'center' }}>Status</span>
            </div>
            <div className="ui-pod-list-content" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {pods.map((pod) => (
                <div
                  key={pod.name}
                  className={`ui-pod-item ${selectedPod === pod.name ? 'selected' : ''}`}
                  onClick={() => onSelectPod(pod)}
                >
                  <div className="ui-pod-name-block">
                    <span className="ui-pod-name" title={pod.name}>{pod.name}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {pod.image && (
                        <span className="ui-pod-image" title={pod.image}>{shortImage(pod.image)}</span>
                      )}
                      <div className="ui-pod-labels">
                        {Object.entries(pod.labels || {})
                          .filter(([key]) => !['pod-template-hash', 'controller-revision-hash', 'statefulset.kubernetes.io/pod-name'].some(ignored => key.includes(ignored)))
                          .slice(0, 3) // Limit to 3 most important labels
                          .map(([key, value]) => (
                            <span key={key} className="ui-pod-label-badge" title={`${key}=${value}`}>
                              {value}
                            </span>
                          ))}
                      </div>
                    </div>
                  </div>
                  <span className="ui-pod-age" style={{ textAlign: 'right' }}>{pod.age}</span>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <span className={`ui-pod-status status-${pod.status.toLowerCase()}`}>
                      {pod.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
