import { useState } from 'react';

export interface AppSettings {
  terminalApp: 'Terminal' | 'iTerm';
  showTopActions: boolean;
  themeColor: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  terminalApp: 'Terminal',
  showTopActions: false,
  themeColor: '#FF2D55',
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
      
      if (updated.themeColor) {
        document.documentElement.style.setProperty('--theme-accent', updated.themeColor);
        document.documentElement.style.setProperty('--theme-accent-hover', updated.themeColor);
        document.documentElement.style.setProperty('--primary', updated.themeColor);
        document.documentElement.style.setProperty('--primary-hover', updated.themeColor);
      }
      
      return updated;
    });
  };

  return { settings, updateSettings };
}
