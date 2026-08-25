import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useKubeCronJobs, CronJobInfo } from '../../hooks/useKubeCronJobs';
import { useKubeJobs } from '../../hooks/useKubeJobs';
import { K8sAuthError } from '../ui/K8sAuthError';
import { Play, TerminalSquare, ChevronDown, ChevronRight, ChevronUp, Clock, RefreshCw, StopCircle, Trash2, FileText } from 'lucide-react';
import { useActionHistory } from '../../hooks/useActionHistory';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { useListFilter } from '../../hooks/useListFilter';
import { ListFilterField } from '../ui/ListFilterField';

interface CronJobListProps {
  context: string;
  namespace: string;
}

export function CronJobList({ context, namespace }: CronJobListProps) {
  const { cronjobs, loading, error, refresh } = useKubeCronJobs(context, namespace);
  const { jobs, refresh: refreshJobs } = useKubeJobs(context, namespace);
  const { addAction } = useActionHistory();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const { filterText, setFilterText, isFilterVisible, closeFilter, inputRef } = useListFilter();

  if (!context || !namespace) {
    return <div className="ui-empty-state">Select a context and namespace</div>;
  }

  if (error) {
    return (
      <Card className={`ui-pod-list-card`}>
        <CardContent style={{ padding: '24px' }}>
          <K8sAuthError error={error} onRetry={refresh} resourceName="CronJobs" />
        </CardContent>
      </Card>
    );
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

  const handleToggleSuspend = async (cronjob: CronJobInfo, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke('toggle_cronjob_suspend', {
        context,
        namespace,
        cronjobName: cronjob.name,
        suspend: !cronjob.suspend
      });
      handleRefresh();
    } catch (e) {
      console.error('Failed to toggle cronjob suspend state', e);
      alert('Failed to toggle suspend state: ' + e);
    }
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

  const handleDeleteJob = async (jobName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to stop job ${jobName}?`)) return;
    try {
      await invoke('delete_job', {
        context,
        namespace,
        jobName
      });
      handleRefresh();
    } catch (e) {
      console.error('Failed to delete job', e);
      alert('Failed to delete job: ' + e);
    }
  };

  const handleDescribe = async (cronjob: CronJobInfo) => {
    try {
      await invoke('open_describe', { 
        context, 
        namespace, 
        podName: cronjob.name, 
        kind: 'cronjob' 
      });
      addAction({
        type: 'Describe',
        context,
        namespace,
        podName: cronjob.name
      });
    } catch (e) {
      console.error('Failed to describe cronjob', e);
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
          <ListFilterField 
            visible={isFilterVisible} 
            value={filterText} 
            onChange={setFilterText} 
            onClose={closeFilter} 
            inputRef={inputRef} 
            placeholder="Filter CronJobs..." 
          />
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
              {cronjobs.filter(cj => !filterText || cj.name.toLowerCase().includes(filterText.toLowerCase())).map(cj => {
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
                      <div style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <div className="ui-switch-container">
                          <label className="ui-switch">
                            <input 
                              type="checkbox" 
                              checked={cj.suspend} 
                              onChange={(e) => handleToggleSuspend(cj, e as any)}
                            />
                            <span className="ui-switch-slider" style={{ backgroundColor: cj.suspend ? '#fbbf24' : 'rgba(255, 255, 255, 0.2)' }}></span>
                          </label>
                          <span 
                            style={{ 
                              fontSize: '0.75rem', 
                              color: cj.suspend ? '#fbbf24' : '#34d399',
                              transition: 'color 0.2s'
                            }}
                          >
                            {cj.suspend ? 'Suspended' : 'Active'}
                          </span>
                        </div>
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
                        <button 
                          className="ui-action-btn" 
                          onClick={(e) => { e.stopPropagation(); handleDescribe(cj); }}
                          title="Describe CronJob"
                        >
                          <FileText size={16} />
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
                                
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                  <button 
                                    style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: '4px', 
                                      padding: '4px 10px', 
                                      borderRadius: '6px', 
                                      backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                                      border: '1px solid rgba(239, 68, 68, 0.2)', 
                                      color: '#ef4444', 
                                      cursor: 'pointer', 
                                      fontSize: '0.75rem',
                                      transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; }}
                                    onClick={(e) => handleDeleteJob(job.name, e)}
                                    title={job.status.toLowerCase() === 'running' || job.status.toLowerCase() === 'pending' ? "Stop Job" : "Delete Job"}
                                  >
                                    {job.status.toLowerCase() === 'running' || job.status.toLowerCase() === 'pending' ? <StopCircle size={14} /> : <Trash2 size={14} />} 
                                    {job.status.toLowerCase() === 'running' || job.status.toLowerCase() === 'pending' ? "Stop" : "Delete"}
                                  </button>
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
