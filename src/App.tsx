import { useState, useEffect } from "react";
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ClusterSelector } from "./components/k8s/ClusterSelector";
import { NamespaceSelector } from "./components/k8s/NamespaceSelector";
import { PodList } from "./components/k8s/PodList";
import { Pod } from "./hooks/useKubePods";
import { ActionPanel } from "./components/actions/ActionPanel";
import { PodResourcePanel } from "./components/k8s/PodResourcePanel";
import { RecentActions } from "./components/actions/RecentActions";
import { K8sLogo } from "./components/ui/K8sLogo";
import "./index.css";

interface CurrentContextInfo {
  context: string;
  namespace: string;
}

function App() {
  const [selectedContext, setSelectedContext] = useState<string>("");
  const [selectedNamespace, setSelectedNamespace] = useState<string>("");
  const [selectedPod, setSelectedPod] = useState<Pod | null>(null);

  useEffect(() => {
    invoke<CurrentContextInfo>('get_current_context')
      .then(info => {
        if (info && info.context) {
          setSelectedContext(info.context);
          if (info.namespace) {
            setSelectedNamespace(info.namespace);
          }
        }
      })
      .catch(err => console.error("Failed to load current context", err));
  }, []);

  const handleContextChange = (context: string) => {
    setSelectedContext(context);
    setSelectedNamespace("");
    setSelectedPod(null);
  };

  const handleNamespaceChange = (namespace: string) => {
    setSelectedNamespace(namespace);
    setSelectedPod(null);
  };

  const handleDragStart = (e: React.MouseEvent) => {
    if (e.button === 0) {
      getCurrentWindow().startDragging();
    }
  };

  const isContextSelected = selectedContext !== "";
  const isNamespaceSelected = selectedNamespace !== "";

  return (
    <div className="app-container">
      <header className="app-header" onMouseDown={handleDragStart}>
        <K8sLogo size={28} />
        <h1>K8s Switcher</h1>
      </header>

      <main className="app-content">
        {/* Combo selectors section - only shown if they are selected */}
        {(isContextSelected || isNamespaceSelected) && (
          <div className="selector-group">
            {isContextSelected && (
              <ClusterSelector
                selected={selectedContext}
                onSelect={handleContextChange}
                displayMode="combo"
              />
            )}
            {isNamespaceSelected && (
              <NamespaceSelector
                key={selectedContext}
                context={selectedContext}
                selected={selectedNamespace}
                onSelect={handleNamespaceChange}
                displayMode="combo"
              />
            )}
          </div>
        )}

        <div className="pod-section">
          {!isContextSelected && (
            <ClusterSelector
              selected={selectedContext}
              onSelect={handleContextChange}
              displayMode="list"
            />
          )}

          {isContextSelected && !isNamespaceSelected && (
            <NamespaceSelector
              key={`list-${selectedContext}`}
              context={selectedContext}
              selected={selectedNamespace}
              onSelect={handleNamespaceChange}
              displayMode="list"
            />
          )}

          {isContextSelected && isNamespaceSelected && (
            <PodList
              context={selectedContext}
              namespace={selectedNamespace}
              selectedPod={selectedPod?.name ?? ""}
              onSelectPod={setSelectedPod}
            />
          )}
        </div>

        {isContextSelected && isNamespaceSelected && selectedPod && (
          <>
            <PodResourcePanel
              context={selectedContext}
              namespace={selectedNamespace}
              podName={selectedPod.name}
              containers={selectedPod.containers}
            />
            <ActionPanel
              context={selectedContext}
              namespace={selectedNamespace}
              podName={selectedPod.name}
              podPorts={selectedPod.ports}
              podLabels={selectedPod.labels}
            />
          </>
        )}
        
        <RecentActions isContextSelected={isContextSelected} />
      </main>
    </div>
  );
}

export default App;
