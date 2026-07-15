import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Search, RefreshCw, X, Loader2, Star } from "lucide-react";
import "./GlobalSearchModal.css";

interface SearchResult {
  context: string;
  namespace: string;
}

interface GlobalSearchModalProps {
  onClose: () => void;
  onSelect: (context: string, namespace: string) => void;
}

export function GlobalSearchModal({ onClose, onSelect }: GlobalSearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [favorites, setFavorites] = useState<Record<string, string[]>>({});
  const [recents, setRecents] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load favorites from localStorage
    const loadFavorites = () => {
      const favs: Record<string, string[]> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("k8s-switcher-favorites-namespaces-")) {
          const context = key.replace("k8s-switcher-favorites-namespaces-", "");
          try {
            const stored = localStorage.getItem(key);
            if (stored) {
              favs[context] = JSON.parse(stored);
            }
          } catch (e) {
            console.error("Error loading favorites from localStorage", e);
          }
        }
      }
      setFavorites(favs);
    };

    const loadRecents = () => {
      try {
        const stored = localStorage.getItem("k8s-switcher-recent-namespaces");
        if (stored) {
          setRecents(JSON.parse(stored));
        }
      } catch (e) {
        console.error("Error loading recents from localStorage", e);
      }
    };

    loadFavorites();
    loadRecents();
  }, []);

  const isNamespaceFavorite = (context: string, namespace: string) => {
    return favorites[context]?.includes(namespace) ?? false;
  };

  const handleSelect = (context: string, namespace: string) => {
    setRecents(prev => {
      const newRecents = [{ context, namespace }, ...prev.filter(r => r.context !== context || r.namespace !== namespace)].slice(0, 5);
      try {
        localStorage.setItem("k8s-switcher-recent-namespaces", JSON.stringify(newRecents));
      } catch (e) {
        console.error("Error saving recents", e);
      }
      return newRecents;
    });
    
    onSelect(context, namespace);
    onClose();
  };

  const handleToggleFavorite = (e: React.MouseEvent, context: string, namespace: string) => {
    e.stopPropagation();
    const storageKey = `k8s-switcher-favorites-namespaces-${context}`;
    const currentFavs = favorites[context] ?? [];
    let newFavs: string[];
    if (currentFavs.includes(namespace)) {
      newFavs = currentFavs.filter(ns => ns !== namespace);
    } else {
      newFavs = [...currentFavs, namespace];
    }
    
    try {
      localStorage.setItem(storageKey, JSON.stringify(newFavs));
    } catch (err) {
      console.error("Error saving favorite", err);
    }

    setFavorites(prev => ({
      ...prev,
      [context]: newFavs
    }));
  };

  const sortedResults = [...results].sort((a, b) => {
    const aFav = isNamespaceFavorite(a.context, a.namespace);
    const bFav = isNamespaceFavorite(b.context, b.namespace);
    
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    
    // Alphabetical sort by namespace
    const nsCompare = a.namespace.localeCompare(b.namespace);
    if (nsCompare !== 0) return nsCompare;
    
    // Fallback to context if namespace is the same
    return a.context.localeCompare(b.context);
  });

  const starredResults = Object.entries(favorites).flatMap(([context, namespaces]) => 
    namespaces.map(namespace => ({ context, namespace }))
  ).sort((a, b) => {
    const nsCompare = a.namespace.localeCompare(b.namespace);
    if (nsCompare !== 0) return nsCompare;
    return a.context.localeCompare(b.context);
  });

  const handleRemoveRecent = (e: React.MouseEvent, context: string, namespace: string) => {
    e.stopPropagation();
    setRecents(prev => {
      const newRecents = prev.filter(r => r.context !== context || r.namespace !== namespace);
      try {
        localStorage.setItem("k8s-switcher-recent-namespaces", JSON.stringify(newRecents));
      } catch (err) {
        console.error("Error saving recents", err);
      }
      return newRecents;
    });
  };

  const renderResultItem = (r: SearchResult, index: number, prefix: string) => (
    <li 
      key={`${prefix}-${r.context}-${r.namespace}-${index}`}
      className="search-result-item"
      onClick={() => handleSelect(r.context, r.namespace)}
    >
      <div className="search-result-main-line">
        <div className="result-namespace">{r.namespace}</div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {prefix === 'recent' && (
            <span 
              className="search-result-favorite-btn"
              onClick={(e) => handleRemoveRecent(e, r.context, r.namespace)}
              title="Remove from recents"
            >
              <X size={14} />
            </span>
          )}
          <span 
            className={`search-result-favorite-btn ${isNamespaceFavorite(r.context, r.namespace) ? 'active' : ''}`}
            onClick={(e) => handleToggleFavorite(e, r.context, r.namespace)}
            title={isNamespaceFavorite(r.context, r.namespace) ? "Remove from favorites" : "Add to favorites"}
          >
            <Star size={14} fill={isNamespaceFavorite(r.context, r.namespace) ? "currentColor" : "none"} />
          </span>
        </div>
      </div>
      <div className="result-context">{r.context}</div>
    </li>
  );

  useEffect(() => {
    // Focus input on mount
    if (inputRef.current) {
      inputRef.current.focus();
    }
    
    // Initial empty search to show all or nothing? Let's just show top 100 if empty.
    performSearch("");
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const performSearch = async (q: string) => {
    try {
      const res = await invoke<SearchResult[]>('search_namespaces', { query: q });
      setResults(res);
    } catch (err) {
      console.error("Search failed:", err);
    }
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    performSearch(val);
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await invoke('sync_namespaces_cache');
      // Re-run search after sync
      await performSearch(query);
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="search-modal-overlay" onClick={onClose}>
      <div className="search-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="search-modal-header">
          <div className="search-input-wrapper">
            <Search size={20} className="search-icon" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search namespaces across contexts..."
              value={query}
              onChange={handleQueryChange}
              className="search-input"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck="false"
            />
          </div>
          <button 
            className="sync-btn" 
            onClick={handleSync} 
            disabled={isSyncing}
            title="Refresh cache from all contexts"
          >
            {isSyncing ? <Loader2 size={18} className="spinner" /> : <RefreshCw size={18} />}
          </button>
          <button className="close-btn" onClick={onClose} title="Close (Esc)">
            <X size={20} />
          </button>
        </div>
        
        <div className="search-modal-body">
          {query === "" ? (
            <>
              {recents.length > 0 && (
                <>
                  <div className="search-section-title">Recent</div>
                  <ul className="search-results-list">
                    {recents.map((r, i) => renderResultItem(r, i, 'recent'))}
                  </ul>
                </>
              )}
              {starredResults.length > 0 && (
                <>
                  <div className="search-section-title">Starred</div>
                  <ul className="search-results-list">
                    {starredResults.map((r, i) => renderResultItem(r, i, 'starred'))}
                  </ul>
                </>
              )}
              {recents.length === 0 && starredResults.length === 0 && (
                <div className="search-empty-state">
                  Type to search namespaces...
                </div>
              )}
            </>
          ) : sortedResults.length === 0 ? (
            <div className="search-empty-state">
              No namespaces found matching "{query}"
            </div>
          ) : (
            <ul className="search-results-list">
              {sortedResults.map((r, i) => renderResultItem(r, i, 'search'))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
