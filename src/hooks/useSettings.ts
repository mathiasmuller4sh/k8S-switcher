import { useState } from 'react';

export interface AppSettings {
  terminalApp: 'Terminal' | 'iTerm';
}

const DEFAULT_SETTINGS: AppSettings = {
  terminalApp: 'Terminal',
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('k8switcher-settings');
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('k8switcher-settings', JSON.stringify(updated));
      return updated;
    });
  };

  return { settings, updateSettings };
}
