import { X, Terminal } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { settings, updateSettings } = useSettings();

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
        
        <div className="modal-body">
          <div className="settings-section">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                  value="Terminal" 
                  checked={settings.terminalApp === 'Terminal'}
                  onChange={(e) => updateSettings({ terminalApp: e.target.value as 'Terminal' | 'iTerm' })}
                />
                Terminal (macOS Default)
              </label>
              
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="terminalApp" 
                  value="iTerm" 
                  checked={settings.terminalApp === 'iTerm'}
                  onChange={(e) => updateSettings({ terminalApp: e.target.value as 'Terminal' | 'iTerm' })}
                />
                iTerm2
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
