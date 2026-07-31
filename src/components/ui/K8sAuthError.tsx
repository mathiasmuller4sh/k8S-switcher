import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface K8sAuthErrorProps {
  error: string;
  onRetry?: () => void;
  resourceName?: string;
}

export function K8sAuthError({ error, onRetry, resourceName = 'resources' }: K8sAuthErrorProps) {
  const isGcloudAuthError = error.includes('gcloud auth login') || error.includes('Reauthentication failed');

  useEffect(() => {
    // If it's an auth error and we have a retry function, poll automatically
    // so the UI recovers when the user finishes authenticating in the terminal.
    if (isGcloudAuthError && onRetry) {
      const interval = setInterval(() => {
        onRetry();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isGcloudAuthError, onRetry]);

  const handleLoginClick = async () => {
    try {
      const settingsStr = localStorage.getItem("k8s-switcher-settings");
      let terminalApp = undefined;
      if (settingsStr) {
        const settings = JSON.parse(settingsStr);
        terminalApp = settings.terminalApp;
      }
      await invoke('open_login_terminal', { terminalApp, command: 'gcloud auth login' });
    } catch (e) {
      console.error('Failed to open login terminal', e);
    }
  };

  return (
    <div className="ui-empty-state" style={{ color: 'var(--danger, #ef4444)', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
      <p>Failed to load {resourceName}</p>
      <p style={{ fontSize: '0.85rem', maxWidth: '80%', textAlign: 'center', opacity: 0.8 }}>
        {error.split('\n')[0]}
      </p>
      
      {isGcloudAuthError && (
        <button 
          className="ui-action-btn"
          style={{ 
            marginTop: '8px', 
            backgroundColor: 'var(--primary)', 
            color: 'white', 
            padding: '8px 16px', 
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
          onClick={handleLoginClick}
        >
          Run gcloud auth login
        </button>
      )}
      
      {!isGcloudAuthError && onRetry && (
        <button 
          className="ui-action-btn"
          style={{ 
            marginTop: '8px', 
            padding: '8px 16px', 
            borderRadius: '6px',
            cursor: 'pointer'
          }}
          onClick={onRetry}
        >
          Retry
        </button>
      )}
    </div>
  );
}
