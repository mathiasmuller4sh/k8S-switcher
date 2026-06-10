import { useState } from 'react';
import { ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { LogsButton } from './LogsButton';
import { PortForwardButton } from './PortForwardButton';
import { ShellButton } from './ShellButton';
import { DescribeButton } from './DescribeButton';
import { RolloutRestartButton } from './RolloutRestartButton';
import { AppLogsButton } from './AppLogsButton';
import { RecentActions } from './RecentActions';

interface ActionPanelProps {
  context: string;
  namespace: string;
  podName: string;
  podPorts: number[];
  podLabels: Record<string, string>;
}

export function ActionPanel({ context, namespace, podName, podPorts, podLabels }: ActionPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!podName || !context || !namespace) {
    return null;
  }

  return (
    <div className={`ui-action-panel-footer ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="ui-action-panel-header" onClick={() => setIsCollapsed(!isCollapsed)}>
        {isCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        <Zap size={14} className="text-primary" />
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: '1', fontWeight: 600, textTransform: 'uppercase' }}>
            {namespace}
          </span>
          <span className="ui-action-title">Actions for {podName}</span>
        </div>
      </div>
      {!isCollapsed && (
        <div className="ui-action-panel-content">
          <div className="ui-action-buttons">
            <DescribeButton context={context} namespace={namespace} podName={podName} />
            <div style={{ display: 'flex', gap: '8px' }}>
              <LogsButton context={context} namespace={namespace} podName={podName} />
              <AppLogsButton context={context} namespace={namespace} labels={podLabels} />
            </div>
            <ShellButton context={context} namespace={namespace} podName={podName} />
            <RolloutRestartButton context={context} namespace={namespace} podName={podName} />
            <PortForwardButton context={context} namespace={namespace} podName={podName} podPorts={podPorts} />
          </div>
          <div className="ui-action-panel-top-actions">
            <RecentActions isContextSelected={true} namespace={namespace} />
          </div>
        </div>
      )}
    </div>
  );
}
