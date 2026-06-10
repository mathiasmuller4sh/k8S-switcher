import React, { createContext, useContext, useState, useEffect } from 'react';

export type ActionType = 'Logs' | 'Shell' | 'PortForward' | 'Describe';

export interface ActionRecord {
  id: string;
  type: ActionType;
  context: string;
  namespace: string;
  podName: string;
  localPort?: number;
  podPort?: number;
  timestamp: number;
  count?: number;
}

const HISTORY_KEY = 'k8s-switcher-action-history';
const MAX_HISTORY = 100; // Store more so we can find top 10 accurately

interface ActionHistoryContextType {
  history: ActionRecord[];
  getTopActions: (namespace?: string) => ActionRecord[];
  addAction: (action: Omit<ActionRecord, 'id' | 'timestamp' | 'count'>) => void;
  removeAction: (id: string) => void;
  clearHistory: () => void;
}

const ActionHistoryContext = createContext<ActionHistoryContextType | null>(null);

export function ActionHistoryProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<ActionRecord[]>(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      // Ensure existing records have a count
      return parsed.map((r: any) => ({ ...r, count: r.count || 1 }));
    } catch (e) {
      console.error('Failed to load action history', e);
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
      console.error('Failed to save action history', e);
    }
  }, [history]);

  const addAction = (action: Omit<ActionRecord, 'id' | 'timestamp' | 'count'>) => {
    setHistory(prev => {
      const existingIndex = prev.findIndex(r => 
        r.type === action.type && 
        r.context === action.context && 
        r.namespace === action.namespace && 
        r.podName === action.podName && 
        r.localPort === action.localPort && 
        r.podPort === action.podPort
      );

      let updated;
      if (existingIndex >= 0) {
        const existing = prev[existingIndex];
        const newRecord = { ...existing, count: (existing.count || 1) + 1, timestamp: Date.now() };
        updated = [...prev];
        updated[existingIndex] = newRecord;
      } else {
        const id = typeof crypto.randomUUID === 'function' 
          ? crypto.randomUUID() 
          : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const newRecord: ActionRecord = { ...action, id, timestamp: Date.now(), count: 1 };
        updated = [newRecord, ...prev];
      }

      // Sort by timestamp desc to keep newest first in raw history
      updated.sort((a, b) => b.timestamp - a.timestamp);
      
      if (updated.length > MAX_HISTORY) {
        return updated.slice(0, MAX_HISTORY);
      }
      return updated;
    });
  };

  const removeAction = (id: string) => {
    setHistory(prev => prev.filter(record => record.id !== id));
  };

  const clearHistory = () => {
    setHistory([]);
  };

  const getTopActions = (namespace?: string) => {
    let filtered = history;
    if (namespace) {
      filtered = history.filter(a => a.namespace === namespace);
    }
    return [...filtered]
      .sort((a, b) => {
        const countA = a.count || 1;
        const countB = b.count || 1;
        if (countA !== countB) return countB - countA;
        return b.timestamp - a.timestamp;
      })
      .slice(0, 10);
  };

  return (
    <ActionHistoryContext.Provider value={{ history, getTopActions, addAction, removeAction, clearHistory }}>
      {children}
    </ActionHistoryContext.Provider>
  );
}

export function useActionHistory() {
  const context = useContext(ActionHistoryContext);
  if (!context) {
    throw new Error('useActionHistory must be used within an ActionHistoryProvider');
  }
  return context;
}
