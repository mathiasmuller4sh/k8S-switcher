import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Cpu, MemoryStick, RefreshCw, Activity } from 'lucide-react';
import { ContainerResources } from '../../hooks/useKubePods';

interface ContainerMetrics {
  cpu: string;
  memory: string;
}

interface PodMetrics {
  total: ContainerMetrics;
  containers: Record<string, ContainerMetrics>;
}

interface HistoryPoint {
  cpu: number;
  memory: number;
  timestamp: number;
}

interface PodResourcePanelProps {
  context: string;
  namespace: string;
  podName: string;
  containers: ContainerResources[];
}

// Helper to parse K8s values (m, Ki, Mi, Gi) to numbers
function parseResourceValue(val: string): number {
  if (!val || val === '-' || val === '?' || val === '∞') return 0;
  
  const num = parseFloat(val);
  if (isNaN(num)) return 0;
  
  if (val.endsWith('m')) return num; // millicores
  if (val.endsWith('Ki')) return num * 1024;
  if (val.endsWith('Mi')) return num * 1024 * 1024;
  if (val.endsWith('Gi')) return num * 1024 * 1024 * 1024;
  if (val.endsWith('n')) return num / 1000000; // nanocores to millicores
  if (val.endsWith('u')) return num / 1000; // microcores to millicores
  
  return num;
}

function Sparkline({ data, color, height = 20 }: { data: number[], color: string, height?: number }) {
  if (data.length < 2) return <div style={{ width: 60, height }} />;
  
  const max = Math.max(...data, 1);
  const min = 0;
  const range = max - min;
  const width = 60;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        points={points}
        style={{ transition: 'all 0.3s' }}
      />
    </svg>
  );
}

export function PodResourcePanel({ context, namespace, podName, containers }: PodResourcePanelProps) {
  const [metrics, setMetrics] = useState<PodMetrics | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const pollInterval = useRef<any>(null);

  const fetchMetrics = async (isManual = false) => {
    if (isManual) setLoading(true);
    setMetricsError(null);
    try {
      const m = await invoke<PodMetrics>('get_pod_metrics', { context, namespace, podName });
      setMetrics(m);
      
      const newPoint = {
        cpu: parseResourceValue(m.total.cpu),
        memory: parseResourceValue(m.total.memory),
        timestamp: Date.now()
      };
      
      setHistory(prev => {
        const next = [...prev, newPoint];
        if (next.length > 30) return next.slice(next.length - 30);
        return next;
      });
    } catch (e) {
      setMetricsError(String(e));
    } finally {
      if (isManual) setLoading(false);
    }
  };

  useEffect(() => {
    setHistory([]);
    setMetrics(null);
    fetchMetrics(true);

    if (pollInterval.current) clearInterval(pollInterval.current);
    pollInterval.current = setInterval(() => fetchMetrics(false), 5000);

    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [podName, context, namespace]);

  if (containers.length === 0) return null;

  return (
    <div className="pod-resource-panel">
      <div className="pod-resource-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Activity size={14} className="text-primary" />
          <span className="pod-resource-title">Live Resources</span>
        </div>
        <button
          className={`pod-resource-refresh ${loading ? 'spinning' : ''}`}
          onClick={() => fetchMetrics(true)}
          disabled={loading}
          title="Refresh metrics"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {containers.map((c) => {
        const isInit = c.name.startsWith('(init)');
        const containerName = isInit ? c.name.replace('(init) ', '') : c.name;
        const containerMetrics = metrics?.containers[containerName];

        return (
          <div key={c.name} className={`pod-resource-container ${isInit ? 'init-container' : ''}`}>
            <div className="pod-resource-container-header">
              <div className="pod-resource-container-name">{c.name}</div>
              {containerMetrics && (
                <div className="pod-resource-container-usage">
                  <span className="usage-val"><Cpu size={10} /> {containerMetrics.cpu}</span>
                  <span className="usage-val"><MemoryStick size={10} /> {containerMetrics.memory}</span>
                </div>
              )}
            </div>
            <div className="pod-resource-grid">
              <div className="pod-resource-row">
                <div className="pod-resource-label">
                  <Cpu size={12} />
                  <span>CPU</span>
                </div>
                <div className="pod-resource-values">
                  <span className="pod-resource-chip req" title="Request">{c.cpuRequest}</span>
                  <span className="pod-resource-sep">→</span>
                  <span className="pod-resource-chip lim" title="Limit">{c.cpuLimit}</span>
                </div>
              </div>

              <div className="pod-resource-row">
                <div className="pod-resource-label">
                  <MemoryStick size={12} />
                  <span>Mem</span>
                </div>
                <div className="pod-resource-values">
                  <span className="pod-resource-chip req" title="Request">{c.memoryRequest}</span>
                  <span className="pod-resource-sep">→</span>
                  <span className="pod-resource-chip lim" title="Limit">{c.memoryLimit}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {metrics && (
        <div className="pod-resource-usage">
          <div className="pod-resource-usage-label">Total</div>
          <div className="pod-resource-usage-content">
            <div className="pod-resource-usage-item">
              <div className="pod-resource-usage-value">
                <Cpu size={11} />
                <span className="pod-resource-chip usage">{metrics.total.cpu}</span>
              </div>
              <Sparkline data={history.map(h => h.cpu)} color="#34d399" />
            </div>
            <div className="pod-resource-usage-item">
              <div className="pod-resource-usage-value">
                <MemoryStick size={11} />
                <span className="pod-resource-chip usage">{metrics.total.memory}</span>
              </div>
              <Sparkline data={history.map(h => h.memory)} color="#34d399" />
            </div>
          </div>
        </div>
      )}

      {metricsError && (
        <div className="pod-resource-error" title={metricsError}>
          ⚠ metrics indisponibles (metrics-server requis)
        </div>
      )}
    </div>
  );
}
