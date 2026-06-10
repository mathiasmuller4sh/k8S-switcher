import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';

export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
}

export function useAutoUpdate() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  useEffect(() => {
    checkForUpdates();
  }, []);

  const checkForUpdates = async () => {
    setIsChecking(true);
    try {
      // 1. Get current app version
      const currentVersion = await getVersion();
      
      // 2. Fetch latest release from GitHub
      const response = await fetch('https://api.github.com/repos/mathiasmuller4sh/k8S-switcher/releases/latest');
      if (!response.ok) throw new Error('Failed to fetch latest release from GitHub');
      
      const data = await response.json();
      // Tag usually looks like "v0.1.2", remove the "v" for comparison
      const latestVersion = data.tag_name.replace(/^v/, '');
      
      // Simple string comparison (for complex semver you might want a library, but this works for basic x.y.z)
      const isNewer = compareVersions(latestVersion, currentVersion) > 0;
      
      if (isNewer) {
        setUpdateInfo({
          available: true,
          currentVersion,
          latestVersion,
          releaseNotes: data.body || 'No release notes provided.'
        });
      }
    } catch (err: any) {
      console.error('Update check failed:', err);
    } finally {
      setIsChecking(false);
    }
  };

  const applyUpdate = async () => {
    setIsUpdating(true);
    setUpdateError(null);
    try {
      await invoke('execute_brew_upgrade');
      setUpdateSuccess(true);
    } catch (err: any) {
      console.error('Failed to apply update via brew:', err);
      setUpdateError(err.toString());
    } finally {
      setIsUpdating(false);
    }
  };

  // Helper to compare versions like 1.0.2 and 1.1.0
  const compareVersions = (v1: string, v2: string) => {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  };

  return { updateInfo, isChecking, isUpdating, updateError, updateSuccess, applyUpdate, checkForUpdates };
}
