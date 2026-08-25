import { useState } from 'react';
import { Pod, useKubePods } from '../../hooks/useKubePods';
import { K8sAuthError } from '../ui/K8sAuthError';
import { ChevronDown, ChevronUp, Box, RefreshCw, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { DescribeButton } from '../actions/DescribeButton';
import { CombinedLogsButton } from '../actions/CombinedLogsButton';
import { ShellButton } from '../actions/ShellButton';
import { RolloutRestartButton } from '../actions/RolloutRestartButton';
import { PortForwardButton } from '../actions/PortForwardButton';
import { PodResourcePanel } from './PodResourcePanel';
import { Activity } from 'lucide-react';
import { Button } from '../ui/Button';
import { useListFilter } from '../../hooks/useListFilter';
import { ListFilterField } from '../ui/ListFilterField';
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

function parseCpu(cpu: string): number {
  if (!cpu || cpu === '?') return 0;
  if (cpu.endsWith('m')) return parseInt(cpu.slice(0, -1), 10);
  return parseFloat(cpu) * 1000;
}

function parseMemory(mem: string): number {
  if (!mem || mem === '?') return 0;
  if (mem.endsWith('Mi')) return parseInt(mem.slice(0, -2), 10);
  if (mem.endsWith('Gi')) return parseFloat(mem.slice(0, -2)) * 1024;
  if (mem.endsWith('Ki')) return parseInt(mem.slice(0, -2), 10) / 1024;
  return parseInt(mem, 10) / (1024 * 1024);
}

export function PodList({ context, namespace, selectedPod, onSelectPod }: PodListProps) {
  const { pods, loading, error, refresh, autoRefresh, setAutoRefresh } = useKubePods(context, namespace);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [expandedResourcesPod, setExpandedResourcesPod] = useState<string | null>(null);
  const { filterText, setFilterText, isFilterVisible, closeFilter, inputRef } = useListFilter();

  const [sortField, setSortField] = useState<'name' | 'cpu' | 'memory'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const activeStatuses = [
    'running', 'pending', 'containercreating', 'terminating', 
    'crashloopbackoff', 'imagepullbackoff', 'error', 'evicted', 
    'errimagepull', 'createcontainererror', 'runcontainererror'
  ];
  
  const filteredPods = pods.filter(pod => {
    if (filterText && !pod.name.toLowerCase().includes(filterText.toLowerCase())) return false;
    
    if (showAll) return true;
    
    // Hide if status is not active
    const status = pod.status.toLowerCase();
    return activeStatuses.some(s => status.includes(s));
  });

  const sortedPods = [...filteredPods].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'name') {
      cmp = a.name.localeCompare(b.name);
    } else if (sortField === 'cpu') {
      cmp = parseCpu(a.metrics?.cpu || '0') - parseCpu(b.metrics?.cpu || '0');
    } else if (sortField === 'memory') {
      cmp = parseMemory(a.metrics?.memory || '0') - parseMemory(b.metrics?.memory || '0');
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const toggleSort = (field: 'name' | 'cpu' | 'memory') => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'cpu' || field === 'memory' ? 'desc' : 'asc');
    }
  };

  if (!context || !namespace) {
    return <div className="ui-empty-state">Select a context and namespace</div>;
  }

  if (error) {
    return (
      <Card className={`ui-pod-list-card`}>
        <CardContent style={{ padding: '24px' }}>
          <K8sAuthError error={error} onRetry={refresh} resourceName="pods" />
        </CardContent>
      </Card>
    );
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
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', flex: 1 }}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          <Box size={14} className="text-primary" />
          <span className="ui-action-title">Pods in {namespace} ({filteredPods.length})</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
          <button 
            className={`ui-header-action-btn ${!showAll ? 'active' : ''}`}
            onClick={() => setShowAll(!showAll)}
            title={showAll ? "Hide inactive pods" : "Show all pods (Jobs, Completed, etc.)"}
          >
            <Box size={14} style={{ display: !showAll ? 'block' : 'none' }} />
            <RefreshCw size={14} style={{ display: !showAll ? 'none' : 'block' }} />
            <span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>{!showAll ? 'FILTERED' : 'SHOWING ALL'}</span>
          </button>
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
        <CardContent style={{ padding: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <ListFilterField 
            visible={isFilterVisible} 
            value={filterText} 
            onChange={setFilterText} 
            onClose={closeFilter} 
            inputRef={inputRef} 
            placeholder="Filter pods..." 
          />
          <div className="ui-pod-list" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="ui-pod-list-header">
              <span onClick={() => toggleSort('name')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Name {sortField === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
              </span>
              <span onClick={() => toggleSort('cpu')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                CPU {sortField === 'cpu' && (sortDir === 'asc' ? '↑' : '↓')}
              </span>
              <span onClick={() => toggleSort('memory')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                MEM {sortField === 'memory' && (sortDir === 'asc' ? '↑' : '↓')}
              </span>
              <span style={{ textAlign: 'right' }}>Age</span>
              <span style={{ textAlign: 'center' }}>Status</span>
            </div>
            <div className="ui-pod-list-content" style={{ flex: 1, overflowY: 'auto' }}>
              {sortedPods.map((pod) => (
                <div key={pod.name} style={{ display: 'flex', flexDirection: 'column' }} className="ui-pod-item-container">
                  <div
                    className={`ui-pod-item ${selectedPod === pod.name ? 'selected' : ''}`}
                    onClick={() => onSelectPod(pod)}
                    style={{ position: 'relative' }}
                  >
                  <div className="ui-pod-name-block">
                    <span className="ui-pod-name" title={pod.name}>{pod.name}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {pod.image && (
                          <span className="ui-pod-image" title={pod.image}>{shortImage(pod.image)}</span>
                        )}
                        <div className="ui-pod-labels">
                          {Object.entries(pod.labels || {})
                            .filter(([key]) => !['pod-template-hash', 'controller-revision-hash', 'statefulset.kubernetes.io/pod-name'].some(ignored => key.includes(ignored)))
                            .slice(0, 2) // Limit to 2 most important labels to save space
                            .map(([key, value]) => (
                              <span key={key} className="ui-pod-label-badge" title={`${key}=${value}`}>
                                {value}
                              </span>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <span className="ui-pod-cpu" style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{pod.metrics?.cpu || '-'}</span>
                  <span className="ui-pod-memory" style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{pod.metrics?.memory || '-'}</span>
                  <span className="ui-pod-age" style={{ textAlign: 'right' }}>{pod.age}</span>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <span className={`ui-pod-status status-${pod.status.toLowerCase()}`}>
                      {pod.status}
                    </span>
                  </div>

                  <div className="pod-actions">
                    <DescribeButton context={context} namespace={namespace} podName={pod.name} iconOnly />
                    <CombinedLogsButton context={context} namespace={namespace} podName={pod.name} labels={pod.labels} iconOnly />
                    <ShellButton context={context} namespace={namespace} podName={pod.name} iconOnly />
                    <RolloutRestartButton context={context} namespace={namespace} podName={pod.name} iconOnly />
                    <PortForwardButton context={context} namespace={namespace} podName={pod.name} podPorts={pod.ports} iconOnly />
                    <Button
                      variant={expandedResourcesPod === pod.name ? "secondary" : "ghost"}
                      icon={<Activity size={14} />}
                      title="Resources"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedResourcesPod(prev => prev === pod.name ? null : pod.name);
                      }}
                      iconOnly={true}
                    />
                  </div>
                </div>

                {expandedResourcesPod === pod.name && (
                  <div style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                  }}>
                    <PodResourcePanel
                      context={context}
                      namespace={namespace}
                      podName={pod.name}
                      containers={pod.containers}
                    />
                  </div>
                )}
              </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
