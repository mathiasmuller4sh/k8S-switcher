import { useKubeNamespaces } from '../../hooks/useKubeNamespaces';
import { SelectDropdown } from '../ui/SelectDropdown';
import { SelectionList } from '../ui/SelectionList';
import { useFavorites } from '../../hooks/useFavorites';
import { Terminal } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { useSettings } from '../../hooks/useSettings';

interface NamespaceSelectorProps {
  context: string;
  selected: string;
  onSelect: (namespace: string) => void;
  displayMode?: 'combo' | 'list';
}

export function NamespaceSelector({ context, selected, onSelect, displayMode = 'combo' }: NamespaceSelectorProps) {
  const { namespaces, loading, error } = useKubeNamespaces(context);
  const { toggleFavorite, isFavorite } = useFavorites(`namespaces-${context}`);

  const options = namespaces.map((ns) => ({ value: ns, label: ns }));

  if (displayMode === 'list') {
    if (!context) return null;
    return (
      <SelectionList
        title={`Namespaces in ${context}`}
        options={options}
        onSelect={onSelect}
        isFavorite={isFavorite}
        onToggleFavorite={toggleFavorite}
        loading={loading}
        error={error}
      />
    );
  }

  if (!context) return null;

  const { settings } = useSettings();

  const handleOpenTerminal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!context || !selected) return;
    try {
      await invoke('open_terminal', { 
        context, 
        namespace: selected,
        terminalApp: settings.terminalApp
      });
    } catch (error) {
      console.error('Failed to open terminal', error);
    }
  };

  const labelNode = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      <span>Namespace</span>
      {selected && (
        <button 
          className="ui-header-action-btn"
          title="Open Terminal in this Namespace" 
          onClick={handleOpenTerminal}
        >
          <Terminal size={14} />
        </button>
      )}
    </div>
  );

  return (
    <SelectDropdown
      label={labelNode}
      value={selected}
      onChange={onSelect}
      options={options}
      disabled={loading || !context}
      isFavorite={isFavorite}
      onToggleFavorite={toggleFavorite}
      onClear={() => onSelect("")}
    />
  );
}
