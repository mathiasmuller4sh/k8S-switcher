import React from 'react';
import { Pod, useKubePods } from '../../hooks/useKubePods';

interface PodListProps {
  context: string;
  namespace: string;
  selectedPod: string;
  onSelectPod: (pod: Pod) => void;
}

function shortImage(image: string): string {
  // Keep only the part after the last slash, and truncate tag at 12 chars
  const name = image.split('/').pop() || image;
  const [repo, tag] = name.split(':');
  if (!tag) return repo;
  return `${repo}:${tag.slice(0, 12)}${tag.length > 12 ? '…' : ''}`;
}

export function PodList({ context, namespace, selectedPod, onSelectPod }: PodListProps) {
  const { pods, loading } = useKubePods(context, namespace);

  if (!context || !namespace) {
    return <div className="ui-empty-state">Select a context and namespace</div>;
  }

  if (loading) {
    return <div className="ui-empty-state">Loading pods...</div>;
  }

  if (pods.length === 0) {
    return <div className="ui-empty-state">No pods found in this namespace.</div>;
  }

  return (
    <div className="ui-pod-list">
      <div className="ui-pod-list-header">
        <span>Name</span>
        <span style={{ textAlign: 'right' }}>Age</span>
        <span style={{ textAlign: 'center' }}>Status</span>
      </div>
      <div className="ui-pod-list-content">
        {pods.map((pod) => (
          <div
            key={pod.name}
            className={`ui-pod-item ${selectedPod === pod.name ? 'selected' : ''}`}
            onClick={() => onSelectPod(pod)}
          >
            <div className="ui-pod-name-block">
              <span className="ui-pod-name" title={pod.name}>{pod.name}</span>
              {pod.image && (
                <span className="ui-pod-image" title={pod.image}>{shortImage(pod.image)}</span>
              )}
            </div>
            <span className="ui-pod-age" style={{ textAlign: 'right' }}>{pod.age}</span>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <span className={`ui-pod-status status-${pod.status.toLowerCase()}`}>
                {pod.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
