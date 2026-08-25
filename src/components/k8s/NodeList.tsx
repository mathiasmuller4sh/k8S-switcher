import { useState } from 'react';
import { useKubeNodes } from '../../hooks/useKubeNodes';
import { RefreshCw, Server, ChevronDown, ChevronRight, Box, Filter } from 'lucide-react';
import { ListFilterField } from '../ui/ListFilterField';
import { useListFilter } from '../../hooks/useListFilter';

interface NodeListProps {
  context: string;
}

function parseCpu(cpu: string): number {
  if (!cpu || cpu === '-' || cpu === '?') return 0;
  // If format is like "123m (4%)"
  const parts = cpu.split(' ');
  const val = parts[0];
  if (val.endsWith('m')) return parseInt(val.slice(0, -1), 10);
  return parseFloat(val) * 1000;
}

function parseMemory(mem: string): number {
  if (!mem || mem === '-' || mem === '?') return 0;
  const parts = mem.split(' ');
  const val = parts[0];
  if (val.endsWith('Mi')) return parseInt(val.slice(0, -2), 10);
  if (val.endsWith('Gi')) return parseFloat(val.slice(0, -2)) * 1024;
  if (val.endsWith('Ki')) return parseInt(val.slice(0, -2), 10) / 1024;
  return parseInt(val, 10) / (1024 * 1024);
}

export function NodeList({ context }: NodeListProps) {
  const { nodes, loading, error, refresh } = useKubeNodes(context);
  const { filterText, setFilterText, isFilterVisible, closeFilter, inputRef } = useListFilter();

  const [sortField, setSortField] = useState<'name' | 'cpu' | 'memory' | 'pods'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const [hideSystemPods, setHideSystemPods] = useState(true);

  const SYSTEM_NAMESPACES = ['kube-system', 'kube-public', 'kube-node-lease'];

  const processedNodes = nodes.map(node => {
    let visiblePods = node.pods;
    if (hideSystemPods) {
      visiblePods = visiblePods.filter(p => !SYSTEM_NAMESPACES.includes(p.namespace));
    }
    
    let matchesFilter = true;
    if (filterText) {
      const lowerFilter = filterText.toLowerCase();
      const nameMatch = node.name.toLowerCase().includes(lowerFilter);
      const matchingPods = visiblePods.filter(p => 
        p.name.toLowerCase().includes(lowerFilter) || 
        p.namespace.toLowerCase().includes(lowerFilter)
      );
      
      if (nameMatch) {
        matchesFilter = true;
      } else if (matchingPods.length > 0) {
        matchesFilter = true;
        visiblePods = matchingPods;
      } else {
        matchesFilter = false;
      }
    }
    
    return {
      ...node,
      visiblePods,
      displayPodsCount: visiblePods.length,
      matchesFilter
    };
  }).filter(n => n.matchesFilter);

  const sortedNodes = [...processedNodes].sort((a, b) => {
    let cmp = 0;
    if (sortField === 'name') {
      cmp = a.name.localeCompare(b.name);
    } else if (sortField === 'cpu') {
      cmp = parseCpu(a.cpu) - parseCpu(b.cpu);
    } else if (sortField === 'memory') {
      cmp = parseMemory(a.memory) - parseMemory(b.memory);
    } else if (sortField === 'pods') {
      cmp = a.displayPodsCount - b.displayPodsCount;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const toggleSort = (field: 'name' | 'cpu' | 'memory' | 'pods') => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'name' ? 'asc' : 'desc');
    }
  };

  if (!context) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Server size={20} />
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>Nodes ({context})</h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={() => setHideSystemPods(!hideSystemPods)}
            className="ui-action-btn"
            title={hideSystemPods ? "Show System Pods" : "Hide System Pods"}
            style={{ 
              background: hideSystemPods ? 'var(--primary)' : 'rgba(255, 255, 255, 0.1)', 
              border: 'none', 
              color: 'white', 
              padding: '6px 12px', 
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Filter size={14} />
            {hideSystemPods ? "System Pods Hidden" : "System Pods Shown"}
          </button>
          
          <button 
            onClick={refresh}
            disabled={loading}
            className="ui-action-btn"
            title="Refresh Nodes"
            style={{ 
              background: 'rgba(255, 255, 255, 0.1)', 
              border: 'none', 
              color: 'white', 
              padding: '6px 12px', 
              borderRadius: '6px',
              cursor: loading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div style={{ padding: '0', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', position: 'relative' }}>
        <ListFilterField 
          visible={isFilterVisible} 
          value={filterText} 
          onChange={setFilterText} 
          onClose={closeFilter} 
          inputRef={inputRef} 
          placeholder="Filter nodes..." 
        />
        
        {loading && nodes.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
            <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : error ? (
          <div style={{ padding: '24px', color: '#ffb3b3', textAlign: 'center' }}>
            <p>Error loading nodes:</p>
            <pre style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '4px', marginTop: '12px', overflowX: 'auto', textAlign: 'left' }}>{error}</pre>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '24px 1fr 70px 70px 80px 100px 120px', 
              gap: '16px', 
              alignItems: 'center', 
              padding: '12px 16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              fontWeight: 600,
              fontSize: '0.85rem',
              color: 'var(--text-muted)'
            }}>
              <div></div> {/* For chevron */}
              <span onClick={() => toggleSort('name')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Name {sortField === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
              </span>
              <span onClick={() => toggleSort('cpu')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                CPU {sortField === 'cpu' && (sortDir === 'asc' ? '↑' : '↓')}
              </span>
              <span onClick={() => toggleSort('memory')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                MEM {sortField === 'memory' && (sortDir === 'asc' ? '↑' : '↓')}
              </span>
              <span onClick={() => toggleSort('pods')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                Pods {sortField === 'pods' && (sortDir === 'asc' ? '↑' : '↓')}
              </span>
              <span style={{ textAlign: 'center' }}>Version</span>
              <span style={{ textAlign: 'right' }}>Status</span>
            </div>
            
            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
              {sortedNodes.map((node) => (
                <div key={node.name} style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                  <div 
                    style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '24px 1fr 70px 70px 80px 100px 120px', 
                      gap: '16px', 
                      alignItems: 'center', 
                      padding: '12px 16px',
                      cursor: 'pointer'
                    }}
                    className="ui-pod-item"
                    onClick={() => setExpandedNode(expandedNode === node.name ? null : node.name)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      {expandedNode === node.name ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={node.name}>
                        {node.name}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{node.age}</span>
                    </div>
                    
                    <span style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{node.cpu}</span>
                    <span style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{node.memory}</span>
                    <span style={{ textAlign: 'center', fontSize: '0.9rem', fontWeight: 600 }}>{node.displayPodsCount}</span>
                    <span style={{ textAlign: 'center', fontSize: '0.85rem' }}>{node.version}</span>
                    
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <span className={`ui-pod-status status-${node.status.split(',')[0].toLowerCase()}`}>
                        {node.status}
                      </span>
                    </div>
                  </div>
                  
                  {expandedNode === node.name && (
                    <div style={{ padding: '0 0 16px 56px', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                        {node.visiblePods.map((pod, idx) => (
                          <div key={idx} style={{ 
                            display: 'grid', 
                            gridTemplateColumns: '16px 200px 1fr 100px 100px', 
                            gap: '12px', 
                            alignItems: 'center', 
                            fontSize: '0.85rem' 
                          }}>
                            <Box size={14} style={{ color: 'var(--text-muted)' }} />
                            <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={pod.namespace}>{pod.namespace}</span>
                            <span style={{ color: 'var(--text-main)', opacity: 0.9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={pod.name}>{pod.name}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{pod.cpu !== '-' ? `CPU: ${pod.cpu}` : ''}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{pod.memory !== '-' ? `MEM: ${pod.memory}` : ''}</span>
                          </div>
                        ))}
                        {node.visiblePods.length === 0 && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>No pods found on this node.</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {sortedNodes.length === 0 && !loading && (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No nodes found.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
