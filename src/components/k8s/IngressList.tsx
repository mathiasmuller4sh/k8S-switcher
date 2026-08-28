import { useState } from 'react';
import { useKubeIngresses } from '../../hooks/useKubeIngresses';
import { K8sAuthError } from '../ui/K8sAuthError';
import { ChevronDown, ChevronUp, Globe, RefreshCw, ExternalLink, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { useListFilter } from '../../hooks/useListFilter';
import { ListFilterField } from '../ui/ListFilterField';
import { openUrl } from '@tauri-apps/plugin-opener';

interface IngressListProps {
  context: string;
  namespace: string;
}

export function IngressList({ context, namespace }: IngressListProps) {
  const { ingresses, loading, error, refresh } = useKubeIngresses(context, namespace);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { filterText, setFilterText, isFilterVisible, closeFilter, inputRef } = useListFilter();
  const [copiedHost, setCopiedHost] = useState<string | null>(null);

  if (!context || !namespace) {
    return <div className="ui-empty-state">Select a context and namespace</div>;
  }

  if (error) {
    return (
      <Card className={`ui-pod-list-card`}>
        <CardContent style={{ padding: '24px' }}>
          <K8sAuthError error={error} onRetry={refresh} resourceName="Ingresses & Istio" />
        </CardContent>
      </Card>
    );
  }

  if (loading && ingresses.length === 0) {
    return <div className="ui-empty-state">Loading Ingresses & Istio VirtualServices...</div>;
  }

  if (ingresses.length === 0) {
    return <div className="ui-empty-state">No Ingresses or Istio VirtualServices found in this namespace.</div>;
  }

  const handleOpenUrl = async (host: string, path?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (host === '*' || !host) return;
    try {
      const cleanHost = host.trim();
      let url = cleanHost.startsWith('http://') || cleanHost.startsWith('https://') 
        ? cleanHost 
        : `https://${cleanHost}`;
      
      if (path) {
        const cleanPath = path.trim();
        if (cleanPath.startsWith('/')) {
          url += cleanPath;
        }
      }
      await openUrl(url);
    } catch (err) {
      console.error('Failed to open URL', err);
    }
  };

  const handleCopy = (host: string, path?: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (host === '*' || !host) return;
    const cleanHost = host.trim();
    let url = cleanHost.startsWith('http://') || cleanHost.startsWith('https://') 
      ? cleanHost 
      : `https://${cleanHost}`;
    if (path) {
      const cleanPath = path.trim();
      if (cleanPath.startsWith('/')) {
        url += cleanPath;
      }
    }
    navigator.clipboard.writeText(url);
    setCopiedHost(url);
    setTimeout(() => setCopiedHost(null), 2000);
  };

  const getBadgeClass = (resourceType: string) => {
    if (resourceType === 'VirtualService') return 'badge-istio';
    if (resourceType === 'HTTPRoute') return 'badge-httproute';
    return 'badge-ingress';
  };

  const getBadgeLabel = (resourceType: string) => {
    if (resourceType === 'VirtualService') return 'Istio';
    if (resourceType === 'HTTPRoute') return 'HTTPRoute';
    return 'Ingress';
  };

  const filteredIngresses = ingresses.filter(i => {
    if (!filterText) return true;
    const q = filterText.toLowerCase();
    return (
      i.name.toLowerCase().includes(q) ||
      i.hosts.toLowerCase().includes(q) ||
      (i.resourceType && i.resourceType.toLowerCase().includes(q)) ||
      (i.address && i.address.toLowerCase().includes(q)) ||
      (i.paths && i.paths.toLowerCase().includes(q)) ||
      (i.gateways && i.gateways.toLowerCase().includes(q))
    );
  });

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
          <span className="ui-action-title">Ingresses & Istio in {namespace} ({ingresses.length})</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
          <button 
            className={`ui-header-action-btn ${loading ? 'spinning' : ''}`}
            onClick={refresh}
            title="Refresh Ingresses & Istio"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
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
            placeholder="Filter Ingresses & Istio URLs..." 
          />
          <div className="ui-ingress-list" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="ui-ingress-list-header">
              <span>Name</span>
              <span>Hosts / URLs</span>
              <span>Gateway / Address</span>
              <span style={{ textAlign: 'center' }}>Ports</span>
              <span style={{ textAlign: 'right' }}>Age</span>
            </div>
            <div className="ui-ingress-list-content" style={{ flex: 1, overflowY: 'auto' }}>
              {filteredIngresses.map((ingress) => {
                const hostList = ingress.hosts.split(',').map(h => h.trim()).filter(Boolean);
                const primaryPath = ingress.paths ? ingress.paths.split(',')[0].trim() : undefined;

                return (
                  <div key={`${ingress.resourceType}-${ingress.name}`} className="ui-ingress-item">
                    <div className="ui-ingress-name-col">
                      <span className={`ui-ingress-badge ${getBadgeClass(ingress.resourceType)}`} title={ingress.resourceType}>
                        {getBadgeLabel(ingress.resourceType)}
                      </span>
                      <span className="ui-ingress-name" title={ingress.name}>{ingress.name}</span>
                    </div>

                    <div className="ui-ingress-hosts-col">
                      {hostList.length === 0 || ingress.hosts === '*' ? (
                        <span className="ui-ingress-hosts">*</span>
                      ) : (
                        hostList.map((host) => {
                          const url = host.startsWith('http://') || host.startsWith('https://') ? host : `https://${host}${primaryPath ? (primaryPath.startsWith('/') ? primaryPath : '') : ''}`;
                          const isCopied = copiedHost === url;

                          return (
                            <div key={host} className="ui-ingress-host-row">
                              <button 
                                className="ui-ingress-host-link" 
                                onClick={(e) => handleOpenUrl(host, primaryPath, e)}
                                title={`Open ${url} in browser`}
                              >
                                <span>{host}</span>
                                <ExternalLink size={11} style={{ opacity: 0.7, flexShrink: 0 }} />
                              </button>

                              <button 
                                className="ui-ingress-copy-btn" 
                                onClick={(e) => handleCopy(host, primaryPath, e)}
                                title={isCopied ? "Copied!" : "Copy URL"}
                              >
                                {isCopied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                              </button>

                              {ingress.paths && (
                                <span className="ui-ingress-path-tag" title={`Paths: ${ingress.paths}`}>
                                  {ingress.paths.length > 20 ? `${ingress.paths.substring(0, 18)}...` : ingress.paths}
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    <span className="ui-ingress-address" title={ingress.address}>{ingress.address || '-'}</span>
                    <span className="ui-ingress-ports" style={{ textAlign: 'center' }}>{ingress.ports}</span>
                    <span className="ui-ingress-age" style={{ textAlign: 'right' }}>{ingress.age}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
