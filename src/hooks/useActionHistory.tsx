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
}

const HISTORY_KEY = 'k8s-switcher-action-history';
const MAX_HISTORY = 20;

interface ActionHistoryContextType {
  history: ActionRecord[];
  addAction: (action: Omit<ActionRecord, 'id' | 'timestamp'>) => void;
  removeAction: (id: string) => void;
  clearHistory: () => void;
}

const ActionHistoryContext = createContext<ActionHistoryContextType | null>(null);

export function ActionHistoryProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<ActionRecord[]>(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
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

  const addAction = (action: Omit<ActionRecord, 'id' | 'timestamp'>) => {
    const newRecord: ActionRecord = {
      ...action,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    };

    setHistory(prev => {
      const updated = [newRecord, ...prev];
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

  return (
    <ActionHistoryContext.Provider value={{ history, addAction, removeAction, clearHistory }}>
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
