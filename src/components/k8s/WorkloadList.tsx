import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useKubeWorkloads } from '../../hooks/useKubeWorkloads';
import { useKubePods } from '../../hooks/useKubePods';
import { K8sAuthError } from '../ui/K8sAuthError';
import { ChevronDown, ChevronUp, ChevronRight, Layers, RefreshCw, Zap, Minus, Plus, RotateCcw, Check } from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { useActionHistory } from '../../hooks/useActionHistory';

interface WorkloadListProps {
  context: string;
  namespace: string;
}

export function WorkloadList({ context, namespace }: WorkloadListProps) {
  const { workloads, loading, error, refresh, autoRefresh, setAutoRefresh } = useKubeWorkloads(context, namespace);
  const { pods } = useKubePods(context, namespace);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { addAction } = useActionHistory();

  // Scale state per workload
  const [scalingState, setScalingState] = useState<Record<string, boolean>>({});
  const [pendingScale, setPendingScale] = useState<Record<string, number>>({});
  const [expandedWorkloads, setExpandedWorkloads] = useState<Record<string, boolean>>({});

  const handleScaleChange = (kind: string, name: string, currentReady: string, delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const workloadKey = `${kind}-${name}`;
    
    const parts = currentReady.split('/');
    if (parts.length !== 2) return;
    
    const currentDesired = parseInt(parts[1], 10);
    if (isNaN(currentDesired)) return;

    const currentPending = pendingScale[workloadKey] !== undefined ? pendingScale[workloadKey] : currentDesired;
    const newReplicas = Math.max(0, currentPending + delta);
    
    if (newReplicas === currentDesired) {
      const newPending = { ...pendingScale };
      delete newPending[workloadKey];
      setPendingScale(newPending);
    } else {
      setPendingScale(prev => ({ ...prev, [workloadKey]: newReplicas }));
    }
  };

  const handleValidateScale = async (kind: string, name: string, replicas: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const workloadKey = `${kind}-${name}`;
    setScalingState(prev => ({ ...prev, [workloadKey]: true }));

    try {
      await invoke('scale_workload', { context, namespace, kind, name, replicas });
      addAction({ type: 'Scale', context, namespace, podName: `${kind}/${name} to ${replicas}` });
      
      const newPending = { ...pendingScale };
      delete newPending[workloadKey];
      setPendingScale(newPending);
      refresh();
    } catch (err) {
      console.error(`Failed to scale ${kind} ${name}`, err);
    } finally {
      setScalingState(prev => ({ ...prev, [workloadKey]: false }));
    }
  };

  const handleRestart = async (kind: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const workloadKey = `${kind}-${name}-restart`;
    setScalingState(prev => ({ ...prev, [workloadKey]: true }));

    try {
      await invoke('restart_workload', { context, namespace, kind, name });
      addAction({ type: 'Restart', context, namespace, podName: `${kind}/${name}` });
    } catch (err) {
      console.error(`Failed to restart ${kind} ${name}`, err);
    } finally {
      setScalingState(prev => ({ ...prev, [workloadKey]: false }));
    }
  };

  if (!context || !namespace) {
    return <div className="ui-empty-state">Select a context and namespace</div>;
  }

  if (error) {
    return (
      <Card className={`ui-pod-list-card`}>
        <CardContent style={{ padding: '24px' }}>
          <K8sAuthError error={error} onRetry={refresh} resourceName="workloads" />
        </CardContent>
      </Card>
    );
  }

  if (loading && workloads.length === 0) {
    return <div className="ui-empty-state">Loading workloads...</div>;
  }

  if (workloads.length === 0) {
    return <div className="ui-empty-state">No Workloads found in this namespace.</div>;
  }

  return (
    <Card className={`ui-pod-list-card ${isCollapsed ? 'collapsed' : ''}`}>
      <CardHeader 
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', flex: 1 }}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          <Layers size={14} className="text-primary" />
          <span className="ui-action-title">Deployments & StatefulSets ({workloads.length})</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
          <button 
            className={`ui-header-action-btn ${loading ? 'spinning' : ''}`}
            onClick={refresh}
            title="Refresh Workloads"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button 
            className={`ui-header-action-btn ${autoRefresh ? 'active' : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
            title={autoRefresh ? "Disable Live Reload" : "Enable Live Reload"}
          >
            <Zap size={14} fill={autoRefresh ? "currentColor" : "none"} />
            <span style={{ fontSize: '0.65rem', fontWeight: 'bold' }}>LIVE</span>
          </button>
        </div>
      </CardHeader>
      
      {!isCollapsed && (
        <CardContent style={{ padding: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="ui-pod-list" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="ui-pod-list-header" style={{ display: 'flex' }}>
              <span style={{ flex: '1.5' }}>Name</span>
              <span style={{ flex: '0.5' }}>Kind</span>
              <span style={{ flex: '0.5', textAlign: 'center' }}>Ready</span>
              <span style={{ flex: '0.5', textAlign: 'center' }}>Up-to-date</span>
              <span style={{ flex: '0.5', textAlign: 'center' }}>Available</span>
              <span style={{ flex: '0.5', textAlign: 'right' }}>Age</span>
              <span style={{ flex: '1', textAlign: 'right' }}>Actions</span>
            </div>
            <div className="ui-pod-list-content" style={{ flex: 1, overflowY: 'auto' }}>
              {workloads.map((wl, i) => {
                const workloadKey = `${wl.kind}-${wl.name}`;
                const isScaling = scalingState[workloadKey];
                const isRestarting = scalingState[`${workloadKey}-restart`];
                const isExpanded = expandedWorkloads[workloadKey];
                const pendingVal = pendingScale[workloadKey];
                
                const workloadPods = pods.filter(p => p.name.startsWith(wl.name + '-'));

                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
                    <div 
                      className="ui-job-item" 
                      style={{ display: 'flex', cursor: 'pointer' }}
                      onClick={() => setExpandedWorkloads(prev => ({ ...prev, [workloadKey]: !isExpanded }))}
                    >
                      <span className="ui-pod-name" style={{ flex: '1.5', display: 'flex', alignItems: 'center', gap: '6px' }} title={wl.name}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {wl.name}
                      </span>
                      <span style={{ flex: '0.5', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{wl.kind}</span>
                      <span style={{ flex: '0.5', textAlign: 'center', fontWeight: 'bold' }}>{wl.ready}</span>
                      <span style={{ flex: '0.5', textAlign: 'center' }}>{wl.up_to_date}</span>
                      <span style={{ flex: '0.5', textAlign: 'center' }}>{wl.available}</span>
                      <span style={{ flex: '0.5', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{wl.age}</span>
                      
                      <div style={{ flex: '1', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        {wl.kind !== 'DaemonSet' && (
                          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <button 
                              style={{ padding: '4px 8px', cursor: 'pointer', background: 'transparent', border: 'none', color: 'var(--text-color)', borderRight: '1px solid rgba(255,255,255,0.05)' }}
                              onClick={(e) => handleScaleChange(wl.kind, wl.name, wl.ready, -1, e)}
                              title="Scale Down"
                            >
                              <Minus size={12} />
                            </button>
                            
                            {pendingVal !== undefined ? (
                              <button
                                 onClick={(e) => handleValidateScale(wl.kind, wl.name, pendingVal, e)}
                                 style={{ padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px', cursor: isScaling ? 'wait' : 'pointer', background: 'transparent', border: 'none', color: 'var(--success-color, #10b981)', fontWeight: 'bold' }}
                                 disabled={isScaling}
                                 title="Validate Scale"
                              >
                                 {pendingVal} <Check size={12} />
                              </button>
                            ) : (
                              <span style={{ padding: '0 8px', fontSize: '0.75rem', fontWeight: 'bold' }}>Scale</span>
                            )}
                            
                            <button 
                              style={{ padding: '4px 8px', cursor: 'pointer', background: 'transparent', border: 'none', color: 'var(--text-color)', borderLeft: '1px solid rgba(255,255,255,0.05)' }}
                              onClick={(e) => handleScaleChange(wl.kind, wl.name, wl.ready, 1, e)}
                              title="Scale Up"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        )}
                        
                        <button 
                          style={{ 
                            display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', 
                            backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', 
                            color: '#60a5fa', cursor: isRestarting ? 'wait' : 'pointer', fontSize: '0.75rem'
                          }}
                          onClick={(e) => handleRestart(wl.kind, wl.name, e)}
                          disabled={isRestarting}
                          title="Rollout Restart"
                        >
                          <RotateCcw size={12} className={isRestarting ? 'animate-spin' : ''} /> Restart
                        </button>
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div style={{ paddingLeft: '32px', backgroundColor: 'rgba(0,0,0,0.15)', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        {workloadPods.length > 0 ? workloadPods.map(pod => (
                           <div key={pod.name} style={{ display: 'flex', padding: '8px 12px', fontSize: '0.8rem', alignItems: 'center', borderBottom: '1px dashed rgba(255,255,255,0.05)' }}>
                              <span style={{ flex: '1.5', fontFamily: 'monospace' }}>{pod.name}</span>
                              <span style={{ flex: '1' }}>
                                <span className={`status-badge status-${pod.status.toLowerCase()}`}>{pod.status}</span>
                              </span>
                              <span style={{ flex: '1', color: 'var(--text-muted)' }}>{pod.age}</span>
                              <span style={{ flex: '1', color: 'var(--text-muted)', textAlign: 'right' }}></span>
                           </div>
                        )) : (
                           <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>No running pods found for this workload.</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
