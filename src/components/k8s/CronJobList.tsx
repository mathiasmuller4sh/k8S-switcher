import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useKubeCronJobs, CronJobInfo } from '../../hooks/useKubeCronJobs';
import { useKubeJobs } from '../../hooks/useKubeJobs';
import { Play, TerminalSquare, ChevronDown, ChevronRight, ChevronUp, Clock, RefreshCw } from 'lucide-react';
import { useActionHistory } from '../../hooks/useActionHistory';
import { Card, CardContent, CardHeader } from '../ui/Card';

interface CronJobListProps {
  context: string;
  namespace: string;
}

export function CronJobList({ context, namespace }: CronJobListProps) {
  const { cronjobs, loading, refresh } = useKubeCronJobs(context, namespace);
  const { jobs, refresh: refreshJobs } = useKubeJobs(context, namespace);
  const { addAction } = useActionHistory();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  if (!context || !namespace) {
    return <div className="ui-empty-state">Select a context and namespace</div>;
  }

  if (loading && cronjobs.length === 0) {
    return <div className="ui-empty-state">Loading CronJobs...</div>;
  }

  if (cronjobs.length === 0) {
    return <div className="ui-empty-state">No CronJobs found in this namespace.</div>;
  }

  const handleRefresh = () => {
    refresh();
    refreshJobs();
  };

  const toggleRow = (name: string) => {
    setExpandedRows(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleTrigger = async (cronjob: CronJobInfo) => {
    try {
      const jobName = await invoke<string>('trigger_cronjob', { 
        context, 
        namespace, 
        cronjobName: cronjob.name 
      });
      
      await invoke('open_logs_by_label', {
        context,
        namespace,
        labelSelector: `job-name=${jobName} --all-containers=true`
      });

      addAction({
        type: 'Shell',
        context,
        namespace,
        podName: `trigger-${cronjob.name}`
      });
      handleRefresh();
      
      // Auto-expand the row to see the newly created job
      setExpandedRows(prev => ({ ...prev, [cronjob.name]: true }));
    } catch (e) {
      console.error('Failed to trigger cronjob', e);
    }
  };

  const handleLogs = async (cronjob: CronJobInfo) => {
    try {
      const latestJob = await invoke<string>('get_latest_cronjob_job', {
        context,
        namespace,
        cronjobName: cronjob.name
      });

      await invoke('open_logs_by_label', {
        context,
        namespace,
        labelSelector: `job-name=${latestJob} --all-containers=true`
      });

      addAction({
        type: 'Logs',
        context,
        namespace,
        podName: cronjob.name
      });
    } catch (e) {
      console.error('Failed to open logs', e);
      alert('Could not find any recent job for this cronjob to tail logs from.');
    }
  };

  const openJobLogs = async (jobName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke('open_logs_by_label', {
        context,
        namespace,
        labelSelector: `job-name=${jobName} --all-containers=true`
      });
      addAction({
        type: 'Logs',
        context,
        namespace,
        podName: jobName
      });
    } catch (e) {
      console.error('Failed to open job logs', e);
    }
  };

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
          <Clock size={14} className="text-primary" />
          <span className="ui-action-title">CronJobs in {namespace} ({cronjobs.length})</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
          <button 
            className={`ui-header-action-btn ${loading ? 'spinning' : ''}`}
            onClick={handleRefresh}
            title="Refresh CronJobs"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </CardHeader>

      {!isCollapsed && (
        <CardContent style={{ padding: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="ui-cronjob-list" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="ui-cronjob-list-header">
              <span>Name</span>
              <span style={{ textAlign: 'center' }}>Schedule</span>
              <span style={{ textAlign: 'center' }}>Suspend</span>
              <span style={{ textAlign: 'center' }}>Active</span>
              <span style={{ textAlign: 'center' }}>Last Schedule</span>
              <span style={{ textAlign: 'right' }}>Age</span>
              <span style={{ textAlign: 'right' }}>Actions</span>
            </div>
            <div className="ui-cronjob-list-content" style={{ flex: 1, overflowY: 'auto' }}>
              {cronjobs.map(cj => {
                const isExpanded = !!expandedRows[cj.name];
                const cjJobs = jobs.filter(j => 
                  j.cronjobName === cj.name || 
                  j.name.startsWith(`${cj.name.substring(0, 30)}-manual-`)
                );

                return (
                  <div key={cj.name} style={{ display: 'flex', flexDirection: 'column' }}>
                    <div 
                      className="ui-cronjob-item" 
                      onClick={() => toggleRow(cj.name)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="ui-pod-name" style={{ display: 'flex', alignItems: 'center', gap: '8px' }} title={cj.name}>
                        <div style={{ flexShrink: 0, display: 'flex', color: 'var(--text-muted)' }}>
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </div>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {cj.name}
                        </span>
                      </div>
                      <div style={{ textAlign: 'center', fontSize: '0.8rem' }}>{cj.schedule}</div>
                      <div style={{ textAlign: 'center' }}>
                        <span className={`status-badge ${cj.suspend ? 'terminated' : 'running'}`}>
                          {cj.suspend ? 'True' : 'False'}
                        </span>
                      </div>
                      <div style={{ textAlign: 'center', fontSize: '0.8rem' }}>{cj.active}</div>
                      <div style={{ textAlign: 'center', fontSize: '0.8rem' }}>{cj.lastSchedule}</div>
                      <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>{cj.age}</div>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        <button 
                          className="ui-action-btn" 
                          onClick={(e) => { e.stopPropagation(); handleTrigger(cj); }}
                          title="Trigger (Create Job)"
                        >
                          <Play size={16} />
                        </button>
                        <button 
                          className="ui-action-btn" 
                          onClick={(e) => { e.stopPropagation(); handleLogs(cj); }}
                          title="Follow logs of latest job"
                        >
                          <TerminalSquare size={16} />
                        </button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="ui-cronjob-jobs-panel">
                        <div className="ui-job-list-header">
                          <span>Job Name</span>
                          <span>Status</span>
                          <span>Started</span>
                          <span>Duration</span>
                          <span style={{ textAlign: 'right' }}>Actions</span>
                        </div>
                        {cjJobs.length === 0 ? (
                          <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            No recent jobs found for this CronJob.
                          </div>
                        ) : (
                          cjJobs.map(job => (
                            <div key={job.name} className="ui-job-item">
                              <span className="ui-pod-name" title={job.name}>{job.name}</span>
                              <span className={`status-badge status-${job.status.toLowerCase()}`}>{job.status}</span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{job.startTime}</span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{job.duration}</span>
                              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button 
                                  style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '4px', 
                                    padding: '4px 10px', 
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
                                  onClick={(e) => openJobLogs(job.name, e)}
                                  title="View logs"
                                >
                                  <TerminalSquare size={14} /> Logs
                                </button>
                              </div>
                            </div>
                          ))
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
