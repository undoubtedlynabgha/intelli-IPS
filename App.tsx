
import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginScreen from './components/LoginScreen';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import NetworkMap from './components/NetworkMap';
import AlertsLog from './components/AlertsLog';
import ThreatFeed from './components/ThreatFeed';
import Logs from './components/Logs';
import Reports from './components/Reports';
import Settings from './components/Settings';
import MLEvalLab from './components/MLEvalLab';
import Copilot from './components/Copilot';
import { DEVICES as INITIAL_DEVICES } from './constants';
import { Device, CopilotMessage } from './types';
import { useIpsBackend } from './hooks/useIpsBackend';

export interface Toast {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

/** Inner app — only renders when user is authenticated */
const AppInner: React.FC = () => {
  const { currentUser, isAdmin, logout } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [devices, setDevices] = useState<Device[]>(INITIAL_DEVICES);
  const [externalSelectedId, setExternalSelectedId] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([
    {
      sender: 'ai',
      text: "Hello Security Analyst. I am **Intelli IPS Copilot**, your real-time security assistant. I have analyzed our live telemetry, whitelisted device registries, active logs, and quarantine database.\n\nAsk me anything about the network's health, explain recent anomalies, or check why a specific node has been isolated.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const {
    connected: backendConnected,
    metrics,
    alerts,
    logs,
    trafficChart,
    simStatus,
    devices: backendDevices,
    mode,
    startSimulation,
    stopSimulation,
    resetSimulation,
    triggerAttack,
    setMode,
    scanRealNetwork,
    ipsApi,
  } = useIpsBackend();

  const displayDevices = backendConnected && backendDevices.length > 0 ? backendDevices : devices;

  const addToast = (message: string, type: Toast['type'] = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const addDevice = async (newDevice: Device) => {
    if (backendConnected) {
      try {
        await ipsApi.addDevice(newDevice);
        addToast(`Node ${newDevice.name} commissioned in secure mesh.`, 'success');
      } catch (e) {
        addToast(`Failed to commission node: ${e instanceof Error ? e.message : 'API error'}`, 'error');
      }
    } else {
      setDevices(prev => [...prev, newDevice]);
      addToast(`Node ${newDevice.name} commissioned successfully (demo).`, 'success');
    }
  };

  const removeDevice = async (deviceId: string) => {
    const dev = displayDevices.find(d => d.id === deviceId);
    if (!dev) return;

    if (backendConnected) {
      try {
        await ipsApi.removeDevice(deviceId);
        addToast(`Node ${dev.name} decommissioned from secure mesh.`, 'success');
      } catch (e) {
        addToast(`Failed to decommission node: ${e instanceof Error ? e.message : 'API error'}`, 'error');
      }
    } else {
      setDevices(prev => prev.filter(d => d.id !== deviceId));
      addToast(`Node ${dev.name} decommissioned successfully (demo).`, 'success');
    }
  };

  const handleScanMesh = async () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanProgress(0);

    if (backendConnected && mode === 'real') {
      addToast('Initiating real network wide-spectrum subnet scan...', 'info');
      try {
        await scanRealNetwork();
      } catch (e) {
        addToast('Real network scan failed', 'error');
      }
    } else {
      addToast('Initiating wide-spectrum IoT mesh scan...', 'info');
    }

    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      if (progress >= 100) {
        clearInterval(interval);
        setScanProgress(100);
        setIsScanning(false);
        addToast(backendConnected && mode === 'real' ? 'Subnet sweep complete. Real IoT nodes updated.' : 'Mesh scan complete. System topology updated.', 'success');
      } else {
        setScanProgress(progress);
      }
    }, 150);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const query = searchQuery.toLowerCase().trim();
    const foundDevice = displayDevices.find(d =>
      d.id.toLowerCase() === query ||
      d.name.toLowerCase() === query ||
      d.ip?.toLowerCase() === query ||
      d.mac?.toLowerCase() === query
    );

    if (foundDevice) {
      setSearchError(null);
      setExternalSelectedId(foundDevice.name);
      setCurrentTab('network');
      addToast(`Located node: ${foundDevice.name}`, 'success');
    } else {
      setSearchError(`Couldn't find: ${searchQuery}`);
      setTimeout(() => setSearchError(null), 5000);
    }
  };

  const handleResetAll = async () => {
    setResetting(true);
    try {
      if (backendConnected) {
        await resetSimulation();
      }
      setDevices(INITIAL_DEVICES);
      setCopilotMessages([
        {
          sender: 'ai',
          text: "Hello Security Analyst. I am **Intelli IPS Copilot**, your real-time security assistant. I have analyzed our live telemetry, whitelisted device registries, active logs, and quarantine database.\n\nAsk me anything about the network's health, explain recent anomalies, or check why a specific node has been isolated.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setCurrentTab('dashboard');
      setSearchQuery('');
      setSearchError(null);
      setExternalSelectedId(null);
      addToast('System fully reset to initial state.', 'success');
    } catch (e) {
      addToast(`Reset failed: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error');
    } finally {
      setResetting(false);
      setShowResetModal(false);
    }
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <Dashboard
            onNavigate={(tab) => setCurrentTab(tab)}
            deviceCount={displayDevices.length}
            metrics={metrics}
            alerts={backendConnected ? alerts : undefined}
            trafficChart={backendConnected && trafficChart.length > 0 ? trafficChart : undefined}
            backendConnected={backendConnected}
          />
        );
      case 'threat-feed':
        return (
          <ThreatFeed
            devices={displayDevices}
            alerts={backendConnected ? alerts : undefined}
            onNotify={addToast}
            ipsApi={ipsApi}
            backendConnected={backendConnected}
            metrics={metrics}
          />
        );
      case 'copilot':
        return (
          <Copilot
            devices={displayDevices}
            alerts={alerts}
            logs={logs}
            metrics={metrics}
            onNotify={addToast}
            messages={copilotMessages}
            setMessages={setCopilotMessages}
          />
        );
      case 'network':
        return (
          <NetworkMap
            isScanning={isScanning}
            onNotify={addToast}
            devices={displayDevices}
            externalSelectedId={externalSelectedId}
            onClearExternalSelect={() => setExternalSelectedId(null)}
            ipsApi={ipsApi}
            backendConnected={backendConnected}
            simulationRunning={simStatus?.running ?? false}
            activeAttack={simStatus?.active_attack ?? metrics?.active_attack ?? null}
            activeAttackAttackerId={metrics?.active_attack_attacker_id ?? null}
            activeAttackTargetId={metrics?.active_attack_target_id ?? null}
            mlTrained={metrics?.ml_model_trained ?? false}
            onStartSimulation={startSimulation}
            onStopSimulation={stopSimulation}
            onTriggerAttack={triggerAttack}
            isAdmin={isAdmin}
            onRemoveDevice={removeDevice}
            onAddDevice={addDevice}
          />
        );
      case 'alerts':
        return (
          <AlertsLog
            onNotify={addToast}
            alerts={backendConnected ? alerts : undefined}
            backendConnected={backendConnected}
          />
        );
      case 'logs':
        return (
          <Logs
            onNotify={addToast}
            logs={backendConnected ? logs : undefined}
            uptimeSeconds={metrics?.simulation_running ? simStatus?.uptime_seconds : undefined}
            ipsApi={ipsApi}
            backendConnected={backendConnected}
          />
        );
      case 'ml-eval':
        return <MLEvalLab metrics={metrics} onNotify={addToast} backendConnected={backendConnected} />;
      case 'reports':
        return <Reports onNotify={addToast} metrics={metrics} alerts={backendConnected ? alerts : []} />;
      case 'settings':
        if (!isAdmin) {
          return (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <span className="material-symbols-outlined text-6xl text-gray-600 mb-4 block">lock</span>
                <p className="text-muted dark:text-gray-500 font-mono uppercase tracking-widest text-sm">Admin access required</p>
                <p className="text-muted dark:text-gray-600 font-mono text-xs mt-2">Settings are restricted to administrator accounts.</p>
              </div>
            </div>
          );
        }
        return (
          <Settings
            onNotify={addToast}
            onAddDevice={addDevice}
            onRemoveDevice={removeDevice}
            devices={displayDevices}
            ipsApi={ipsApi}
            backendConnected={backendConnected}
            mode={mode}
            onToggleMode={setMode}
          />
        );
      default:
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <span className="material-symbols-outlined text-6xl text-gray-600 mb-4 block">construction</span>
              <p className="text-muted dark:text-gray-500 font-mono uppercase tracking-widest">Module under development</p>
            </div>
          </div>
        );
    }
  };

  const getHeaderTitle = () => {
    switch (currentTab) {
      case 'dashboard': return 'IPS Overview';
      case 'threat-feed': return 'Prevention Feed';
      case 'copilot': return 'Security AI Copilot';
      case 'network': return 'Network Monitor & Simulation';
      case 'alerts': return 'Prevention Action Log';
      case 'logs': return 'Event Streams';
      case 'ml-eval': return 'Machine Learning Performance Lab';
      case 'reports': return 'Security Analytics';
      case 'settings': return 'System Configuration';
      default: return 'Intelli IPS';
    }
  };

  return (
    <div className="flex h-screen bg-background dark:bg-black selection:bg-black dark:selection:bg-white selection:text-white dark:selection:text-black overflow-hidden relative text-main dark:text-white">
      {/* Reset confirmation modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-background dark:bg-[#0a0a0a] border border-surface dark:border-surface-highlight p-6 w-80 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-symbols-outlined text-orange-400 text-2xl">warning</span>
              <h3 className="text-main dark:text-white font-bold uppercase tracking-wide text-sm">Reset System</h3>
            </div>
            <p className="text-xs text-muted dark:text-gray-400 font-mono leading-relaxed mb-5">
              This will stop the simulation, clear all alerts, logs, and traffic data, and restore the network to its initial state. This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowResetModal(false)}
                className="flex-1 h-9 text-xs font-bold border border-surface dark:border-surface-highlight text-muted dark:text-gray-400 hover:text-main dark:hover:text-white transition-colors uppercase outline-none"
              >
                Cancel
              </button>
              <button
                onClick={handleResetAll}
                disabled={resetting}
                className="flex-1 h-9 text-xs font-bold bg-orange-700 hover:bg-orange-600 text-white uppercase transition-colors outline-none disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {resetting
                  ? <><span className="material-symbols-outlined text-[14px] animate-spin">sync</span> Resetting…</>
                  : <><span className="material-symbols-outlined text-[14px]">restart_alt</span> Confirm Reset</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto px-4 py-3 border font-mono text-xs flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-300 shadow-2xl max-w-xs ${
              toast.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-500 text-emerald-700 dark:text-emerald-400' :
              toast.type === 'error' ? 'bg-red-50 dark:bg-red-950/80 border-red-500 text-red-700 dark:text-red-400' :
              toast.type === 'warning' ? 'bg-orange-50 dark:bg-orange-950/80 border-orange-500 text-orange-700 dark:text-orange-400' :
              'bg-surface dark:bg-surface-dark border-surface dark:border-surface-highlight text-main dark:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px] shrink-0">
              {toast.type === 'success' ? 'verified_user' :
               toast.type === 'error' ? 'dangerous' :
               toast.type === 'warning' ? 'shield_locked' : 'info'}
            </span>
            <span className="leading-snug">{toast.message}</span>
          </div>
        ))}
      </div>

      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        alertsCount={backendConnected ? alerts.length : 3}
        currentUser={currentUser}
        isAdmin={isAdmin}
        onLogout={logout}
      />

      <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-background dark:bg-black border-l border-surface dark:border-surface-highlight">
        <header className="h-14 flex flex-col justify-center px-5 border-b border-surface dark:border-surface-highlight bg-background dark:bg-black z-40 shrink-0 relative">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3 text-main dark:text-white">
              <button className="md:hidden text-gray-400 hover:text-white" onClick={() => addToast('Mobile menu toggled (demo)', 'info')}>
                <span className="material-symbols-outlined pixel-icon">menu</span>
              </button>
              <h2 className="text-sm font-bold tracking-wider hidden sm:block uppercase text-muted dark:text-gray-400">{getHeaderTitle()}</h2>
            </div>

            <div className="flex items-center gap-3">
              {/* Backend status indicator */}
              <div className="hidden md:flex items-center gap-2 text-xs font-mono">
                <span className={`w-1.5 h-1.5 rounded-full ${backendConnected ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-gray-600'}`}></span>
                <span className={backendConnected ? 'text-emerald-500 font-bold' : 'text-muted dark:text-gray-600'}>
                  {backendConnected ? 'API Connected' : 'Demo Mode'}
                </span>
              </div>
              <div className="h-5 w-px bg-surface dark:bg-surface-highlight hidden md:block"></div>

              {/* Operation Mode badge */}
              {backendConnected && (
                <>
                  <div className="hidden md:flex items-center gap-2 text-xs font-mono">
                    <span className={`w-1.5 h-1.5 rounded-full ${mode === 'real' ? 'bg-blue-400 shadow-[0_0_6px_#60a5fa]' : 'bg-yellow-500 shadow-[0_0_6px_#eab308]'}`}></span>
                    <span className={mode === 'real' ? 'text-blue-400 font-bold' : 'text-yellow-500 font-bold'}>
                      {mode === 'real' ? 'Real Subnet' : 'Simulation'}
                    </span>
                  </div>
                  <div className="h-5 w-px bg-surface dark:bg-surface-highlight hidden md:block"></div>
                </>
              )}

              {/* Search */}
              <div className="hidden md:flex relative group w-48 items-center">
                <form onSubmit={handleSearch} className="relative w-full flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-gray-500 group-focus-within:text-main dark:group-focus-within:text-white transition-colors text-[17px] pixel-icon pointer-events-none">search</span>
                  <input
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (searchError) setSearchError(null);
                    }}
                    className={`w-full bg-surface dark:bg-surface-dark border ${searchError ? 'border-red-500' : 'border-surface dark:border-surface-highlight'} h-8 pl-9 pr-4 text-xs text-main dark:text-white placeholder-gray-500 focus:ring-1 focus:ring-black dark:focus:ring-white focus:border-black dark:focus:border-white transition-all font-mono outline-none`}
                    placeholder="Search IP, device…"
                    type="text"
                  />
                </form>
                {searchError && (
                  <div className="absolute top-10 left-0 right-0 bg-red-50 dark:bg-red-950 border border-red-500 p-2 text-[10px] font-mono text-red-600 dark:text-red-400 z-50 shadow-xl">
                    {searchError}
                  </div>
                )}
              </div>

              {/* Scan Mesh */}
              <button
                onClick={handleScanMesh}
                disabled={isScanning}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 h-8 transition-all border outline-none ${
                  isScanning
                  ? 'bg-surface dark:bg-surface-dark text-gray-500 border-surface dark:border-surface-highlight cursor-not-allowed'
                  : 'bg-black dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-black border-black dark:border-white'
                }`}
              >
                <span className={`material-symbols-outlined text-[16px] pixel-icon ${isScanning ? 'animate-spin' : ''}`}>
                  {isScanning ? 'sync' : 'radar'}
                </span>
                <span className="hidden sm:inline">
                  {isScanning ? `${scanProgress}%` : 'Scan Mesh'}
                </span>
              </button>

              {/* Reset All (admin only) */}
              {isAdmin && (
                <button
                  onClick={() => setShowResetModal(true)}
                  title="Reset entire system"
                  className="flex items-center gap-1.5 text-xs font-bold px-3 h-8 transition-all border outline-none bg-orange-950/30 hover:bg-orange-900/40 text-orange-400 border-orange-700/40 hover:border-orange-500/60"
                >
                  <span className="material-symbols-outlined text-[16px] pixel-icon">restart_alt</span>
                  <span className="hidden sm:inline">Reset All</span>
                </button>
              )}
            </div>
          </div>
          {isScanning && (
            <div className="absolute bottom-0 left-0 h-0.5 bg-emerald-500 transition-all duration-150 z-50 shadow-[0_0_8px_#10b981]" style={{ width: `${scanProgress}%` }}></div>
          )}
        </header>

        {renderContent()}
      </main>
    </div>
  );
};

/** Root — wraps with AuthProvider and shows login if unauthenticated */
const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  );
};

const AppGate: React.FC = () => {
  const { currentUser } = useAuth();
  if (!currentUser) return <LoginScreen />;
  return <AppInner />;
};

export default App;
