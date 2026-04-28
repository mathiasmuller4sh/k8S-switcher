import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { LogsButton } from './LogsButton';
import { PortForwardButton } from './PortForwardButton';
import { ShellButton } from './ShellButton';
import { DescribeButton } from './DescribeButton';
import { Card, CardContent, CardHeader } from '../ui/Card';

interface ActionPanelProps {
  context: string;
  namespace: string;
  podName: string;
  podPorts: number[];
}

export function ActionPanel({ context, namespace, podName, podPorts }: ActionPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!podName || !context || !namespace) {
    return null;
  }

  return (
    <Card className={`ui-action-panel ${isCollapsed ? 'collapsed' : ''}`}>
      <CardHeader 
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          <span className="ui-action-title">Actions for {podName}</span>
        </div>
      </CardHeader>
      {!isCollapsed && (
        <CardContent className="ui-action-buttons">
          <DescribeButton context={context} namespace={namespace} podName={podName} />
          <LogsButton context={context} namespace={namespace} podName={podName} />
          <ShellButton context={context} namespace={namespace} podName={podName} />
          <PortForwardButton context={context} namespace={namespace} podName={podName} podPorts={podPorts} />
        </CardContent>
      )}
    </Card>
  );
}
