import { useState, useEffect, useRef } from 'react';
import { Star, Search } from 'lucide-react';
import { SelectOption } from './SelectDropdown';

interface SelectionListProps {
  title: string;
  options: SelectOption[];
  onSelect: (value: string) => void;
  isFavorite?: (value: string) => boolean;
  onToggleFavorite?: (value: string) => void;
  loading?: boolean;
  error?: string | null;
}

export function SelectionList({
  title,
  options,
  onSelect,
  isFavorite,
  onToggleFavorite,
  loading,
  error
}: SelectionListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus search input when the list mounts
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  if (loading) {
    return <div className="ui-empty-state">Loading {title.toLowerCase()}...</div>;
  }

  if (error) {
    const isGcloudAuthError = error.includes('gcloud auth login') || error.includes('Reauthentication failed');
    return (
      <div className="ui-empty-state" style={{ color: 'var(--danger, #ef4444)', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
        <p>Failed to load {title.toLowerCase()}</p>
        <p style={{ fontSize: '0.85rem', maxWidth: '80%', textAlign: 'center', opacity: 0.8 }}>{error.split('\n')[0]}</p>
        {isGcloudAuthError && (
          <button 
            className="ui-action-btn"
            style={{ 
              marginTop: '8px', 
              backgroundColor: 'var(--primary)', 
              color: 'white', 
              padding: '8px 16px', 
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
            onClick={async () => {
              try {
                const { invoke } = await import('@tauri-apps/api/core');
                // Get terminal settings from localStorage or default
                const settingsStr = localStorage.getItem("k8s-switcher-settings");
                let terminalApp = undefined;
                if (settingsStr) {
                  const settings = JSON.parse(settingsStr);
                  terminalApp = settings.terminalApp;
                }
                await invoke('open_login_terminal', { terminalApp, command: 'gcloud auth login' });
              } catch (e) {
                console.error('Failed to open login terminal', e);
              }
            }}
          >
            Run gcloud auth login
          </button>
        )}
      </div>
    );
  }

  // Filter options based on search query
  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
    opt.value.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort options: favorites first, then alphabetical
  const sortedOptions = [...filteredOptions].sort((a, b) => {
    if (isFavorite) {
      const aFav = isFavorite(a.value);
      const bFav = isFavorite(b.value);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
    }
    return a.label.localeCompare(b.label);
  });

  return (
    <div className="ui-selection-list-container">
      <div className="ui-selection-list-header">
        <h2>{title}</h2>
        <div className="ui-selection-list-search">
          <Search size={16} className="ui-selection-list-search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder={`Search ${title.toLowerCase()}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck="false"
          />
        </div>
      </div>
      <div className="ui-selection-list-content">
        {sortedOptions.length === 0 ? (
          <div className="ui-empty-state">No matches found</div>
        ) : (
          sortedOptions.map(opt => {
            const fav = isFavorite ? isFavorite(opt.value) : false;
            return (
              <div
                key={opt.value}
                className="ui-selection-list-item"
                onClick={() => onSelect(opt.value)}
              >
                <span className="ui-selection-list-item-label">{opt.label}</span>
                {onToggleFavorite && (
                  <span
                    className={`ui-selection-list-favorite-btn ${fav ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(opt.value);
                    }}
                  >
                    <Star size={16} className={fav ? 'fill-current' : ''} />
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
