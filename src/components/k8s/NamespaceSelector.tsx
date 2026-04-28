import React from 'react';
import { useKubeNamespaces } from '../../hooks/useKubeNamespaces';
import { SelectDropdown } from '../ui/SelectDropdown';
import { SelectionList } from '../ui/SelectionList';
import { useFavorites } from '../../hooks/useFavorites';

interface NamespaceSelectorProps {
  context: string;
  selected: string;
  onSelect: (namespace: string) => void;
  displayMode?: 'combo' | 'list';
}

export function NamespaceSelector({ context, selected, onSelect, displayMode = 'combo' }: NamespaceSelectorProps) {
  const { namespaces, loading } = useKubeNamespaces(context);
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
      />
    );
  }

  if (!context) return null;

  return (
    <SelectDropdown
      label="Namespace"
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
