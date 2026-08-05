import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { RefreshCw, Play, Activity, Check, ExternalLink, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { useSettings } from '../../hooks/useSettings';

interface ArgoCDPanelProps {
  context: string;
  namespace: string;
}

export function ArgoCDPanel({ namespace }: ArgoCDPanelProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [argoState, setArgoState] = useState<any>(null);
  const [argoMetadata, setArgoMetadata] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = useState<boolean>(false);
  const { settings } = useSettings();

  const fetchArgoState = async () => {
    setIsFetching(true);
    setError(null);
    setArgoState(null);
    setSyncSuccess(false);

    try {
      // We assume the ArgoCD app name matches the namespace name
      const result: string = await invoke('get_argocd_state', { namespace });
      try {
        const parsed = JSON.parse(result);
        setArgoState(parsed);
        
        // Fetch metadata if revision is present
        const rev = parsed?.status?.sync?.revision || parsed?.status?.operationState?.syncResult?.revision;
        if (rev) {
          try {
            const metaResult: string = await invoke('get_argocd_revision_metadata', { namespace, revision: rev });
            setArgoMetadata(JSON.parse(metaResult));
          } catch (e) {
            console.error("Failed to fetch revision metadata", e);
          }
        }

      } catch (e) {
        // If not JSON, just store as string
        setArgoState({ raw: result });
      }
    } catch (e: any) {
      setError(e.message || "Failed to fetch ArgoCD state. Make sure argocd CLI is installed and configured.");
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    if (namespace) {
      fetchArgoState();
    }
  }, [namespace]);

  const syncApp = async () => {
    setIsSyncing(true);
    setError(null);
    setSyncSuccess(false);

    try {
      await invoke('sync_argocd_app', { namespace });
      setSyncSuccess(true);
      setTimeout(() => {
        fetchArgoState();
      }, 2000); // Give it a moment before refetching
    } catch (e: any) {
      setError(e.message || "Failed to sync ArgoCD app.");
    } finally {
      setIsSyncing(false);
    }
  };

  const getSyncStatusColor = (status: string) => {
    if (status === 'Synced') return '#10b981';
    if (status === 'OutOfSync') return '#f59e0b';
    return 'var(--text-muted)';
  };

  const getHealthStatusColor = (status: string) => {
    if (status === 'Healthy') return '#10b981';
    if (status === 'Progressing') return '#3b82f6';
    if (status === 'Degraded') return '#ef4444';
    if (status === 'Suspended') return '#8b5cf6';
    if (status === 'Missing') return '#f59e0b';
    return 'var(--text-muted)';
  };

  if (!namespace) {
    return <div className="ui-empty-state">Select a namespace to view ArgoCD state.</div>;
  }

  const argoUrl = `https://argocd.quatre.systems/applications/qsh-argocd-prod/${namespace}`;

  return (
    <Card className="ui-ai-panel">
      <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={16} className="text-primary" />
          <span className="ui-action-title">ArgoCD Status for {namespace}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <a 
            href={argoUrl}
            target="_blank"
            rel="noreferrer"
            className="ui-header-action-btn"
            title="Open in ArgoCD UI"
            style={{ textDecoration: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <ExternalLink size={14} /> UI
          </a>
          <button 
            className="ui-header-action-btn"
            onClick={fetchArgoState}
            disabled={isFetching || isSyncing}
            title="Refresh State"
          >
            <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} />
          </button>
        </div>
      </CardHeader>

      <CardContent style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {error && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ color: '#ef4444', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', padding: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '4px 4px 0 0' }}>
              <AlertCircle size={14} />
              {error}
            </div>
            <div style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '0 0 4px 4px', fontSize: '0.8rem', border: '1px solid rgba(239, 68, 68, 0.2)', borderTop: 'none' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>How to fix this:</div>
              <ol style={{ paddingLeft: '16px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li>Install the ArgoCD CLI (MacOS): <code style={{ backgroundColor: 'var(--bg-primary)', padding: '2px 4px', borderRadius: '3px', userSelect: 'all' }}>brew install argocd</code></li>
                <li>Login to the server using SSO: <code style={{ backgroundColor: 'var(--bg-primary)', padding: '2px 4px', borderRadius: '3px', userSelect: 'all' }}>argocd login argocd.quatre.systems --sso</code></li>
                <li>Once logged in, click the refresh button above.</li>
              </ol>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
                <button 
                  className="ui-button ui-button-primary" 
                  onClick={() => invoke('open_login_terminal', { 
                    terminalApp: settings.terminalApp, 
                    command: 'argocd login argocd.quatre.systems --sso' 
                  })}
                  style={{ padding: '6px 16px', fontSize: '0.85rem' }}
                >
                  Login with SSO
                </button>
              </div>
            </div>
          </div>
        )}

        {syncSuccess && (
          <div style={{ color: '#10b981', fontSize: '0.8rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '4px', padding: '8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '4px' }}>
            <Check size={14} /> Successfully requested sync!
          </div>
        )}

        {!argoState && !isFetching && !error && (
           <div className="ui-empty-state">No ArgoCD state fetched yet.</div>
        )}

        {isFetching && !argoState && (
          <div className="ui-ai-loading" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
            <RefreshCw size={32} className="text-primary animate-spin" />
            <p>Fetching ArgoCD state for {namespace}...</p>
          </div>
        )}

        {argoState && (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', padding: '4px' }}>
            {argoState.status ? (
              <>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '6px', flex: 1, minWidth: '200px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Sync Status</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', fontSize: '1.1rem', color: getSyncStatusColor(argoState.status?.sync?.status) }}>
                      {argoState.status?.sync?.status || 'Unknown'} 
                      {argoState.status?.sync?.revision && (
                         <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                           to {argoState.status.sync.revision.substring(0, 7)}
                         </span>
                      )}
                    </div>
                    {argoMetadata && (
                      <div style={{ marginTop: '8px', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div><span style={{ color: 'var(--text-muted)' }}>Author:</span> {argoMetadata.author}</div>
                        <div><span style={{ color: 'var(--text-muted)' }}>Comment:</span> {argoMetadata.message}</div>
                      </div>
                    )}
                  </div>
                  
                  <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '6px', flex: 1, minWidth: '200px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Health Status</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', fontSize: '1.1rem', color: getHealthStatusColor(argoState.status?.health?.status) }}>
                      {argoState.status?.health?.status || 'Unknown'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px', marginBottom: '8px' }}>
                  <button 
                    className="ui-button ui-button-primary" 
                    onClick={syncApp}
                    disabled={isSyncing}
                    style={{ padding: '8px 24px', fontSize: '0.9rem', width: '100%', maxWidth: '300px', justifyContent: 'center' }}
                  >
                    {isSyncing ? (
                      <><RefreshCw size={16} className="animate-spin" /> Syncing...</>
                    ) : (
                      <><Play size={16} /> Sync (Apply & Prune)</>
                    )}
                  </button>
                </div>

                {argoState.spec?.source?.repoURL && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <div><strong>Repo:</strong> {argoState.spec.source.repoURL}</div>
                    <div><strong>Path:</strong> {argoState.spec.source.path}</div>
                    <div><strong>Target Rev:</strong> {argoState.spec.source.targetRevision}</div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '6px', fontSize: '0.8rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
                {argoState.raw || JSON.stringify(argoState, null, 2)}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
