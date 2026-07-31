import { useState, useRef, useEffect } from 'react';
import { Server, Folder, Search, ChevronDown, Check } from 'lucide-react';
import { useKubeContexts } from '../../hooks/useKubeContexts';
import { useKubeNamespaces } from '../../hooks/useKubeNamespaces';

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

  const [activeDropdown, setActiveDropdown] = useState<'context' | 'namespace' | null>(null);
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

  const handleContextSelect = (ctx: string) => {
    onContextChange(ctx);
    setActiveDropdown(null);
  };

  const handleNamespaceSelect = (ns: string) => {
    onNamespaceChange(ns);
    setActiveDropdown(null);
  };

  return (
    <div className="unified-widget-container" ref={containerRef}>
      <div className="unified-pill" style={{ position: 'relative' }}>
        
        {/* Context Selector */}
        <div 
          className="unified-section" 
          onClick={() => setActiveDropdown(activeDropdown === 'context' ? null : 'context')}
        >
          <Server size={16} />
          <span>{selectedContext || "Select Cluster..."}</span>
          <ChevronDown size={14} style={{ opacity: 0.5 }} />
        </div>

        <div className="unified-divider"></div>

        {/* Namespace Selector */}
        <div 
          className="unified-section" 
          onClick={() => {
            if (selectedContext) {
              setActiveDropdown(activeDropdown === 'namespace' ? null : 'namespace');
            }
          }}
          style={{ opacity: selectedContext ? 1 : 0.5, cursor: selectedContext ? 'pointer' : 'not-allowed' }}
        >
          <Folder size={16} />
          <span>{selectedNamespace || "Select Namespace..."}</span>
          <ChevronDown size={14} style={{ opacity: 0.5 }} />
        </div>

        {/* Dropdowns */}
        {activeDropdown === 'context' && (
          <div className="ui-select-dropdown-menu" style={{ top: '100%', left: '0', width: '250px', marginTop: '8px', borderRadius: '12px' }}>
            <div className="ui-select-options-list">
              {contextsLoading ? (
                <div style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>Loading...</div>
              ) : contexts.length === 0 ? (
                <div style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>No clusters found</div>
              ) : (
                contexts.map(ctx => (
                  <div 
                    key={ctx} 
                    className={`ui-select-option ${ctx === selectedContext ? 'selected' : ''}`}
                    onClick={() => handleContextSelect(ctx)}
                  >
                    <span className="ui-select-option-label">{ctx}</span>
                    {ctx === selectedContext && <Check size={16} />}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeDropdown === 'namespace' && (
          <div className="ui-select-dropdown-menu" style={{ top: '100%', left: '50%', width: '250px', marginTop: '8px', borderRadius: '12px', transform: 'translateX(-20%)' }}>
            <div className="ui-select-options-list">
              {nsLoading ? (
                <div style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>Loading...</div>
              ) : namespaces.length === 0 ? (
                <div style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>No namespaces found</div>
              ) : (
                namespaces.map(ns => (
                  <div 
                    key={ns} 
                    className={`ui-select-option ${ns === selectedNamespace ? 'selected' : ''}`}
                    onClick={() => handleNamespaceSelect(ns)}
                  >
                    <span className="ui-select-option-label">{ns}</span>
                    {ns === selectedNamespace && <Check size={16} />}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '4px', marginLeft: '12px' }}>
        <button className="unified-icon-btn" onClick={onSearchClick} title="Search Namespaces">
          <Search size={18} />
        </button>
      </div>
    </div>
  );
}
