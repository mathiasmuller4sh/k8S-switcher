import { useState, useRef, useEffect, useMemo } from 'react';
import { Server, Folder, Search, ChevronDown, Check, Terminal } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useKubeContexts } from '../../hooks/useKubeContexts';
import { useKubeNamespaces } from '../../hooks/useKubeNamespaces';
import { useSettings } from '../../hooks/useSettings';

interface UnifiedWidgetProps {
  selectedContext: string;
  selectedNamespace: string;
  onContextChange: (ctx: string) => void;
  onNamespaceChange: (ns: string) => void;
  onSearchClick: () => void;
}

export function UnifiedWidget({
  selectedContext,
  selectedNamespace,
  onContextChange,
  onNamespaceChange,
  onSearchClick,
}: UnifiedWidgetProps) {
  const { contexts, loading: contextsLoading } = useKubeContexts();
  const { namespaces, loading: nsLoading } = useKubeNamespaces(selectedContext);
  const { settings } = useSettings();

  const [activeDropdown, setActiveDropdown] = useState<'context' | 'namespace' | null>(null);
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
      await invoke('open_terminal', { 
        context: selectedContext, 
        namespace: selectedNamespace,
        terminalApp: settings.terminalApp
      });
    } catch (error) {
      console.error('Failed to open terminal', error);
    }
  };

  const filteredContexts = useMemo(() => {
    if (!contextSearch) return contexts;
    return contexts.filter(ctx => ctx.toLowerCase().includes(contextSearch.toLowerCase()));
  }, [contexts, contextSearch]);

  const filteredNamespaces = useMemo(() => {
    if (!namespaceSearch) return namespaces;
    return namespaces.filter(ns => ns.toLowerCase().includes(namespaceSearch.toLowerCase()));
  }, [namespaces, namespaceSearch]);

  return (
    <div className="unified-widget-container" ref={containerRef}>
      <div className="unified-pill" style={{ position: 'relative' }}>
        
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
                  width: '200px'
                }}
              />
            ) : (
              <span style={{ 
                maxWidth: '250px', 
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
            <div className="ui-select-dropdown-menu" style={{ top: '100%', left: '0', width: '350px', marginTop: '8px', borderRadius: '12px' }}>
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
                  width: '200px'
                }}
              />
            ) : (
              <span style={{ 
                maxWidth: '250px', 
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
            <div className="ui-select-dropdown-menu" style={{ top: '100%', left: '0', width: '350px', marginTop: '8px', borderRadius: '12px' }}>
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
          <button className="unified-icon-btn" onClick={handleOpenTerminal} title="Open Terminal in this Namespace">
            <Terminal size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
