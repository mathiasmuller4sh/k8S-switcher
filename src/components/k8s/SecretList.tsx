import { useState } from 'react';
import { useKubeSecrets } from '../../hooks/useKubeSecrets';
import { ChevronDown, ChevronUp, Key, RefreshCw, ExternalLink, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { openUrl } from '@tauri-apps/plugin-opener';
import { invoke } from '@tauri-apps/api/core';

interface SecretListProps {
  context: string;
  namespace: string;
}

export function SecretList({ context, namespace }: SecretListProps) {
  const { secrets, loading, refresh } = useKubeSecrets(context, namespace);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedSecret, setExpandedSecret] = useState<string | null>(null);
  const [secretData, setSecretData] = useState<Record<string, string> | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [filterText, setFilterText] = useState('');

  if (!context || !namespace) {
    return <div className="ui-empty-state">Select a context and namespace</div>;
  }

  if (loading && secrets.length === 0) {
    return <div className="ui-empty-state">Loading Secrets...</div>;
  }

  if (secrets.length === 0) {
    return <div className="ui-empty-state">No Secrets found in this namespace.</div>;
  }

  const openVault = async (secretName: string) => {
    try {
      // Lien direct vers le secret dans l'UI de Vault
      await openUrl(`https://vault.quatre.systems/ui/vault/secrets/secret/show/${namespace}/${secretName}`);
    } catch (e) {
      console.error('Failed to open Vault URL', e);
    }
  };

  const handleReveal = async (secretName: string) => {
    if (expandedSecret === secretName) {
      setExpandedSecret(null);
      setSecretData(null);
      return;
    }
    
    setExpandedSecret(secretName);
    setLoadingData(true);
    try {
      const data = await invoke<Record<string, string>>('get_secret_data', {
        context,
        namespace,
        secretName
      });
      setSecretData(data);
    } catch (e) {
      console.error('Failed to get secret data', e);
    } finally {
      setLoadingData(false);
    }
  };

  return (
    <Card className={`ui-pvc-list-card ${isCollapsed ? 'collapsed' : ''}`}>
      <CardHeader 
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', flex: 1 }}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          <Key size={14} className="text-primary" />
          <span className="ui-action-title">Secrets in {namespace} ({secrets.length})</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
          <input 
            type="text" 
            placeholder="Filter secrets..." 
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{ 
              padding: '4px 8px', 
              borderRadius: '4px', 
              border: '1px solid rgba(255, 255, 255, 0.1)', 
              background: 'rgba(0, 0, 0, 0.2)', 
              color: 'var(--text-color)',
              fontSize: '0.8rem',
              outline: 'none',
              width: '150px'
            }}
          />
          <button 
            className={`ui-header-action-btn ${loading ? 'spinning' : ''}`}
            onClick={refresh}
            title="Refresh Secrets"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </CardHeader>
      
      {!isCollapsed && (
        <CardContent style={{ padding: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="ui-pvc-list" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="ui-pvc-list-content" style={{ flex: 1, overflowY: 'auto' }}>
              {secrets.filter(s => s.name.toLowerCase().includes(filterText.toLowerCase())).map((secret) => (
                <div key={secret.name} style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="ui-pvc-item" style={{ gridTemplateColumns: '1fr 100px 80px 140px', borderBottom: expandedSecret === secret.name ? 'none' : undefined }}>
                    <div className="ui-pvc-name-block">
                      <span className="ui-pvc-name" title={secret.name}>{secret.name}</span>
                      <div className="ui-pvc-meta">
                        {secret.age}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {secret.secretType}
                    </div>
                    <div style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 600 }}>
                      {secret.dataCount} keys
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '4px', 
                          padding: '4px 8px', 
                          borderRadius: '6px', 
                          backgroundColor: expandedSecret === secret.name ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)', 
                          border: '1px solid rgba(255, 255, 255, 0.1)', 
                          color: 'var(--text-color)', 
                          cursor: 'pointer', 
                          fontSize: '0.75rem',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = expandedSecret === secret.name ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)'; }}
                        onClick={() => handleReveal(secret.name)}
                        title={expandedSecret === secret.name ? "Hide Values" : "Reveal Values"}
                      >
                        {expandedSecret === secret.name ? <EyeOff size={14} /> : <Eye size={14} />} Reveal
                      </button>
                      <button 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '4px', 
                          padding: '4px 8px', 
                          borderRadius: '6px', 
                          backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                          border: '1px solid rgba(255, 255, 255, 0.1)', 
                          color: 'var(--text-color)', 
                          cursor: 'pointer', 
                          fontSize: '0.75rem',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'; }}
                        onClick={() => openVault(secret.name)}
                        title="View in Vault"
                      >
                        <ExternalLink size={14} /> Vault
                      </button>
                    </div>
                  </div>
                  {expandedSecret === secret.name && (
                    <div style={{
                      backgroundColor: 'rgba(0, 0, 0, 0.2)',
                      padding: '16px',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}>
                      {loadingData ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>Loading secret data...</div>
                      ) : secretData ? (
                        Object.entries(secretData).length > 0 ? (
                          Object.entries(secretData).map(([key, value]) => (
                            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-color)' }}>{key}</div>
                              <pre style={{
                                margin: 0,
                                padding: '8px 12px',
                                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                borderRadius: '6px',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                fontSize: '0.75rem',
                                color: '#a78bfa',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all',
                                fontFamily: 'monospace'
                              }}>
                                {value}
                              </pre>
                            </div>
                          ))
                        ) : (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>No data in this secret.</div>
                        )
                      ) : (
                        <div style={{ color: '#ef4444', fontSize: '0.8rem' }}>Failed to load secret data.</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
