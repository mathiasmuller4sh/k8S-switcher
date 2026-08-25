import { useState, useRef, useEffect, useMemo } from 'react';
import { Server, Folder, ChevronDown, Check, Terminal, Star, Eye } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useKubeContexts } from '../../hooks/useKubeContexts';
import { useKubeNamespaces } from '../../hooks/useKubeNamespaces';
import { useSettings } from '../../hooks/useSettings';
import { useFavorites } from '../../hooks/useFavorites';
import { useTerminal } from '../../hooks/useTerminal';
import { NodeListModal } from './NodeListModal';

interface UnifiedWidgetProps {
  selectedContext: string;
  selectedNamespace: string;
  onContextChange: (ctx: string) => void;
  onNamespaceChange: (ns: string) => void;
}

export function UnifiedWidget({
  selectedContext,
  selectedNamespace,
  onContextChange,
  onNamespaceChange,
}: UnifiedWidgetProps) {
  const { contexts, loading: contextsLoading } = useKubeContexts();
  const { namespaces, loading: nsLoading } = useKubeNamespaces(selectedContext);
  const { settings } = useSettings();
  const { favorites: contextFavs, toggleFavorite: toggleContextFav } = useFavorites('contexts');
  const { favorites: nsFavs, toggleFavorite: toggleNsFav } = useFavorites('namespaces');
  const { openTerminal } = useTerminal();

  const [activeDropdown, setActiveDropdown] = useState<'context' | 'namespace' | null>(null);
  const [showNodes, setShowNodes] = useState(false);
  const [contextSearch, setContextSearch] = useState('');
  const [namespaceSearch, setNamespaceSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Reset search when opening dropdown
  useEffect(() => {
    if (activeDropdown === 'context') {
      setContextSearch('');
    } else if (activeDropdown === 'namespace') {
      setNamespaceSearch('');
    }
  }, [activeDropdown]);

  const handleContextSelect = (ctx: string) => {
    onContextChange(ctx);
    setActiveDropdown(null);
  };

  const handleNamespaceSelect = (ns: string) => {
    onNamespaceChange(ns);
    setActiveDropdown(null);
  };

  const handleOpenTerminal = async () => {
    if (!selectedContext || !selectedNamespace) return;
    try {
      if (settings.terminalApp === 'Interne') {
        openTerminal(`Terminal: ${selectedNamespace}`, "sh", [
          "-c",
          `kubectl config use-context ${selectedContext} && kubectl config set-context --current --namespace=${selectedNamespace} && clear && exec \${SHELL:-/bin/sh}`
        ]);
      } else {
        await invoke('open_terminal', { 
          context: selectedContext, 
          namespace: selectedNamespace,
          terminalApp: settings.terminalApp
        });
      }
    } catch (error) {
      console.error('Failed to open terminal', error);
    }
  };

  const filteredContexts = useMemo(() => {
    let result = contexts;
    if (contextSearch) {
      result = contexts.filter(ctx => ctx.toLowerCase().includes(contextSearch.toLowerCase()));
    }
    return [...result].sort((a, b) => {
      const aFav = contextFavs.includes(a) ? 1 : 0;
      const bFav = contextFavs.includes(b) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      return a.localeCompare(b);
    });
  }, [contexts, contextSearch, contextFavs]);

  const filteredNamespaces = useMemo(() => {
    let result = namespaces;
    if (namespaceSearch) {
      result = namespaces.filter(ns => ns.toLowerCase().includes(namespaceSearch.toLowerCase()));
    }
    return [...result].sort((a, b) => {
      const aFav = nsFavs.includes(a) ? 1 : 0;
      const bFav = nsFavs.includes(b) ? 1 : 0;
      if (aFav !== bFav) return bFav - aFav;
      return a.localeCompare(b);
    });
  }, [namespaces, namespaceSearch, nsFavs]);

  return (
    <>
    <div className="unified-widget-container" ref={containerRef}>
      <div className="unified-pill" style={{ position: 'relative' }}>
        
        {/* Nodes Button */}
        {selectedContext && (
          <>
            <div 
              className="unified-section" 
              onClick={() => setShowNodes(true)}
              title="View Nodes"
              style={{ padding: '0 12px', cursor: 'pointer' }}
            >
              <Eye size={16} style={{ flexShrink: 0 }} />
            </div>
            <div className="unified-divider"></div>
          </>
        )}

        {/* Context Selector */}
        <div style={{ position: 'relative' }}>
          <div 
            className="unified-section" 
            onClick={() => {
              if (activeDropdown !== 'context') setActiveDropdown('context');
            }}
          >
            <Server size={16} style={{ flexShrink: 0 }} />
            {activeDropdown === 'context' ? (
              <input
                type="text"
                autoFocus
                value={contextSearch}
                onChange={(e) => setContextSearch(e.target.value)}
                placeholder="Filter contexts..."
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  outline: 'none',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  width: '240px'
                }}
              />
            ) : (
              <span style={{ 
                maxWidth: '350px', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                display: 'inline-block'
              }}>
                {selectedContext || "Select Cluster..."}
              </span>
            )}
            <ChevronDown size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
          </div>
          {activeDropdown === 'context' && (
            <div className="ui-select-dropdown-menu" style={{ top: '100%', left: '0', minWidth: '550px', width: 'max-content', maxWidth: '85vw', marginTop: '8px', borderRadius: '12px' }}>
              <div className="ui-select-options-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {contextsLoading ? (
                  <div style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>Loading...</div>
                ) : filteredContexts.length === 0 ? (
                  <div style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>No clusters found</div>
                ) : (
                  filteredContexts.map(ctx => (
                    <div 
                      key={ctx} 
                      className={`ui-select-option ${ctx === selectedContext ? 'selected' : ''}`}
                      onClick={() => handleContextSelect(ctx)}
                    >
                      <div 
                        className={`ui-select-favorite-btn ${contextFavs.includes(ctx) ? 'active' : ''}`}
                        style={{ marginRight: '8px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleContextFav(ctx);
                        }}
                        title={contextFavs.includes(ctx) ? "Remove from favorites" : "Add to favorites"}
                      >
                        <Star size={16} fill={contextFavs.includes(ctx) ? "currentColor" : "none"} />
                      </div>
                      <span className="ui-select-option-label" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ctx}>{ctx}</span>
                      {ctx === selectedContext && <Check size={16} />}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="unified-divider"></div>

        {/* Namespace Selector */}
        <div style={{ position: 'relative' }}>
          <div 
            className="unified-section" 
            onClick={() => {
              if (selectedContext && activeDropdown !== 'namespace') {
                setActiveDropdown('namespace');
              }
            }}
            style={{ opacity: selectedContext ? 1 : 0.5, cursor: selectedContext ? 'pointer' : 'not-allowed' }}
          >
            <Folder size={16} style={{ flexShrink: 0 }} />
            {activeDropdown === 'namespace' ? (
              <input
                type="text"
                autoFocus
                value={namespaceSearch}
                onChange={(e) => setNamespaceSearch(e.target.value)}
                placeholder="Filter namespaces..."
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  outline: 'none',
                  fontFamily: 'inherit',
                  fontSize: 'inherit',
                  width: '240px'
                }}
              />
            ) : (
              <span style={{ 
                maxWidth: '350px', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                display: 'inline-block'
              }}>
                {selectedNamespace || "Select Namespace..."}
              </span>
            )}
            <ChevronDown size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
          </div>
          {activeDropdown === 'namespace' && (
            <div className="ui-select-dropdown-menu" style={{ top: '100%', left: '0', minWidth: '550px', width: 'max-content', maxWidth: '85vw', marginTop: '8px', borderRadius: '12px' }}>
              <div className="ui-select-options-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {nsLoading ? (
                  <div style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>Loading...</div>
                ) : filteredNamespaces.length === 0 ? (
                  <div style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>No namespaces found</div>
                ) : (
                  filteredNamespaces.map(ns => (
                    <div 
                      key={ns} 
                      className={`ui-select-option ${ns === selectedNamespace ? 'selected' : ''}`}
                      onClick={() => handleNamespaceSelect(ns)}
                    >
                      <div 
                        className={`ui-select-favorite-btn ${nsFavs.includes(ns) ? 'active' : ''}`}
                        style={{ marginRight: '8px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleNsFav(ns);
                        }}
                        title={nsFavs.includes(ns) ? "Remove from favorites" : "Add to favorites"}
                      >
                        <Star size={16} fill={nsFavs.includes(ns) ? "currentColor" : "none"} />
                      </div>
                      <span className="ui-select-option-label" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ns}>{ns}</span>
                      {ns === selectedNamespace && <Check size={16} />}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '4px', marginLeft: '12px' }}>
        {selectedContext && selectedNamespace && (
          <button 
            className="unified-terminal-btn"
            onClick={handleOpenTerminal}
            disabled={!selectedContext || !selectedNamespace}
            title={`Open Terminal for ${selectedNamespace}`}
          >
            <Terminal size={16} />
          </button>
        )}
      </div>
    </div>

    {showNodes && selectedContext && (
        <NodeListModal context={selectedContext} onClose={() => setShowNodes(false)} />
      )}
    </>
  );
}
