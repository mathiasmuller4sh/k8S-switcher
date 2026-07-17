import { useState, useEffect } from "react";
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ClusterSelector } from "./components/k8s/ClusterSelector";
import { NamespaceSelector } from "./components/k8s/NamespaceSelector";
import { PodList } from "./components/k8s/PodList";
import { PvcList } from "./components/k8s/PvcList";
import { IngressList } from "./components/k8s/IngressList";
import { EventList } from "./components/k8s/EventList";
import { CronJobList } from "./components/k8s/CronJobList";
import { SecretList } from "./components/k8s/SecretList";
import { WorkloadList } from "./components/k8s/WorkloadList";
import { ArgoCDPanel } from "./components/k8s/ArgoCDPanel";
import { Pod } from "./hooks/useKubePods";
import { ActionPanel } from "./components/actions/ActionPanel";
import { PodResourcePanel } from "./components/k8s/PodResourcePanel";
import { K8sLogo } from "./components/ui/K8sLogo";
import { Settings, Search } from 'lucide-react';
import { SettingsModal } from './components/ui/SettingsModal';
import { GlobalSearchModal } from './components/ui/GlobalSearchModal';
import { useAutoUpdate } from './hooks/useAutoUpdate';
import { DownloadCloud, RefreshCcw, Check } from 'lucide-react';
import "./index.css";

interface CurrentContextInfo {
  context: string;
  namespace: string;
}

function App() {
  const [selectedContext, setSelectedContext] = useState<string>("");
  const [selectedNamespace, setSelectedNamespace] = useState<string>("");
  const [selectedPod, setSelectedPod] = useState<Pod | null>(null);
  const [activeTab, setActiveTab] = useState<'pods' | 'workloads' | 'pvcs' | 'ingresses' | 'events' | 'cronjobs' | 'secrets' | 'argocd'>('pods');
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

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

    const { updateInfo, isUpdating, updateError, updateSuccess, applyUpdate } = useAutoUpdate();

  const handleContextChange = (context: string) => {
    setSelectedContext(context);
    setSelectedNamespace("");
    setSelectedPod(null);
  };

  const handleNamespaceChange = (namespace: string) => {
    setSelectedNamespace(namespace);
    setSelectedPod(null);
    
    // Add to recents
    try {
      const stored = localStorage.getItem("k8s-switcher-recent-namespaces");
      const prev = stored ? JSON.parse(stored) : [];
      const newRecents = [{ context: selectedContext, namespace }, ...prev.filter((r: any) => r.context !== selectedContext || r.namespace !== namespace)].slice(0, 5);
      localStorage.setItem("k8s-switcher-recent-namespaces", JSON.stringify(newRecents));
    } catch (e) {
      console.error("Error saving recents", e);
    }
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
        <div style={{ flex: 1, paddingLeft: '80px' }}></div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', pointerEvents: 'none', justifyContent: 'center' }}>
          <K8sLogo size={28} />
          <h1>K8s Switcher</h1>
        </div>
        
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', paddingRight: '8px' }}>
          <button 
            className="ui-action-btn" 
            onClick={() => setShowSearch(true)}
            title="Search Namespaces"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', marginRight: '8px' }}
          >
            <Search size={20} />
          </button>
          <button 
            className="ui-action-btn" 
            onClick={() => setShowSettings(true)}
            title="Settings"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      {updateInfo?.available && !updateSuccess && (
        <div style={{ backgroundColor: 'var(--primary)', color: 'white', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DownloadCloud size={16} />
            <span>Update Available: Version {updateInfo.latestVersion} is ready to install!</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {updateError && <span style={{ color: '#ffb3b3' }}>Error: {updateError}</span>}
            <button 
              onClick={applyUpdate}
              disabled={isUpdating}
              style={{ backgroundColor: 'white', color: 'var(--primary)', border: 'none', padding: '4px 12px', borderRadius: '4px', cursor: isUpdating ? 'wait' : 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {isUpdating ? <RefreshCcw size={14} className="animate-spin" /> : <DownloadCloud size={14} />}
              {isUpdating ? 'Updating via Brew...' : 'Update Now'}
            </button>
          </div>
        </div>
      )}
      
      {updateSuccess && (
        <div style={{ backgroundColor: '#10b981', color: 'white', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', gap: '8px' }}>
          <Check size={16} />
          <span>Update installed successfully! Please restart K8s Switcher to apply changes.</span>
        </div>
      )}
      
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showSearch && (
        <GlobalSearchModal
          onClose={() => setShowSearch(false)}
          onSelect={(ctx, ns) => {
            setSelectedContext(ctx);
            setSelectedNamespace(ns);
          }}
        />
      )}

      <main className="app-content">
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

        <div className="scrollable-content-area" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div className="pod-section" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
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
            <>
              <div className="ui-tabs">
                <button 
                  className={`ui-tab ${activeTab === 'pods' ? 'active' : ''}`}
                  onClick={() => setActiveTab('pods')}
                >
                  Pods
                </button>
                <button 
                  className={`ui-tab ${activeTab === 'workloads' ? 'active' : ''}`}
                  onClick={() => setActiveTab('workloads')}
                >
                  Workloads
                </button>
                <button 
                  className={`ui-tab ${activeTab === 'cronjobs' ? 'active' : ''}`}
                  onClick={() => setActiveTab('cronjobs')}
                >
                  CronJobs
                </button>
                <button 
                  className={`ui-tab ${activeTab === 'events' ? 'active' : ''}`}
                  onClick={() => setActiveTab('events')}
                >
                  Events
                </button>
                <button 
                  className={`ui-tab ${activeTab === 'secrets' ? 'active' : ''}`}
                  onClick={() => setActiveTab('secrets')}
                >
                  Secrets
                </button>
                <button 
                  className={`ui-tab ${activeTab === 'pvcs' ? 'active' : ''}`}
                  onClick={() => setActiveTab('pvcs')}
                >
                  PVCs
                </button>
                <button 
                  className={`ui-tab ${activeTab === 'ingresses' ? 'active' : ''}`}
                  onClick={() => setActiveTab('ingresses')}
                >
                  Ingresses
                </button>
                <button 
                  className={`ui-tab ${activeTab === 'argocd' ? 'active' : ''}`}
                  onClick={() => setActiveTab('argocd')}
                  style={{ color: activeTab === 'argocd' ? 'white' : 'var(--primary)' }}
                >
                  ArgoCD
                </button>
              </div>

              {activeTab === 'pods' && (
                <PodList
                  context={selectedContext}
                  namespace={selectedNamespace}
                  selectedPod={selectedPod?.name ?? ""}
                  onSelectPod={setSelectedPod}
                />
              )}
              {activeTab === 'workloads' && (
                <WorkloadList context={selectedContext} namespace={selectedNamespace} />
              )}
              {activeTab === 'pvcs' && (
                <PvcList
                  context={selectedContext}
                  namespace={selectedNamespace}
                />
              )}
              {activeTab === 'ingresses' && (
                <IngressList
                  context={selectedContext}
                  namespace={selectedNamespace}
                />
              )}
              {activeTab === 'cronjobs' && (
                <CronJobList
                  context={selectedContext}
                  namespace={selectedNamespace}
                />
              )}
              {activeTab === 'events' && (
                <EventList
                  context={selectedContext}
                  namespace={selectedNamespace}
                />
              )}
              {activeTab === 'secrets' && (
                <SecretList
                  context={selectedContext}
                  namespace={selectedNamespace}
                />
              )}
              {activeTab === 'argocd' && (
                <ArgoCDPanel
                  context={selectedContext}
                  namespace={selectedNamespace}
                />
              )}
            </>
          )}
        </div>

        {isContextSelected && isNamespaceSelected && selectedPod && activeTab === 'pods' && (
          <>
            <PodResourcePanel
              context={selectedContext}
              namespace={selectedNamespace}
              podName={selectedPod.name}
              containers={selectedPod.containers}
            />
          </>
        )}
        </div>
      </main>
      {isContextSelected && isNamespaceSelected && selectedPod && activeTab === 'pods' && (
        <ActionPanel
          context={selectedContext}
          namespace={selectedNamespace}
          podName={selectedPod.name}
          podPorts={selectedPod.ports}
          podLabels={selectedPod.labels}
        />
      )}
    </div>
  );
}

export default App;
