import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { useTerminal, TerminalTab } from '../../hooks/useTerminal';
import { useSettings } from '../../hooks/useSettings';
import '@xterm/xterm/css/xterm.css';

interface TerminalInstanceProps {
  tab: TerminalTab;
  isActive: boolean;
}

interface PtyPayload {
  id: string;
  data: string;
}

export function TerminalInstance({ tab, isActive }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const { setPtyId } = useTerminal();
  const { settings } = useSettings();
  const autoScrollRef = useRef(settings.terminalAutoScroll);

  useEffect(() => {
    autoScrollRef.current = settings.terminalAutoScroll;
  }, [settings.terminalAutoScroll]);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      cursorBlink: true,
    });
    termRef.current = term;

    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);

    term.open(containerRef.current);
    
    // Slight delay to allow DOM to settle before fitting
    setTimeout(() => {
      fitAddon.fit();
    }, 100);

    let unlistenRead: UnlistenFn | null = null;
    let unlistenExit: UnlistenFn | null = null;

    const initTerminal = async () => {
      try {
        let localPtyId: string | undefined = tab.ptyId;
        const initialQueue: PtyPayload[] = [];

        // Listen for output before spawning to not miss initial data
        unlistenRead = await listen<PtyPayload>('pty-read', (event) => {
          if (localPtyId) {
            if (event.payload.id === localPtyId) {
              if (autoScrollRef.current) {
                term.write(event.payload.data);
              } else {
                // If auto scroll is disabled, save viewport, write, restore viewport
                const buffer = term.buffer.active;
                const savedY = buffer.viewportY;
                term.write(event.payload.data, () => {
                  if (buffer.viewportY !== savedY) {
                    term.scrollToLine(savedY);
                  }
                });
              }
            }
          } else {
            initialQueue.push(event.payload);
          }
        });

        unlistenExit = await listen<PtyPayload>('pty-exit', (event) => {
          if (localPtyId && event.payload.id === localPtyId) {
            term.write('\r\n[Process Exited]\r\n');
          }
        });

        const ptyId: string = await invoke('spawn_pty', {
          command: tab.command,
          args: tab.args,
          rows: term.rows,
          cols: term.cols,
          env: tab.env || null,
        });

        localPtyId = ptyId;
        setPtyId(tab.id, ptyId);

        // Flush queued events that belong to our newly spawned pty
        initialQueue.forEach(ev => {
          if (ev.id === ptyId) {
            if (autoScrollRef.current) {
              term.write(ev.data);
            } else {
              const buffer = term.buffer.active;
              const savedY = buffer.viewportY;
              term.write(ev.data, () => {
                if (buffer.viewportY !== savedY) {
                  term.scrollToLine(savedY);
                }
              });
            }
          }
        });
        initialQueue.length = 0;
        
        // Setup input handler
        term.onData((data) => {
          invoke('write_pty', { id: ptyId, data }).catch(console.error);
        });

      } catch (err) {
        console.error('Failed to spawn pty', err);
        term.write(`\r\nFailed to start process: ${err}\r\n`);
      }
    };

    initTerminal();

    const handleResize = () => {
      if (fitAddonRef.current && termRef.current) {
        fitAddonRef.current.fit();
        if (tab.ptyId) {
          invoke('resize_pty', {
            id: tab.ptyId,
            rows: termRef.current.rows,
            cols: termRef.current.cols,
          }).catch(console.error);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    // Setup resize observer on container for panel resizing
    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      if (unlistenRead) unlistenRead();
      if (unlistenExit) unlistenExit();
      term.dispose();
      if (tab.ptyId) {
        invoke('close_pty', { id: tab.ptyId }).catch(console.error);
      }
    };
  }, []); // Only run once on mount

  // When panel becomes active or resizes, we might need to fit
  useEffect(() => {
    if (isActive && fitAddonRef.current) {
      setTimeout(() => fitAddonRef.current?.fit(), 50);
    }
  }, [isActive]);

  return (
    <div 
      style={{ 
        height: '100%', 
        width: '100%', 
        display: isActive ? 'block' : 'none',
        overflow: 'hidden'
      }} 
      ref={containerRef}
    />
  );
}
