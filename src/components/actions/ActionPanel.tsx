import { useState } from 'react';
import { ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { DescribeButton } from './DescribeButton';
import { PortForwardButton } from './PortForwardButton';
import { ShellButton } from './ShellButton';
import { RolloutRestartButton } from './RolloutRestartButton';
import { CombinedLogsButton } from './CombinedLogsButton';
import { RecentActions } from './RecentActions';
import { useSettings } from '../../hooks/useSettings';

interface ActionPanelProps {
  context: string;
  namespace: string;
  podName: string;
  podPorts: number[];
  podLabels: Record<string, string>;
}

export function ActionPanel({ context, namespace, podName, podPorts, podLabels }: ActionPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { settings } = useSettings();

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
            <CombinedLogsButton context={context} namespace={namespace} podName={podName} labels={podLabels} />
            <ShellButton context={context} namespace={namespace} podName={podName} />
            <RolloutRestartButton context={context} namespace={namespace} podName={podName} />
            <PortForwardButton context={context} namespace={namespace} podName={podName} podPorts={podPorts} />
          </div>
          {settings.showTopActions && (
            <div className="ui-action-panel-top-actions">
              <RecentActions isContextSelected={true} namespace={namespace} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
