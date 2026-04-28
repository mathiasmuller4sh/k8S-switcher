import { useState, useEffect } from 'react';

export function useFavorites(key: string) {
  const storageKey = `k8s-switcher-favorites-${key}`;
  
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to load favorites', e);
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(favorites));
    } catch (e) {
      console.error('Failed to save favorites', e);
    }
  }, [favorites, storageKey]);

  const toggleFavorite = (item: string) => {
    setFavorites(prev => {
      if (prev.includes(item)) {
        return prev.filter(f => f !== item);
      } else {
        return [...prev, item];
      }
    });
  };

  const isFavorite = (item: string) => favorites.includes(item);

  return { favorites, toggleFavorite, isFavorite };
}
