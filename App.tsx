
import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import NetworkMap from './components/NetworkMap';
import AlertsLog from './components/AlertsLog';
import ThreatFeed from './components/ThreatFeed';
import Logs from './components/Logs';
import Reports from './components/Reports';
import Settings from './components/Settings';
import { DEVICES as INITIAL_DEVICES } from './constants';
import { Device } from './types';
import { useIpsBackend } from './hooks/useIpsBackend';

export interface Toast {
  id: number;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [devices, setDevices] = useState<Device[]>(INITIAL_DEVICES);
  const [externalSelectedId, setExternalSelectedId] = useState<string | null>(null);
  const [preventionMode, setPreventionMode] = useState<'active' | 'passive'>('active');

  const {
    connected: backendConnected,
    metrics,
    alerts,
    logs,
    trafficChart,
    simStatus,
    devices: backendDevices,
    startSimulation,
    stopSimulation,
    triggerAttack,
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

  const handleScanMesh = () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanProgress(0);
    addToast('Initiating wide-spectrum IoT mesh scan...', 'info');

    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      if (progress >= 100) {
        clearInterval(interval);
        setScanProgress(100);
        setIsScanning(false);
        addToast('Mesh scan complete. System topology updated.', 'success');
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
      setSearchError(`couldn't find the ${searchQuery} entered`);
      setTimeout(() => setSearchError(null), 5000);
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
      case 'reports':
        return <Reports onNotify={addToast} metrics={metrics} alerts={backendConnected ? alerts : []} />;
      case 'settings':
        return (
          <Settings
            onNotify={addToast}
            onAddDevice={addDevice}
            devices={displayDevices}
            ipsApi={ipsApi}
            backendConnected={backendConnected}
            simulationRunning={simStatus?.running ?? false}
            activeAttack={simStatus?.active_attack ?? metrics?.active_attack ?? null}
            mlTrained={metrics?.ml_model_trained ?? false}
            onStartSimulation={startSimulation}
            onStopSimulation={stopSimulation}
            onTriggerAttack={triggerAttack}
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
      case 'dashboard': return 'IoT Node Monitor';
      case 'threat-feed': return 'Prevention Feed';
      case 'network': return 'Network Topology Map';
      case 'alerts': return 'System Prevention Log';
      case 'logs': return 'Raw Event Streams';
      case 'reports': return 'Security Compliance Analytics';
      case 'settings': return 'Core System Configuration';
      default: return 'Intelli IPS';
    }
  };

  return (
    <div className="flex h-screen bg-background dark:bg-black selection:bg-black dark:selection:bg-white selection:text-white dark:selection:text-black overflow-hidden relative text-main dark:text-white">
      <div className="fixed top-20 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div 
            key={toast.id} 
            className={`pointer-events-auto px-4 py-3 border font-mono text-xs flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-300 shadow-2xl ${
              toast.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-500 text-emerald-700 dark:text-emerald-400' :
              toast.type === 'error' ? 'bg-red-50 dark:bg-red-950 border-red-500 text-red-700 dark:text-red-400' :
              toast.type === 'warning' ? 'bg-orange-50 dark:bg-orange-950 border-orange-500 text-orange-700 dark:text-orange-400' :
              'bg-surface dark:bg-surface-dark border-surface-highlight dark:border-surface-highlight text-main dark:text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {toast.type === 'success' ? 'check_circle' : 
               toast.type === 'error' ? 'dangerous' : 
               toast.type === 'warning' ? 'warning' : 'info'}
            </span>
            {toast.message}
          </div>
        ))}
      </div>

      <Sidebar currentTab={currentTab} onTabChange={setCurrentTab} alertsCount={backendConnected ? alerts.length : 3} />
      
      <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-background dark:bg-black border-l border-surface dark:border-surface-highlight">
        <header className="h-16 flex flex-col justify-center px-6 md:px-8 border-b border-surface dark:border-surface-highlight bg-background dark:bg-black z-40 shrink-0 relative">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4 text-main dark:text-white">
              <button className="md:hidden text-gray-400 hover:text-white" onClick={() => addToast('Mobile menu toggled (demo)', 'info')}>
                <span className="material-symbols-outlined pixel-icon">menu</span>
              </button>
              <h2 className="text-lg font-bold tracking-tight hidden sm:block uppercase">{getHeaderTitle()}</h2>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="hidden md:flex relative group w-64 items-center">
                <form onSubmit={handleSearch} className="relative w-full flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-gray-500 group-focus-within:text-white transition-colors text-[20px] pixel-icon pointer-events-none">search</span>
                  <input 
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (searchError) setSearchError(null);
                    }}
                    className={`w-full bg-surface dark:bg-surface-dark border ${searchError ? 'border-red-500' : 'border-surface dark:border-surface-highlight'} h-9 pl-10 pr-4 text-sm text-main dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:ring-1 focus:ring-black dark:focus:ring-white focus:border-black dark:focus:border-white transition-all font-mono outline-none`} 
                    placeholder="Search ID, IP, MAC..." 
                    type="text"
                  />
                </form>
                {searchError && (
                  <div className="absolute top-11 left-0 right-0 bg-red-50 dark:bg-red-950 border border-red-500 p-2 text-[10px] font-mono text-red-700 dark:text-red-400 animate-in slide-in-from-top-1 z-50 shadow-xl">
                    {searchError}
                  </div>
                )}
              </div>
              <div className="h-6 w-px bg-surface dark:bg-surface-highlight"></div>
              <button 
                onClick={handleScanMesh}
                disabled={isScanning}
                className={`flex items-center gap-2 text-sm font-bold px-4 h-9 transition-all border outline-none ${
                  isScanning 
                  ? 'bg-surface dark:bg-surface-dark text-gray-500 dark:text-gray-500 border-surface dark:border-surface-highlight cursor-not-allowed' 
                  : 'bg-black dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-black border-black dark:border-white'
                }`}
              >
                <span className={`material-symbols-outlined text-[18px] pixel-icon ${isScanning ? 'animate-spin' : ''}`}>
                  {isScanning ? 'sync' : 'radar'}
                </span>
                <span className="hidden sm:inline">
                  {isScanning ? `${scanProgress}%` : (currentTab === 'network' ? 'Refresh Nodes' : 'Scan Mesh')}
                </span>
              </button>
            </div>
          </div>
          {isScanning && (
            <div className="absolute bottom-0 left-0 h-0.5 bg-emerald-500 transition-all duration-150 z-50 shadow-[0_0_10px_#10b981]" style={{ width: `${scanProgress}%` }}></div>
          )}
        </header>

        {renderContent()}
      </main>
    </div>
  );
};

export default App;
