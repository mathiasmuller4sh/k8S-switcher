import { X, Terminal as TerminalIcon, Lock, Unlock } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useTerminal } from '../../hooks/useTerminal';
import { useSettings } from '../../hooks/useSettings';
import { TerminalInstance } from './TerminalInstance';
import './CaptiveTerminalPanel.css';

export function CaptiveTerminalPanel() {
  const { tabs, activeTabId, isPanelOpen, closeTerminal, setActiveTabId, setPanelOpen } = useTerminal();
  const { settings, updateSettings } = useSettings();
  const isBottom = settings.terminalPosition === 'bottom';
  const [width, setWidth] = useState(500);
  const [height, setHeight] = useState(250);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDragging) {
      const handleMouseMove = (e: MouseEvent) => {
        if (isBottom) {
          // Leave at least 150px for the top content
          const newHeight = Math.max(150, Math.min(window.innerHeight - 150, window.innerHeight - e.clientY));
          setHeight(newHeight);
        } else {
          // Leave at least 300px for the left content
          const newWidth = Math.max(250, Math.min(window.innerWidth - 300, window.innerWidth - e.clientX));
          setWidth(newWidth);
        }
      };
      
      const handleMouseUp = () => {
        setIsDragging(false);
      };
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  if (!isPanelOpen) return null;

  return (
    <div 
      className={`captive-terminal-panel ${isDragging ? 'dragging' : ''} ${isBottom ? 'position-bottom' : 'position-right'}`}
      ref={panelRef}
      style={isBottom ? { height: `${height}px`, width: '100%' } : { width: `${width}px`, height: '100%' }}
    >
      <div 
        className="terminal-resizer"
        onMouseDown={(e) => { e.preventDefault(); setIsDragging(true); }}
      />
      <div className="terminal-header">
        <div className="terminal-tabs">
          {tabs.map(tab => (
            <div 
              key={tab.id}
              className={`terminal-tab ${activeTabId === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTabId(tab.id)}
              title={tab.title}
            >
              <TerminalIcon size={14} className="tab-icon" />
              <span className="tab-title">{tab.title}</span>
              <button 
                className="tab-close-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTerminal(tab.id);
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
        <div className="terminal-actions">
          <button 
            className={`panel-action-btn ${settings.terminalAutoScroll ? 'active' : ''}`}
            onClick={() => updateSettings({ terminalAutoScroll: !settings.terminalAutoScroll })}
            title={settings.terminalAutoScroll ? "Auto-Scroll is ON (Click to disable)" : "Auto-Scroll is OFF (Click to enable)"}
          >
            {settings.terminalAutoScroll ? <Unlock size={14} /> : <Lock size={14} />}
          </button>
          <button 
            className="panel-close-btn"
            onClick={() => setPanelOpen(false)}
            title="Hide Terminal Panel"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="terminal-content">
        {tabs.length === 0 ? (
          <div className="empty-terminal">No active terminal sessions</div>
        ) : (
          tabs.map(tab => (
            <TerminalInstance 
              key={tab.id} 
              tab={tab} 
              isActive={activeTabId === tab.id} 
            />
          ))
        )}
      </div>
    </div>
  );
}
