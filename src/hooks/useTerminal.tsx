import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface TerminalTab {
  id: string;
  title: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  ptyId?: string;
}

interface TerminalContextType {
  tabs: TerminalTab[];
  activeTabId: string | null;
  isPanelOpen: boolean;
  openTerminal: (title: string, command: string, args: string[], env?: Record<string, string>) => void;
  closeTerminal: (id: string) => void;
  setActiveTabId: (id: string) => void;
  setPanelOpen: (isOpen: boolean) => void;
  setPtyId: (tabId: string, ptyId: string) => void;
}

const TerminalContext = createContext<TerminalContextType | null>(null);

export function TerminalProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [isPanelOpen, setPanelOpen] = useState(false);

  const openTerminal = useCallback((title: string, command: string, args: string[], env?: Record<string, string>) => {
    const newId = `term-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newTab: TerminalTab = { id: newId, title, command, args, env };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
    setPanelOpen(true);
  }, []);

  const closeTerminal = useCallback((id: string) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === id);
      if (idx === -1) return prev;
      
      const tab = prev[idx];
      if (tab.ptyId) {
        invoke('close_pty', { id: tab.ptyId }).catch(console.error);
      }

      const newTabs = prev.filter(t => t.id !== id);
      if (newTabs.length === 0) {
        setActiveTabId(null);
        setPanelOpen(false);
      } else if (activeTabId === id) {
        const nextIdx = Math.max(0, idx - 1);
        setActiveTabId(newTabs[nextIdx].id);
      }
      return newTabs;
    });
  }, [activeTabId]);

  const setPtyId = useCallback((tabId: string, ptyId: string) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, ptyId } : t));
  }, []);

  return (
    <TerminalContext.Provider value={{
      tabs,
      activeTabId,
      isPanelOpen,
      openTerminal,
      closeTerminal,
      setActiveTabId,
      setPanelOpen,
      setPtyId
    }}>
      {children}
    </TerminalContext.Provider>
  );
}

export function useTerminal() {
  const context = useContext(TerminalContext);
  if (!context) {
    throw new Error('useTerminal must be used within a TerminalProvider');
  }
  return context;
}
