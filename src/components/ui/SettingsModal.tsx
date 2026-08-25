import { X, Terminal, Info, RefreshCw, DownloadCloud, Check, Layout } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { useAutoUpdate } from '../../hooks/useAutoUpdate';

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { settings, updateSettings } = useSettings();
  const { updateInfo, isChecking, checkForUpdates, applyUpdate, isUpdating, updateSuccess, updateError } = useAutoUpdate();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button 
            onClick={onClose} 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="settings-section" style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '8px', marginBottom: '12px', marginTop: 0 }}>
              <Terminal size={16} /> Terminal Application
            </h3>
            <p className="settings-description">
              Choose which terminal application to use when opening shells, logs, or contexts.
            </p>
            <div className="settings-options" style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="terminalApp" 
                  value="Interne" 
                  checked={settings.terminalApp === 'Interne'}
                  onChange={(e) => updateSettings({ terminalApp: e.target.value as 'Terminal' | 'iTerm' | 'Interne' })}
                />
                Captif Interne
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="terminalApp" 
                  value="Terminal" 
                  checked={settings.terminalApp === 'Terminal'}
                  onChange={(e) => updateSettings({ terminalApp: e.target.value as 'Terminal' | 'iTerm' | 'Interne' })}
                />
                Terminal (macOS Default)
              </label>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="terminalApp" 
                  value="iTerm" 
                  checked={settings.terminalApp === 'iTerm'}
                  onChange={(e) => updateSettings({ terminalApp: e.target.value as 'Terminal' | 'iTerm' | 'Interne' })}
                />
                iTerm2
              </label>
            </div>

            {settings.terminalApp === 'Interne' && (
              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px dashed rgba(255, 255, 255, 0.1)' }}>
                <p className="settings-description" style={{ marginBottom: '8px' }}>Position du Terminal Intégré</p>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="terminalPosition" 
                      value="right" 
                      checked={settings.terminalPosition === 'right'}
                      onChange={() => updateSettings({ terminalPosition: 'right' })}
                    />
                    Droite
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="terminalPosition" 
                      value="bottom" 
                      checked={settings.terminalPosition === 'bottom'}
                      onChange={() => updateSettings({ terminalPosition: 'bottom' })}
                    />
                    Bas
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="settings-section" style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '8px', marginBottom: '12px', marginTop: 0 }}>
              <Layout size={16} /> User Interface
            </h3>
            
            <div style={{ marginBottom: '16px' }}>
              <p className="settings-description" style={{ marginBottom: '8px' }}>Theme Accent Color</p>
              <div style={{ display: 'flex', gap: '12px' }}>
                {[
                  { name: 'Pink', value: '#FF2D55' },
                  { name: 'Blue', value: '#0A84FF' },
                  { name: 'Green', value: '#30D158' },
                  { name: 'Orange', value: '#FF9F0A' },
                  { name: 'Vieux Rose', value: '#C08081' },
                ].map((color) => (
                  <button
                    key={color.name}
                    onClick={() => updateSettings({ themeColor: color.value })}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: color.value,
                      border: settings.themeColor === color.value ? '2px solid white' : '2px solid transparent',
                      boxShadow: settings.themeColor === color.value ? '0 0 0 1px rgba(255,255,255,0.3)' : 'none',
                      cursor: 'pointer',
                      padding: 0,
                      outline: 'none',
                      transition: 'all 0.2s',
                    }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            <p className="settings-description">
              Customize the look and feel of K8s Switcher.
            </p>
            <div className="settings-options" style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={settings.showTopActions}
                  onChange={(e) => updateSettings({ showTopActions: e.target.checked })}
                />
                Show "Recent Actions" history in the Pod Action panel
              </label>
            </div>
          </div>

          <div className="settings-section" style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '8px', marginBottom: '12px', marginTop: 0 }}>
              <Info size={16} /> About & Updates
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 'bold' }}>K8s Switcher Version:</span>{' '}
                  <span style={{ color: 'var(--text-muted)' }}>{updateInfo?.currentVersion || 'Loading...'}</span>
                </div>
                <button 
                  className="ui-action-btn"
                  onClick={checkForUpdates}
                  disabled={isChecking}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', opacity: isChecking ? 0.7 : 1 }}
                >
                  <RefreshCw size={14} className={isChecking ? "animate-spin" : ""} />
                  {isChecking ? 'Checking...' : 'Check for Updates'}
                </button>
              </div>

              {updateInfo?.available && !updateSuccess && (
                <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid var(--primary-color)', borderRadius: '6px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#60a5fa', fontWeight: 'bold' }}>
                    <DownloadCloud size={16} />
                    Version {updateInfo.latestVersion} is available!
                  </div>
                  {updateError && <div style={{ color: '#ffb3b3', fontSize: '0.85rem' }}>Error: {updateError}</div>}
                  <button 
                    onClick={applyUpdate}
                    disabled={isUpdating}
                    style={{ backgroundColor: 'var(--primary-color)', color: 'white', border: 'none', padding: '8px', borderRadius: '4px', cursor: isUpdating ? 'wait' : 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '4px' }}
                  >
                    {isUpdating ? <RefreshCw size={14} className="animate-spin" /> : <DownloadCloud size={14} />}
                    {isUpdating ? 'Updating via Brew...' : 'Update Now & Restart'}
                  </button>
                </div>
              )}

              {updateInfo && !updateInfo.available && !isChecking && (
                <div style={{ fontSize: '0.85rem', color: 'var(--success-color, #10b981)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={14} /> You are on the latest version.
                </div>
              )}

              {updateSuccess && (
                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#34d399', borderRadius: '6px', padding: '12px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  <Check size={16} />
                  <span>Update installed successfully! Please restart K8s Switcher to apply changes.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
