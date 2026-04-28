import { useKubeContexts } from '../../hooks/useKubeContexts';
import { SelectDropdown } from '../ui/SelectDropdown';
import { SelectionList } from '../ui/SelectionList';
import { useFavorites } from '../../hooks/useFavorites';

interface ClusterSelectorProps {
  selected: string;
  onSelect: (context: string) => void;
  displayMode?: 'combo' | 'list';
}

export function ClusterSelector({ selected, onSelect, displayMode = 'combo' }: ClusterSelectorProps) {
  const { contexts, loading } = useKubeContexts();
  const { toggleFavorite, isFavorite } = useFavorites('contexts');

  const options = contexts.map((ctx) => ({ value: ctx, label: ctx }));

  if (displayMode === 'list') {
    return (
      <SelectionList
        title="Select Cluster Context"
        options={options}
        onSelect={onSelect}
        isFavorite={isFavorite}
        onToggleFavorite={toggleFavorite}
        loading={loading}
      />
    );
  }

  return (
    <SelectDropdown
      label="Cluster Context"
      value={selected}
      onChange={onSelect}
      options={options}
      disabled={loading}
      isFavorite={isFavorite}
      onToggleFavorite={toggleFavorite}
      onClear={() => onSelect("")}
    />
  );
}
