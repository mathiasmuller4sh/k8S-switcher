import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Sparkles, Settings, Play, ShieldAlert, Cpu, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent, CardHeader } from '../ui/Card';

interface AIAnalysisPanelProps {
  context: string;
  namespace: string;
}

export function AIAnalysisPanel({ context, namespace }: AIAnalysisPanelProps) {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<'gemini' | 'ollama'>('gemini');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [language, setLanguage] = useState<'english' | 'french'>('french');
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem('k8s_switcher_gemini_key') || '';
    const savedProvider = (localStorage.getItem('k8s_switcher_ai_provider') as 'gemini' | 'ollama') || 'gemini';
    const savedOllamaUrl = localStorage.getItem('k8s_switcher_ollama_url') || 'http://localhost:11434';
    const savedLanguage = (localStorage.getItem('k8s_switcher_ai_language') as 'english' | 'french') || 'french';
    
    setApiKey(savedApiKey);
    setProvider(savedProvider);
    setOllamaUrl(savedOllamaUrl);
    setLanguage(savedLanguage);
  }, []);

  const saveSettings = () => {
    localStorage.setItem('k8s_switcher_gemini_key', apiKey);
    localStorage.setItem('k8s_switcher_ai_provider', provider);
    localStorage.setItem('k8s_switcher_ollama_url', ollamaUrl);
    localStorage.setItem('k8s_switcher_ai_language', language);
    setIsConfigOpen(false);
  };

  const gatherData = async () => {
    try {
      const [pods, pvcs, events] = await Promise.all([
        invoke('get_pods', { context, namespace }).catch(() => []),
        invoke('get_pvcs', { context, namespace }).catch(() => []),
        invoke('get_events', { context, namespace }).catch(() => [])
      ]);
      return { pods, pvcs, events };
    } catch (e) {
      console.error("Failed to gather data", e);
      return null;
    }
  };

  const analyzeNamespace = async () => {
    if (provider === 'gemini' && !apiKey) {
      setError("Please configure your Gemini API Key first.");
      setIsConfigOpen(true);
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const data = await gatherData();
      if (!data) throw new Error("Could not fetch namespace data from Kubernetes.");

      const prompt = `
You are a Kubernetes expert AI assistant. Analyze the following data from the namespace '${namespace}' in context '${context}'.
Provide a concise, Markdown-formatted report highlighting:
1. Overall Health Status.
2. Any Pod issues (CrashLoopBackOff, ImagePullBackOff, high restarts).
3. PVC status and capacity planning (are there pending PVCs?).
4. Critical Warning Events that need attention.
5. Actionable recommendations to fix any found issues.

IMPORTANT: You MUST write your ENTIRE response in ${language === 'french' ? 'French' : 'English'}.
Keep the tone professional and helpful. Focus only on potential problems or notable warnings.

Data Context:
---
PODS (Total: ${(data.pods as any[]).length}):
${JSON.stringify((data.pods as any[]).map(p => ({ name: p.name, status: p.status, age: p.age, containers: p.containers.length })), null, 2)}

PVCS (Total: ${(data.pvcs as any[]).length}):
${JSON.stringify((data.pvcs as any[]).map(p => ({ name: p.name, status: p.status, capacity: p.capacity })), null, 2)}

RECENT EVENTS (Max 20):
${JSON.stringify((data.events as any[]).slice(0, 20).map(e => ({ type: e.eventType, reason: e.reason, object: e.object, message: e.message })), null, 2)}
---
`;

      if (provider === 'gemini') {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2 }
          })
        });
        
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error?.message || "Gemini API request failed.");
        }
        
        const resData = await response.json();
        const text = resData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) setAnalysisResult(text);
        else throw new Error("No text returned from Gemini API.");
      } else {
        // Ollama
        const response = await fetch(`${ollamaUrl}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama3', // Default common model, might need to be configurable
            prompt: prompt,
            stream: false
          })
        });

        if (!response.ok) throw new Error(`Ollama request failed: ${response.statusText}. Is it running and CORS configured?`);
        
        const resData = await response.json();
        setAnalysisResult(resData.response);
      }

    } catch (e: any) {
      setError(e.message || "An unexpected error occurred during analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!context || !namespace) {
    return <div className="ui-empty-state">Select a context and namespace</div>;
  }

  return (
    <Card className="ui-ai-panel">
      <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} className="text-primary" />
          <span className="ui-action-title">AI Insights for {namespace}</span>
        </div>
        <div>
          <button 
            className={`ui-header-action-btn ${isConfigOpen ? 'active' : ''}`}
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            title="AI Settings"
          >
            <Settings size={14} />
          </button>
        </div>
      </CardHeader>

      <CardContent style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {isConfigOpen && (
          <div className="ui-ai-config-panel">
            <h4>AI Provider Configuration</h4>
            
            <div className="ui-ai-config-row">
              <label>Provider</label>
              <select value={provider} onChange={e => setProvider(e.target.value as any)} className="custom-select" style={{width: '100%'}}>
                <option value="gemini">Google Gemini API (Cloud)</option>
                <option value="ollama">Ollama (Local - Private)</option>
              </select>
            </div>

            <div className="ui-ai-config-row">
              <label>Response Language</label>
              <select value={language} onChange={e => setLanguage(e.target.value as any)} className="custom-select" style={{width: '100%'}}>
                <option value="french">Français</option>
                <option value="english">English</option>
              </select>
            </div>

            {provider === 'gemini' && (
              <div className="ui-ai-config-row">
                <label>Gemini API Key</label>
                <input 
                  type="password" 
                  value={apiKey} 
                  onChange={e => setApiKey(e.target.value)} 
                  placeholder="AIzaSy..."
                  className="ui-port-input"
                  style={{ textAlign: 'left', border: '1px solid var(--border-color)', padding: '6px' }}
                />
                <small style={{color: 'var(--text-muted)', fontSize: '0.7rem'}}>Get a free key from Google AI Studio.</small>
              </div>
            )}

            {provider === 'ollama' && (
              <div className="ui-ai-config-row">
                <label>Ollama API URL</label>
                <input 
                  type="text" 
                  value={ollamaUrl} 
                  onChange={e => setOllamaUrl(e.target.value)} 
                  placeholder="http://localhost:11434"
                  className="ui-port-input"
                  style={{ textAlign: 'left', border: '1px solid var(--border-color)', padding: '6px' }}
                />
                <small style={{color: 'var(--text-muted)', fontSize: '0.7rem'}}>Ensure Ollama is running and OLLAMA_ORIGINS="*" is set for CORS.</small>
              </div>
            )}

            <button className="ui-button ui-button-primary" style={{marginTop: '12px', flex: 'none'}} onClick={saveSettings}>
              Save Settings
            </button>
          </div>
        )}

        {!isConfigOpen && (
          <div className="ui-ai-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!analysisResult && !isAnalyzing && (
              <div className="ui-ai-empty" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                <Cpu size={48} className="text-muted" opacity={0.5} />
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', maxWidth: '300px', fontSize: '0.9rem' }}>
                  Analyze the health of {namespace} using Artificial Intelligence. We'll check Pod statuses, PVC capacity, and recent events.
                </p>
                <button 
                  className="ui-button ui-button-primary" 
                  onClick={analyzeNamespace}
                  style={{ padding: '8px 16px', fontSize: '0.9rem', flex: 'none' }}
                >
                  <Play size={16} /> Start Analysis
                </button>
                {error && (
                  <div style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldAlert size={14} /> {error}
                  </div>
                )}
              </div>
            )}

            {isAnalyzing && (
              <div className="ui-ai-loading" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                <Sparkles size={32} className="text-primary animate-spin" />
                <p>Analyzing {namespace}...</p>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Gathering pods, PVCs, and events...</span>
              </div>
            )}

            {analysisResult && !isAnalyzing && (
              <div className="ui-ai-result markdown-body" style={{ flex: 1, overflowY: 'auto', padding: '12px', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '6px', fontSize: '0.85rem', lineHeight: 1.5 }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                   <button className="ui-header-action-btn" onClick={analyzeNamespace}>
                     <RefreshCw size={12} style={{marginRight: '4px'}}/> Re-analyze
                   </button>
                </div>
                <ReactMarkdown>{analysisResult}</ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
